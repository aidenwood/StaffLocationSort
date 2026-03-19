import { useEffect, useState, useRef } from 'react'

export default function useGooglePlacesNew(containerRef, options = {}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const autocompleteElementRef = useRef(null)

  const defaultOptions = {
    componentRestrictions: { country: 'AU' }, // Restrict to Australia
    fields: ['place_id', 'formatted_address', 'geometry', 'address_components'],
    ...options
  }

  // Load Google Maps API script with new Places API
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

    // Load the script with Places API (try beta first, then fallback to weekly)
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    console.log('🔑 Loading Google Maps with API key:', apiKey ? 'Key present' : 'NO API KEY')
    
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully')
      console.log('📦 Available Google Maps objects:', Object.keys(window.google.maps))
      if (window.google.maps.places) {
        console.log('🏢 Places API available:', Object.keys(window.google.maps.places))
      }
      setIsLoaded(true)
    }
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps API:', error)
      console.error('🔗 Script src was:', script.src)
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

  // Initialize PlaceAutocompleteElement when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && window.google && window.google.maps && containerRef.current) {
      const initializePlaces = async () => {
        try {
          console.log('🚀 Attempting to initialize PlaceAutocompleteElement')
          
          let autocompleteElement = null;
          
          // Method 1: Try new Places API with importLibrary
          try {
            console.log('📦 Trying importLibrary approach...')
            const placesLibrary = await window.google.maps.importLibrary('places')
            console.log('📦 Places library imported:', Object.keys(placesLibrary))
            
            if (placesLibrary.PlaceAutocompleteElement) {
              console.log('✅ PlaceAutocompleteElement found in importLibrary')
              autocompleteElement = new placesLibrary.PlaceAutocompleteElement({
                componentRestrictions: defaultOptions.componentRestrictions,
                locationBias: { radius: 50000, center: { lat: -27.4698, lng: 153.0251 } } // Max allowed: 50,000 meters
              })
              
              // Modern gmp-select event handler
              autocompleteElement.addEventListener('gmp-select', async (event) => {
                console.log('📍 Place selected via gmp-select:', event)
                await handlePlaceSelection(event.placePrediction)
              })
            }
          } catch (importError) {
            console.log('⚠️ importLibrary method failed:', importError.message)
          }
          
          // Method 2: Try direct API access
          if (!autocompleteElement && window.google.maps.places && window.google.maps.places.PlaceAutocompleteElement) {
            console.log('📦 Trying direct API access...')
            try {
              autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
                componentRestrictions: defaultOptions.componentRestrictions,
                locationBias: { radius: 50000, center: { lat: -27.4698, lng: 153.0251 } } // Max allowed: 50,000 meters
              })
              
              // Handle both old and new event types
              autocompleteElement.addEventListener('gmp-select', async (event) => {
                console.log('📍 Place selected via gmp-select (direct):', event)
                await handlePlaceSelection(event.placePrediction)
              })
              
              autocompleteElement.addEventListener('gmp-placeselect', async (event) => {
                console.log('📍 Place selected via gmp-placeselect (direct):', event)
                await handlePlaceSelection(event.place)
              })
              
              console.log('✅ PlaceAutocompleteElement initialized via direct access')
            } catch (directError) {
              console.log('⚠️ Direct API access failed:', directError.message)
            }
          }
          
          // Method 3: Legacy AutocompleteService fallback
          if (!autocompleteElement && window.google.maps.places && window.google.maps.places.AutocompleteService) {
            console.log('📦 Falling back to legacy Autocomplete...')
            try {
              // Create a simple autocomplete using legacy API
              const input = document.createElement('input')
              input.type = 'text'
              input.placeholder = 'Enter property address...'
              input.className = 'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              
              const autocomplete = new window.google.maps.places.Autocomplete(input, {
                componentRestrictions: defaultOptions.componentRestrictions,
                fields: ['formatted_address', 'geometry', 'place_id']
              })
              
              autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace()
                if (place && place.formatted_address) {
                  const placeData = {
                    address: place.formatted_address,
                    lat: place.geometry?.location?.lat(),
                    lng: place.geometry?.location?.lng(),
                    placeId: place.place_id
                  }
                  console.log('✅ Legacy autocomplete place selected:', placeData)
                  setSelectedPlace(placeData)
                }
              })
              
              autocompleteElement = input
              console.log('✅ Legacy Autocomplete initialized successfully')
            } catch (legacyError) {
              console.error('❌ Legacy Autocomplete failed:', legacyError)
            }
          }
          
          // Add the element to the DOM
          if (autocompleteElement && containerRef.current) {
            // Clear any existing content safely
            while (containerRef.current.firstChild) {
              containerRef.current.removeChild(containerRef.current.firstChild)
            }
            containerRef.current.appendChild(autocompleteElement)
            autocompleteElementRef.current = autocompleteElement
            console.log('✅ Autocomplete element added to DOM')
            
            // Style the input element directly via JavaScript to override shadow DOM
            const styleInput = () => {
              const shadowRoot = autocompleteElement.shadowRoot;
              if (shadowRoot) {
                const input = shadowRoot.querySelector('input');
                if (input) {
                  console.log('🎨 Applying direct styling to Google Places input');
                  input.style.backgroundColor = '#ffffff';
                  input.style.color = '#374151';
                  input.style.border = '1px solid #d1d5db';
                  input.style.borderRadius = '0.5rem';
                  input.style.padding = '12px 16px 12px 40px';
                  input.style.fontSize = '14px';
                  input.style.fontFamily = 'system-ui, -apple-system, sans-serif';
                  input.style.outline = 'none';
                  input.style.width = '100%';
                  input.style.boxSizing = 'border-box';
                  
                  // Focus styles
                  input.addEventListener('focus', () => {
                    input.style.borderColor = '#3b82f6';
                    input.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                  });
                  
                  input.addEventListener('blur', () => {
                    input.style.borderColor = '#d1d5db';
                    input.style.boxShadow = 'none';
                  });
                  
                  console.log('✅ Direct styling applied successfully');
                }
              }
            };
            
            // Apply styling immediately and after a short delay (for shadow DOM initialization)
            styleInput();
            setTimeout(styleInput, 100);
            setTimeout(styleInput, 500);
          } else {
            console.error('❌ No autocomplete method worked')
          }
          
        } catch (error) {
          console.error('❌ Complete initialization failure:', error)
        }
      }
      
      // Helper function to handle place selection
      const handlePlaceSelection = async (placePredictionOrPlace) => {
        try {
          let place = placePredictionOrPlace
          
          // If it's a prediction, convert to place
          if (placePredictionOrPlace && typeof placePredictionOrPlace.toPlace === 'function') {
            place = placePredictionOrPlace.toPlace()
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location', 'id']
            })
          }
          
          const placeData = {
            address: place.formattedAddress || place.formatted_address,
            lat: place.location?.lat() || place.geometry?.location?.lat(),
            lng: place.location?.lng() || place.geometry?.location?.lng(),
            placeId: place.id || place.place_id
          }
          
          console.log('✅ Place data extracted:', placeData)
          setSelectedPlace(placeData)
        } catch (fetchError) {
          console.error('❌ Failed to process place selection:', fetchError)
        }
      }
      
      initializePlaces()
    }
  }, [isLoaded, containerRef, defaultOptions])

  // Clean up function
  const cleanup = () => {
    if (autocompleteElementRef.current && containerRef.current) {
      try {
        if (containerRef.current.contains(autocompleteElementRef.current)) {
          containerRef.current.removeChild(autocompleteElementRef.current)
        }
      } catch (error) {
        console.log('Cleanup: Element already removed or not found')
      }
      autocompleteElementRef.current = null
    }
    setSelectedPlace(null)
  }

  return {
    isLoaded,
    selectedPlace,
    cleanup,
    clearSelectedPlace: () => setSelectedPlace(null)
  }
}