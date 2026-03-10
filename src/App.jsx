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

  // Simple routing based on URL hash or view state
  React.useEffect(() => {
    const updateViewFromHash = () => {
      const hash = window.location.hash
      if (hash === '#book' || hash === '#client') {
        setView('client')
      } else if (hash === '#activities' || hash === '#list') {
        setView('activities')
      } else {
        setView('staff') // Default to staff dashboard
      }
    }

    // Initial load
    updateViewFromHash()

    // Listen for hash changes
    window.addEventListener('hashchange', updateViewFromHash)
    
    return () => {
      window.removeEventListener('hashchange', updateViewFromHash)
    }
  }, [])


  if (view === 'client') {
    return <ClientBooking />
  }

  if (view === 'activities') {
    return <SimpleActivityList pipedriveData={pipedriveData} onActivitiesEnriched={onActivitiesEnriched} />
  }

  // Default: Staff Dashboard view
  return <InspectionDashboard pipedriveData={enrichedPipedriveData} />
}

export default App