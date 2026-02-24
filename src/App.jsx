import React, { useState } from 'react'
import InspectionDashboard from './components/InspectionDashboard'
import ClientBooking from './components/ClientBooking'

function App() {
  const [view, setView] = useState('staff') // 'staff' or 'client'

  // Simple routing based on URL hash or view state
  React.useEffect(() => {
    const hash = window.location.hash
    if (hash === '#book' || hash === '#client') {
      setView('client')
    } else {
      setView('staff')
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

  if (view === 'client') {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={switchToStaff}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            Staff Login
          </button>
        </div>
        <ClientBooking />
      </div>
    )
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={switchToClient}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Client Booking
        </button>
      </div>
      <InspectionDashboard />
    </div>
  )
}

export default App