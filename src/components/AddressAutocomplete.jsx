import { useState, useRef, useEffect } from 'react'
import { MapPin, X } from 'lucide-react'
import useGooglePlaces from '../hooks/useGooglePlaces'

export default function AddressAutocomplete({ 
  value, 
  onChange, 
  onPlaceSelect, 
  placeholder = "Enter property address...",
  disabled = false,
  error = null
}) {
  const [inputValue, setInputValue] = useState(value || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const { 
    isLoaded, 
    predictions, 
    getPlacePredictions, 
    getPlaceDetails, 
    clearPredictions 
  } = useGooglePlaces(inputRef)

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSelectedIndex(-1)
    
    // Call onChange prop
    if (onChange) {
      onChange(newValue)
    }

    // Get predictions if Google Places is available
    if (isLoaded && newValue.length > 2) {
      getPlacePredictions(newValue)
      setShowDropdown(true)
    } else {
      clearPredictions()
      setShowDropdown(false)
    }
  }

  const handlePredictionSelect = async (prediction) => {
    try {
      const placeDetails = await getPlaceDetails(prediction.place_id)
      
      setInputValue(placeDetails.address)
      setShowDropdown(false)
      clearPredictions()
      setSelectedIndex(-1)

      // Call callbacks
      if (onChange) {
        onChange(placeDetails.address)
      }
      if (onPlaceSelect) {
        onPlaceSelect(placeDetails)
      }
    } catch (error) {
      console.error('Error getting place details:', error)
    }
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || predictions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handlePredictionSelect(predictions[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        clearPredictions()
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleInputFocus = () => {
    if (predictions.length > 0) {
      setShowDropdown(true)
    }
  }

  const handleInputBlur = (e) => {
    // Delay hiding dropdown to allow clicking on predictions
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setShowDropdown(false)
        setSelectedIndex(-1)
      }
    }, 150)
  }

  const clearInput = () => {
    setInputValue('')
    setShowDropdown(false)
    clearPredictions()
    setSelectedIndex(-1)
    
    if (onChange) {
      onChange('')
    }
    if (onPlaceSelect) {
      onPlaceSelect(null)
    }
    
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`input w-full pl-10 pr-10 ${error ? 'border-red-500' : ''}`}
          autoComplete="off"
        />
        
        {inputValue && (
          <button
            type="button"
            onClick={clearInput}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
            disabled={disabled}
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Google Places Status */}
      {!isLoaded && (
        <div className="text-xs text-gray-500 mt-1">
          Loading Google Places...
        </div>
      )}

      {/* Predictions Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? 'bg-primary-50' : ''
              }`}
              onClick={() => handlePredictionSelect(prediction)}
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {prediction.structured_formatting?.main_text || prediction.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {prediction.structured_formatting?.secondary_text || ''}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Fallback notice */}
      {!isLoaded && inputValue && (
        <div className="text-xs text-yellow-600 mt-1">
          ⚠️ Google Places unavailable. Manual coordinates may be needed for accurate results.
        </div>
      )}
    </div>
  )
}