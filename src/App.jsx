import React, { useState } from 'react'
import InspectionDashboard from './components/InspectionDashboard'
import SimpleActivityList from './components/SimpleActivityList'
import ClientBooking from './components/ClientBooking'

function App() {
  const [view, setView] = useState('simple') // 'simple', 'staff' or 'client'

  // Simple routing based on URL hash or view state
  React.useEffect(() => {
    const hash = window.location.hash
    if (hash === '#book' || hash === '#client') {
      setView('client')
    } else if (hash === '#dashboard' || hash === '#staff') {
      setView('staff')
    } else {
      setView('simple')
    }
  }, [])

  const switchToClient = () => {
    setView('client')
    window.location.hash = '#book'
  }

  const switchToStaff = () => {
    setView('staff')
    window.location.hash = '#staff'
  }

  const switchToSimple = () => {
    setView('simple')
    window.location.hash = '#simple'
  }

  if (view === 'client') {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={switchToSimple}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            Simple List
          </button>
          <button
            onClick={switchToStaff}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            Full Dashboard
          </button>
        </div>
        <ClientBooking />
      </div>
    )
  }

  if (view === 'staff') {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={switchToSimple}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            Simple List
          </button>
          <button
            onClick={switchToClient}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Client Booking
          </button>
        </div>
        <InspectionDashboard />
      </div>
    )
  }

  // Default: Simple view
  return (
    <div>
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={switchToStaff}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          Full Dashboard
        </button>
        <button
          onClick={switchToClient}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Client Booking
        </button>
      </div>
      <SimpleActivityList />
    </div>
  )
}

export default App