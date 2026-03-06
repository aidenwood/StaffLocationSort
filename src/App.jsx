import React, { useState, useCallback, useMemo } from 'react'
import InspectionDashboard from './components/InspectionDashboard'
import SimpleActivityList from './components/SimpleActivityList'
import ClientBooking from './components/ClientBooking'
import { usePipedriveData } from './hooks/usePipedriveData.js'

function App() {
  const [view, setView] = useState('staff') // 'staff', 'activities', or 'client' (changed default to staff)

  // Shared Pipedrive data - fetched once, consumed by all views
  const pipedriveData = usePipedriveData();

  // Enriched address cache - populated by SimpleActivityList, read by InspectionDashboard
  const [addressCache, setAddressCache] = useState({});

  // Callback for SimpleActivityList to push enriched addresses up
  const onActivitiesEnriched = useCallback((enrichedActivities) => {
    setAddressCache(prev => {
      const updated = { ...prev };
      enrichedActivities.forEach(a => {
        if (a.personAddress) {
          updated[a.id] = a.personAddress;
        }
      });
      return updated;
    });
  }, []);

  // Merge address cache into activities for the dashboard
  const enrichedPipedriveData = useMemo(() => {
    if (Object.keys(addressCache).length === 0) return pipedriveData;

    return {
      ...pipedriveData,
      activities: pipedriveData.activities.map(a =>
        addressCache[a.id] ? { ...a, personAddress: addressCache[a.id] } : a
      )
    };
  }, [pipedriveData, addressCache]);

  // Simple routing based on URL hash or view state
  React.useEffect(() => {
    const hash = window.location.hash
    if (hash === '#book' || hash === '#client') {
      setView('client')
    } else if (hash === '#activities' || hash === '#list') {
      setView('activities')
    } else {
      setView('staff') // Default to staff dashboard
    }
  }, [])

  const switchToClient = () => {
    setView('client')
    window.location.hash = '#book'
  }

  const switchToStaff = () => {
    setView('staff')
    window.location.hash = '#dashboard'
  }

  const switchToActivities = () => {
    setView('activities')
    window.location.hash = '#activities'
  }

  if (view === 'client') {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={switchToStaff}
            className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={switchToActivities}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            Activities
          </button>
        </div>
        <ClientBooking />
      </div>
    )
  }

  if (view === 'activities') {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={switchToStaff}
            className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={switchToClient}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Client Booking
          </button>
        </div>
        <SimpleActivityList pipedriveData={pipedriveData} onActivitiesEnriched={onActivitiesEnriched} />
      </div>
    )
  }

  // Default: Staff Dashboard view
  return (
    <div>
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={switchToActivities}
          className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
        >
          Activities
        </button>
        <button
          onClick={switchToClient}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Client Booking
        </button>
      </div>
      <InspectionDashboard pipedriveData={enrichedPipedriveData} />
    </div>
  )
}

export default App