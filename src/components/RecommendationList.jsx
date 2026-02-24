import { useState } from 'react'
import { ArrowLeft, Plus, MapPin, Clock, Zap } from 'lucide-react'
import RecommendationCard from './RecommendationCard'

export default function RecommendationList({ recommendations, meta, onBack, onNewInspection }) {
  const [selectedRecommendation, setSelectedRecommendation] = useState(null)
  const [bookingStatus, setBookingStatus] = useState(null)

  const handleBook = async (recommendation) => {
    // For MVP, just show a success message
    // In full implementation, this would call the booking API
    setSelectedRecommendation(recommendation)
    setBookingStatus('booking')
    
    // Simulate booking API call
    setTimeout(() => {
      setBookingStatus('success')
    }, 2000)
  }

  const handleBookingComplete = () => {
    setSelectedRecommendation(null)
    setBookingStatus(null)
    onBack()
  }

  if (bookingStatus === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Inspection Booked Successfully!
          </h2>
          
          <p className="text-gray-600 mb-6">
            The inspection has been scheduled with {selectedRecommendation?.inspectorName} on{' '}
            {new Date(selectedRecommendation?.date).toLocaleDateString('en-AU', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })} at {selectedRecommendation?.suggestedTime}.
          </p>
          
          <div className="flex space-x-4 justify-center">
            <button
              onClick={handleBookingComplete}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
            
            <button
              onClick={onNewInspection}
              className="btn-secondary"
            >
              Schedule Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (bookingStatus === 'booking') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Booking Inspection...
          </h2>
          
          <p className="text-gray-600">
            Creating your inspection appointment in Pipedrive
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900">
            Recommended Time Slots
          </h1>
        </div>
        
        <button
          onClick={onNewInspection}
          className="btn-secondary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Inspection
        </button>
      </div>

      {/* Meta Information */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center text-gray-600 mb-2">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Processing Time</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{meta?.computeTimeMs}ms</p>
        </div>
        
        <div className="card">
          <div className="flex items-center text-gray-600 mb-2">
            <Zap className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Slots Evaluated</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{meta?.slotsEvaluated}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center text-gray-600 mb-2">
            <MapPin className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Drive Time Source</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {meta?.driveTimeSource === 'google_maps' ? 'Google Maps' : 'Haversine Estimate'}
          </p>
        </div>
        
        <div className="card">
          <div className="flex items-center text-gray-600 mb-2">
            <span className="text-sm font-medium">Best Recommendation</span>
          </div>
          <p className="text-lg font-bold text-primary-600">
            +{recommendations[0]?.marginalDriveTime} min
          </p>
        </div>
      </div>

      {/* No Results */}
      {recommendations.length === 0 && (
        <div className="card text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Available Slots Found
          </h3>
          
          <p className="text-gray-600 mb-6">
            All inspectors are fully booked during the selected time period. 
            Try extending the date range or check back later.
          </p>
          
          <button
            onClick={onNewInspection}
            className="btn-primary"
          >
            Try Different Dates
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-6">
          <div className="text-sm text-gray-500 mb-4">
            Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}, 
            ranked by drive time efficiency
          </div>
          
          {recommendations.map((recommendation, index) => (
            <RecommendationCard
              key={`${recommendation.inspectorId}-${recommendation.date}-${recommendation.suggestedTime}`}
              recommendation={recommendation}
              rank={index + 1}
              onBook={handleBook}
            />
          ))}
          
          {recommendations.length >= 10 && (
            <div className="text-center text-sm text-gray-500 mt-6 p-4 bg-gray-50 rounded-lg">
              Showing top 10 recommendations. The optimization considered all available slots 
              across {meta?.slotsEvaluated} possibilities.
            </div>
          )}
        </div>
      )}
    </div>
  )
}