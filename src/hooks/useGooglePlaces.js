import { useEffect, useState, useRef } from 'react'

export default function useGooglePlaces(inputRef, options = {}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [predictions, setPredictions] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const autocompleteService = useRef(null)
  const placesService = useRef(null)

  const defaultOptions = {
    types: ['address'],
    componentRestrictions: { country: 'AU' }, // Restrict to Australia
    fields: ['place_id', 'formatted_address', 'geometry', 'address_components'],
    ...options
  }

  // Load Google Maps API script
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const checkGoogle = () => {
        if (window.google && window.google.maps) {
          setIsLoaded(true)
        } else {
          setTimeout(checkGoogle, 100)
        }
      }
      checkGoogle()
      return
    }

    // Load the script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      setIsLoaded(true)
    }
    
    script.onerror = () => {
      console.error('Failed to load Google Maps API')
    }
    
    document.head.appendChild(script)

    return () => {
      // Clean up on unmount
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript && existingScript === script) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Initialize services when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      placesService.current = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )
    }
  }, [isLoaded])

  // Get predictions based on input
  const getPlacePredictions = (input) => {
    if (!autocompleteService.current || !input.trim()) {
      setPredictions([])
      return
    }

    autocompleteService.current.getPlacePredictions(
      {
        input: input,
        ...defaultOptions
      },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setPredictions(predictions.slice(0, 5)) // Limit to 5 suggestions
        } else {
          setPredictions([])
        }
      }
    )
  }

  // Get place details by place_id
  const getPlaceDetails = (placeId) => {
    if (!placesService.current) {
      return Promise.reject('Places service not available')
    }

    return new Promise((resolve, reject) => {
      placesService.current.getDetails(
        {
          placeId: placeId,
          fields: defaultOptions.fields
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            const placeData = {
              address: place.formatted_address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              placeId: place.place_id
            }
            setSelectedPlace(placeData)
            resolve(placeData)
          } else {
            reject(new Error(`Places service error: ${status}`))
          }
        }
      )
    })
  }

  return {
    isLoaded,
    predictions,
    selectedPlace,
    getPlacePredictions,
    getPlaceDetails,
    clearPredictions: () => setPredictions([]),
    clearSelectedPlace: () => setSelectedPlace(null)
  }
}