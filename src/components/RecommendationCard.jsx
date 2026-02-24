import { User, Calendar, Clock, Car, MapPin } from 'lucide-react'

export default function RecommendationCard({ recommendation, rank, onBook }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    })
  }

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getDriveTimeColor = (minutes) => {
    if (minutes < 15) return 'text-green-600 bg-green-50 border-green-200'
    if (minutes < 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (minutes < 45) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return 'bg-green-500 text-white'
    if (rank === 2) return 'bg-blue-500 text-white'
    if (rank === 3) return 'bg-purple-500 text-white'
    return 'bg-gray-500 text-white'
  }

  return (
    <div className="card hover:shadow-lg transition-shadow border-l-4 border-l-primary-500">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadgeColor(rank)} mr-3`}>
            #{rank}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-gray-600" />
              {recommendation.inspectorName}
            </h3>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getDriveTimeColor(recommendation.marginalDriveTime)}`}>
          +{recommendation.marginalDriveTime} min driving
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <div>
            <div className="font-medium text-gray-900">
              {formatDate(recommendation.date)}
            </div>
            <div className="text-sm text-gray-500">
              {recommendation.existingBookingsCount} other inspections
            </div>
          </div>
        </div>

        <div className="flex items-center text-gray-600">
          <Clock className="w-4 h-4 mr-2" />
          <div>
            <div className="text-xl font-bold text-primary-600">
              {formatTime(recommendation.suggestedTime)}
            </div>
            <div className="text-sm text-gray-500">
              Suggested time
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center text-gray-600 mb-4">
        <Car className="w-4 h-4 mr-2" />
        <div className="text-sm">
          <span className="font-medium">Total day driving:</span> {recommendation.totalDayDriveTime} minutes
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-sm text-gray-700">
          {recommendation.reasoning}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Optimization score: {recommendation.score}
        </div>
        
        <button
          onClick={() => onBook(recommendation)}
          className="btn-primary"
        >
          Book This Slot
        </button>
      </div>
    </div>
  )
}