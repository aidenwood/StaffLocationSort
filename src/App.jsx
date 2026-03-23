import React, { useState, useCallback, useMemo, useEffect } from 'react'
import InspectionDashboard from './components/InspectionDashboard'
import SimpleActivityList from './components/SimpleActivityList'
import ClientBooking from './components/ClientBooking'
import AvailabilityGrid from './components/AvailabilityGrid'
import AreaDamageEstimator from './components/AreaDamageEstimator'
import { usePipedriveData } from './hooks/usePipedriveData.js'
import { enrichActivitiesWithAddresses } from './api/pipedriveRead.js'

function App() {
  const [view, setView] = useState('staff') // 'staff', 'activities', 'client', 'grid', or 'estimator'
  console.log('🚀 App current view:', view, 'hash:', window.location.hash);

  // Shared Pipedrive data - fetched once, consumed by all views
  const pipedriveData = usePipedriveData();

  // Enriched address cache - populated by SimpleActivityList, read by InspectionDashboard
  const [addressCache, setAddressCache] = useState(() => {
    try {
      const cached = localStorage.getItem('staffLocationSort.addressCache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Error loading address cache:', error);
      return {};
    }
  });
  const [autoEnriching, setAutoEnriching] = useState(false);

  // Removed shared state management to fix infinite loading issues
  // Each component will manage its own state with localStorage persistence

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
      // Save to localStorage
      try {
        localStorage.setItem('staffLocationSort.addressCache', JSON.stringify(updated));
      } catch (error) {
        console.warn('Error saving address cache:', error);
      }
      
      return updated;
    });
    
    // Log for debugging
    const withCoordinates = enrichedActivities.filter(a => a.coordinates).length;
    console.log(`📍 App.jsx: Cached ${withCoordinates}/${enrichedActivities.length} activities with coordinates`);
  }, []);

  // Removed auto-enrichment to prevent infinite loading loops
  // Components will handle their own enrichment as needed

  // Merge address cache into activities for the dashboard
  const enrichedPipedriveData = useMemo(() => {
    console.log(`📦 App.jsx: addressCache has ${Object.keys(addressCache).length} entries`);
    if (Object.keys(addressCache).length === 0) {
      console.log('⚠️ App.jsx: No addressCache data, returning raw pipedriveData');
      return pipedriveData;
    }

    const enrichedActivities = pipedriveData.activities.map(a => {
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
    });

    const enrichedCount = enrichedActivities.filter(a => a.coordinates || a.lat).length;
    console.log(`✅ App.jsx: Enriched ${enrichedCount}/${enrichedActivities.length} activities with coordinates`);

    return {
      ...pipedriveData,
      activities: enrichedActivities
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

  const switchToEstimator = () => {
    setView('estimator')
    window.location.hash = '#estimator'
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
      } else if (hash === '#estimator') {
        setView('estimator')
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

  if (view === 'estimator') {
    return <AreaDamageEstimator />
  }

  // Default: Staff Dashboard view
  return <InspectionDashboard pipedriveData={enrichedPipedriveData} />
}

export default App