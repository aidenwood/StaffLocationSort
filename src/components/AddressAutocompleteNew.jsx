import { useState, useRef, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import useGooglePlacesNew from '../hooks/useGooglePlacesNew'

export default function AddressAutocompleteNew({ 
  onPlaceSelect, 
  placeholder = "Enter property address...",
  error = null
}) {
  console.log('🎯 AddressAutocompleteNew component loaded');
  
  const containerRef = useRef(null)
  const [manualAddress, setManualAddress] = useState('')
  const { isLoaded, selectedPlace, cleanup } = useGooglePlacesNew(containerRef)

  // Handle place selection
  useEffect(() => {
    if (selectedPlace && selectedPlace.address && onPlaceSelect) {
      console.log('📍 Calling onPlaceSelect with:', selectedPlace)
      onPlaceSelect(selectedPlace)
    } else if (selectedPlace && !selectedPlace.address) {
      console.log('⚠️ selectedPlace missing address, not calling onPlaceSelect:', selectedPlace)
    }
  }, [selectedPlace, onPlaceSelect])

  // Handle manual address input
  const handleManualInput = (e) => {
    const value = e.target.value
    setManualAddress(value)
    
    // For manual input, create a simple place object
    if (value.trim() && onPlaceSelect) {
      onPlaceSelect({
        address: value,
        lat: null,
        lng: null,
        placeId: null
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return (
    <div className="space-y-2">
      {/* Success indicator - moved to top */}
      {isLoaded && (
        <div className="text-xs text-green-600">
          ✅ Google Places ready - start typing to search addresses
        </div>
      )}
      
      <div className="relative">
        {/* Always show the container for Google Places, with fallback input */}
        <div 
          ref={containerRef}
          className="w-full google-places-container"
          style={{
            // CSS custom properties to style the PlaceAutocompleteElement
            '--gmp-color-primary': '#3b82f6',
            '--gmp-color-text': '#374151',
            '--gmp-color-background': '#ffffff',
            '--gmp-color-surface': '#ffffff',
            '--gmp-color-outline': '#d1d5db',
            '--gmp-color-outline-variant': '#e5e7eb',
            '--gmp-border-radius': '0.5rem',
            '--gmp-font-size': '14px',
            '--gmp-font-family': 'system-ui, -apple-system, sans-serif',
            '--gmp-dropdown-background-color': '#ffffff',
            '--gmp-dropdown-color': '#374151'
          }}
        />
        
        {/* Fallback manual input - only show if Google Places didn't load */}
        {!isLoaded && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={manualAddress}
              onChange={handleManualInput}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
        )}
      </div>

      {/* Google Places Status */}
      {!isLoaded && (
        <div className="text-xs text-gray-500">
          Loading Google Places...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Fallback notice */}
      {!isLoaded && (
        <div className="text-xs text-yellow-600">
          ⚠️ Google Places loading... Manual address entry may be needed.
        </div>
      )}
    </div>
  )
}