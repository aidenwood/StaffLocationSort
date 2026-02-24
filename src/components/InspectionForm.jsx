import { useState } from 'react'
import { ArrowLeft, User, Clock, FileText } from 'lucide-react'
import AddressAutocomplete from './AddressAutocomplete'

export default function InspectionForm({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    address: '',
    lat: '',
    lng: '',
    customerName: '',
    estimatedDuration: 60,
    notes: '',
    preferredDateRange: {
      start: '',
      end: ''
    }
  })

  const [errors, setErrors] = useState({})

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    if (name.startsWith('preferredDateRange.')) {
      const field = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        preferredDateRange: {
          ...prev.preferredDateRange,
          [field]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleAddressChange = (address) => {
    setFormData(prev => ({
      ...prev,
      address,
      // Clear coordinates when address changes manually
      lat: '',
      lng: ''
    }))
  }

  const handlePlaceSelect = (placeDetails) => {
    if (placeDetails) {
      setFormData(prev => ({
        ...prev,
        address: placeDetails.address,
        lat: placeDetails.lat.toString(),
        lng: placeDetails.lng.toString()
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        lat: '',
        lng: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }

    if (formData.estimatedDuration < 15 || formData.estimatedDuration > 480) {
      newErrors.estimatedDuration = 'Duration must be between 15 minutes and 8 hours'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Clean up the form data
    const submissionData = {
      ...formData,
      estimatedDuration: parseInt(formData.estimatedDuration),
      lat: formData.lat ? parseFloat(formData.lat) : undefined,
      lng: formData.lng ? parseFloat(formData.lng) : undefined,
    }

    // Remove empty preferred date range
    if (!submissionData.preferredDateRange.start && !submissionData.preferredDateRange.end) {
      delete submissionData.preferredDateRange
    }

    onSubmit(submissionData)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <button
          onClick={onCancel}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </button>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Schedule New Inspection</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Address with Autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Address *
            </label>
            <AddressAutocomplete
              value={formData.address}
              onChange={handleAddressChange}
              onPlaceSelect={handlePlaceSelect}
              placeholder="123 Main Street, Brisbane QLD 4000"
              disabled={loading}
              error={errors.address}
            />
            <div className="text-xs text-gray-500 mt-1">
              Start typing to see address suggestions from Google Places
            </div>
          </div>

          {/* Manual Coordinates (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude (optional)
              </label>
              <input
                type="number"
                name="lat"
                value={formData.lat}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="-27.4698"
                step="any"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude (optional)
              </label>
              <input
                type="number"
                name="lng"
                value={formData.lng}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="153.0251"
                step="any"
                disabled={loading}
              />
            </div>
          </div>
          
          <p className="text-xs text-gray-500">
            Coordinates are automatically filled when you select an address from suggestions. 
            You can manually override them if needed.
          </p>

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Customer Name *
            </label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              className={`input w-full ${errors.customerName ? 'border-red-500' : ''}`}
              placeholder="John Smith"
              disabled={loading}
            />
            {errors.customerName && (
              <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
            )}
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Estimated Duration (minutes) *
            </label>
            <select
              name="estimatedDuration"
              value={formData.estimatedDuration}
              onChange={handleInputChange}
              className="input w-full"
              disabled={loading}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
            {errors.estimatedDuration && (
              <p className="mt-1 text-sm text-red-600">{errors.estimatedDuration}</p>
            )}
          </div>

          {/* Date Range Preference (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Date Range (optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="date"
                  name="preferredDateRange.start"
                  value={formData.preferredDateRange.start}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={loading}
                />
              </div>
              <div>
                <input
                  type="date"
                  name="preferredDateRange.end"
                  value={formData.preferredDateRange.end}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to search the next 14 working days
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Notes (optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="input w-full"
              rows={3}
              placeholder="3-bedroom house, pre-purchase inspection, special requirements..."
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Finding Best Slots...
                </>
              ) : (
                'Find Best Slots'
              )}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}