import React, { useState, useCallback, useMemo } from 'react'
import InspectionDashboard from './components/InspectionDashboard'
import SimpleActivityList from './components/SimpleActivityList'
import ClientBooking from './components/ClientBooking'
import AvailabilityGrid from './components/AvailabilityGrid'
import { usePipedriveData } from './hooks/usePipedriveData.js'

function App() {
  const [view, setView] = useState('staff') // 'staff', 'activities', 'client', or 'grid'

  // Shared Pipedrive data - fetched once, consumed by all views
  const pipedriveData = usePipedriveData();

  // Enriched address cache - populated by SimpleActivityList, read by InspectionDashboard
  const [addressCache, setAddressCache] = useState({});

  // Callback for SimpleActivityList to push enriched addresses up
  const onActivitiesEnriched = useCallback((enrichedActivities) => {
    setAddressCache(prev => {
      const updated = { ...prev };
      enrichedActivities.forEach(a => {
        if (a.personAddress || a.coordinates) {
          // Store full enriched data including coordinates
          updated[a.id] = {
            personAddress: a.personAddress,
            coordinates: a.coordinates,
            lat: a.lat,
            lng: a.lng,
            addressSource: a.addressSource
          };
        }
      });
      return updated;
    });
    
    // Log for debugging
    const withCoordinates = enrichedActivities.filter(a => a.coordinates).length;
    console.log(`📍 App.jsx: Cached ${withCoordinates}/${enrichedActivities.length} activities with coordinates`);
  }, []);

  // Merge address cache into activities for the dashboard
  const enrichedPipedriveData = useMemo(() => {
    if (Object.keys(addressCache).length === 0) return pipedriveData;

    return {
      ...pipedriveData,
      activities: pipedriveData.activities.map(a => {
        if (addressCache[a.id]) {
          const enrichedData = addressCache[a.id];
          return {
            ...a,
            personAddress: enrichedData.personAddress,
            coordinates: enrichedData.coordinates,
            lat: enrichedData.lat,
            lng: enrichedData.lng,
            addressSource: enrichedData.addressSource
          };
        }
        return a;
      })
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

  const switchToGrid = () => {
    setView('grid')
    window.location.hash = '#grid'
  }

  // Simple routing based on URL hash or view state
  React.useEffect(() => {
    const updateViewFromHash = () => {
      const hash = window.location.hash
      if (hash === '#book' || hash === '#client') {
        setView('client')
      } else if (hash === '#activities' || hash === '#list') {
        setView('activities')
      } else if (hash === '#grid') {
        setView('grid')
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

  if (view === 'grid') {
    return <AvailabilityGrid pipedriveData={enrichedPipedriveData} />
  }

  // Default: Staff Dashboard view
  return <InspectionDashboard pipedriveData={enrichedPipedriveData} />
}

export default App