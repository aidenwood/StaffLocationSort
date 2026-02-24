// Date and time formatting utilities

export const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-AU', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  })
}

export const formatDateShort = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-AU', { 
    day: 'numeric', 
    month: 'short'
  })
}

export const formatTime = (timeStr) => {
  if (!timeStr) return ''
  
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
      return `${hours}h`
    }
    return `${hours}h ${remainingMinutes}m`
  }
}

export const formatDistance = (kilometers) => {
  if (kilometers < 1) {
    return `${Math.round(kilometers * 1000)}m`
  }
  return `${kilometers.toFixed(1)}km`
}

export const getDriveTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600 bg-green-50 border-green-200'
  if (minutes < 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  if (minutes < 45) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

export const getRankBadgeColor = (rank) => {
  if (rank === 1) return 'bg-green-500 text-white'
  if (rank === 2) return 'bg-blue-500 text-white'  
  if (rank === 3) return 'bg-purple-500 text-white'
  return 'bg-gray-500 text-white'
}

export const formatRelativeDate = (dateStr) => {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    const days = Math.round((date - today) / (1000 * 60 * 60 * 24))
    if (days <= 7) {
      return `In ${days} days`
    }
    return formatDate(dateStr)
  }
}