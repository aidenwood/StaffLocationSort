import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, subDays, startOfWeek, getDay } from 'date-fns';
import InspectorView from './InspectorView';
import RoofInspectionBooking from './RoofInspectionBooking';
import ApiDebugConsole from './ApiDebugConsole';
import DealsDebugConsole from './DealsDebugConsole';
import AppUnavailableModal from './AppUnavailableModal';
import HeaderControls from './HeaderControls';
import CalendarContainer from './CalendarContainer';
import MapContainer from './MapContainer';
import DeveloperFooter from "./DeveloperFooter";
import ErrorBoundary from "./ErrorBoundary";
import Toast from './Toast.jsx';
import { useApiDebug } from '../hooks/useApiDebug.js';
import { useToast } from '../hooks/useToast.js';
import useRosterData from '../hooks/useRosterData.js';
import { enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';
import { forceRefreshDeals } from '../api/pipedriveDeals.js';
import { resetCircuitBreaker, getGeocodeStats, clearGeocodeCache } from '../services/geocoding.js';
import { convertToAustralianTime } from '../utils/timezone';

// Helper functions for date navigation - now include weekends
const getNextDay = (date) => {
  return addDays(date, 1);
};

const getPreviousDay = (date) => {
  return subDays(date, 1);
};

const InspectionDashboard = ({ pipedriveData, refreshInspections }) => {
  // Toast notifications
  const { toasts, showToast, hideToast } = useToast();
  
  // Load selectedInspector from localStorage or default to Ben Thompson (ID 2)
  const [selectedInspector, setSelectedInspector] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.selectedInspector');
    return saved ? parseInt(saved, 10) : 2;
  });
  
  // Load selectedDate from localStorage or default to today
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.selectedDate');
    return saved ? new Date(saved) : new Date();
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [potentialBooking, setPotentialBooking] = useState(null);
  const [driveTimeImpact, setDriveTimeImpact] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard');
  const [viewingInspectorId, setViewingInspectorId] = useState(null);
  const [hoveredAppointment, setHoveredAppointment] = useState(null);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [showDealsDebugConsole, setShowDealsDebugConsole] = useState(false);
  
  // Load showOpportunities from localStorage with default true
  const [showOpportunities, setShowOpportunities] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.showOpportunities');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState('split');
  const [dealsToShowOnMap, setDealsToShowOnMap] = useState([]);
  const [dealsConsoleContext, setDealsConsoleContext] = useState(null);
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false);
  
  // Deal stage filter state - saved to localStorage
  const [dealStageFilter, setDealStageFilter] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.dealStageFilter');
    return saved || 'all';
  });

  // Save deal stage filter preference when it changes
  useEffect(() => {
    localStorage.setItem('staffLocationSort.dealStageFilter', dealStageFilter);
  }, [dealStageFilter]);

  // Memoized callback for deals update to prevent infinite loops
  const handleDealsUpdate = useCallback((deals) => {
    setDealsToShowOnMap(deals);
  }, []);

  // API Debug functionality
  const {
    debugData,
    setApiResponse,
    setTransformedData,
    trackApiCall,
    setIsPaused
  } = useApiDebug();

  // USE SHARED PIPEDRIVE DATA from App.jsx
  const {
    activities,
    inspectors: pipedriveInspectors,
    loading,
    error,
    isLiveData,
    isTimeout,
    errorCount,
    lastError,
    isCircuitBreakerOpen,
    resetCircuitBreaker,
    refresh: refetch
  } = pipedriveData;

  // Use shared address cache from App.jsx and merge with local cache
  const [localAddressMap, setLocalAddressMap] = useState({});
  
  // Get shared address cache from localStorage
  const getSharedAddressCache = useCallback(() => {
    try {
      const cached = localStorage.getItem('staffLocationSort.addressCache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      return {};
    }
  }, []);
  
  // State to trigger shared cache refresh
  const [sharedCacheRefresh, setSharedCacheRefresh] = useState(0);
  
  // Combined address map (shared + local) - MEMOIZED to prevent re-renders
  const addressMap = useMemo(() => {
    const sharedCache = getSharedAddressCache();
    const combined = { ...sharedCache, ...localAddressMap };
    return combined;
  }, [localAddressMap, sharedCacheRefresh, getSharedAddressCache]);

  // Save selectedInspector to localStorage when it changes
  useEffect(() => {
    if (selectedInspector !== null) {
      localStorage.setItem('staffLocationSort.selectedInspector', selectedInspector.toString());
    } else {
      localStorage.removeItem('staffLocationSort.selectedInspector');
    }
  }, [selectedInspector]);

  // Save selectedDate to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('staffLocationSort.selectedDate', selectedDate.toISOString());
  }, [selectedDate]);

  // Save showOpportunities to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('staffLocationSort.showOpportunities', JSON.stringify(showOpportunities));
  }, [showOpportunities]);

  // Get roster data for the current week
  const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const endOfCurrentWeek = addDays(startOfCurrentWeek, 6);
  const { rosterData, loading: rosterLoading } = useRosterData(startOfCurrentWeek, endOfCurrentWeek);

  // Get all inspector activities (for enrichment) - MEMOIZED
  const inspectorActivities = useMemo(() => {
    if (!activities) return [];
    
    return activities.filter(a => {
      const matchesInspector = selectedInspector === null || Number(a.owner_id) === Number(selectedInspector);
      
      return matchesInspector && !a.done &&
        a.due_time && a.due_time !== '00:00:00' &&
        !(a.subject && a.subject.includes('Inspector ENG Follow up'));
    });
  }, [activities, selectedInspector]);

  // Auto-select first date with activities ONLY on initial load (not inspector changes)
  const [hasInitializedDate, setHasInitializedDate] = useState(false);
  
  useEffect(() => {
    if (inspectorActivities.length === 0 || hasInitializedDate) return;

    const sorted = [...inspectorActivities].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    const today = format(new Date(), 'yyyy-MM-dd');
    const nextActivity = sorted.find(a => a.due_date >= today) || sorted[0];
    if (nextActivity?.due_date) {
      const [y, m, d] = nextActivity.due_date.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      setSelectedDate(newDate);
      setHasInitializedDate(true); // Only run once
    }
  }, [inspectorActivities, hasInitializedDate]);

  // Enrich activities that don't already have coordinates from App.jsx
  useEffect(() => {
    if (inspectorActivities.length === 0) return;
    
    // Only enrich activities that don't already have coordinates
    const unenriched = inspectorActivities.filter(a => !a.coordinates && !addressMap[a.id]);
    if (unenriched.length === 0) return;

    const doEnrich = async () => {
      try {
        setOpportunitiesLoading(true);
        const enriched = await enrichActivitiesWithAddresses(unenriched);
        
        // Update local state
        setLocalAddressMap(prev => {
          const updated = { ...prev };
          enriched.forEach(a => {
            if (a.personAddress) {
              updated[a.id] = {
                personAddress: a.personAddress,
                coordinates: a.coordinates,
                lat: a.lat,
                lng: a.lng,
                addressSource: a.addressSource,
                label: a.label
              };
            }
          });
          return updated;
        });
        
        // Also update shared address cache in localStorage
        try {
          const sharedCache = getSharedAddressCache();
          enriched.forEach(a => {
            if (a.personAddress) {
              sharedCache[a.id] = {
                personAddress: a.personAddress,
                coordinates: a.coordinates,
                lat: a.lat,
                lng: a.lng,
                addressSource: a.addressSource,
                label: a.label
              };
            }
          });
          localStorage.setItem('staffLocationSort.addressCache', JSON.stringify(sharedCache));
        } catch (error) {
          // Silent fail
        }
        
        // Auto-enable opportunities after successful enrichment
        setTimeout(() => {
          setShowOpportunities(true);
          setOpportunitiesLoading(false);
        }, 1000);
      } catch (err) {
        setOpportunitiesLoading(false);
      }
    };
    doEnrich();
  }, [inspectorActivities, addressMap, getSharedAddressCache]);

  // Merge addresses into all activities for calendar + map, preserving existing coordinates - MEMOIZED
  const enrichedActivities = useMemo(() => {
    return activities.map(a => {
      // If activity already has coordinates from App.jsx, keep them
      if (a.coordinates) {
        return a;
      }
      
      // Otherwise, add enriched data from addressMap if available
      if (addressMap[a.id]) {
        const enrichedData = addressMap[a.id];
        return {
          ...a,
          personAddress: enrichedData.personAddress,
          coordinates: enrichedData.coordinates,
          lat: enrichedData.lat,
          lng: enrichedData.lng,
          addressSource: enrichedData.addressSource,
          label: enrichedData.label
        };
      }
      
      return a;
    });
  }, [activities, addressMap]);

  // Get enriched day activities for the map (inspector-specific) - MEMOIZED
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  
  const enrichedMapActivities = useMemo(() => {
    const filtered = enrichedActivities.filter(a => {
      const matchesInspector = selectedInspector === null || Number(a.owner_id) === Number(selectedInspector);
      
      // Get timezone-adjusted date for this activity
      let adjustedDate = a.due_date;
      if (a.due_time && a.due_time !== '00:00:00') {
        const converted = convertToAustralianTime(a.due_time, 'QLD');
        if (converted.crossedMidnight) {
          const date = new Date(a.due_date);
          date.setDate(date.getDate() + 1);
          adjustedDate = format(date, 'yyyy-MM-dd');
        }
      }
      
      const dateMatch = adjustedDate === dateString;
      
      return matchesInspector &&
        dateMatch &&
        !a.done &&
        a.due_time && a.due_time !== '00:00:00' &&
        !(a.subject && a.subject.includes('Inspector ENG Follow up'));
    });
    
    return filtered;
  }, [enrichedActivities, selectedInspector, dateString]);

  const handleTimeSlotSelection = useCallback((slotData) => {
    setSelectedTimeSlot(slotData);
    setShowBookingForm(true);
    
    // Create potential booking for map visualization
    setPotentialBooking({
      datetime: slotData.datetime,
      inspector: slotData.inspector,
      property_address: '',
    });
  }, []);

  const handleBookingCancel = useCallback(() => {
    setShowBookingForm(false);
    setSelectedTimeSlot(null);
    setPotentialBooking(null);
    setDriveTimeImpact(null);
  }, []);

  const handleBookingConfirm = useCallback((newActivity) => {
    handleBookingCancel();
    alert('Booking confirmed successfully!');
  }, [handleBookingCancel]);

  const handleLocationUpdate = useCallback((address) => {
    if (potentialBooking && address) {
      setPotentialBooking(prev => ({
        ...prev,
        property_address: address
      }));
    }
  }, [potentialBooking]);

  const handleDriveTimeCalculated = useCallback((impact) => {
    setDriveTimeImpact(impact);
  }, []);

  const handleInspectorView = useCallback((inspectorId) => {
    setViewingInspectorId(inspectorId);
    setViewMode('inspector');
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setViewMode('dashboard');
    setViewingInspectorId(null);
  }, []);

  const handleAppointmentHover = useCallback((appointment) => {
    setHoveredAppointment(appointment);
  }, []);

  const handleAppointmentLeave = useCallback(() => {
    setHoveredAppointment(null);
  }, []);

  const handleDateChange = useCallback((newDate) => {
    setSelectedDate(newDate);
  }, []);

  const handleRetryConnection = useCallback(() => {
    resetCircuitBreaker();
    refetch();
  }, [resetCircuitBreaker, refetch]);

  const handleShowDealsDebugConsole = useCallback((date, timeSlot = null, radius = null) => {
    if (date) {
      setSelectedDate(date);
    }
    
    // Set context for deals console title and radius
    if (timeSlot && date) {
      const contextInfo = {
        timeSlot,
        date,
        radius,
        formattedTime: timeSlot ? timeSlot.substring(0, 5) : null,
        formattedDate: format(date, 'do \'of\' MMMM'),
        regionCenter: null
      };
      setDealsConsoleContext(contextInfo);
    } else {
      setDealsConsoleContext(null);
    }
    
    setShowDealsDebugConsole(true);
  }, []);

  // Show inspector view if selected
  if (viewMode === 'inspector' && viewingInspectorId) {
    return (
      <InspectorView 
        inspectorId={viewingInspectorId} 
        onBack={handleBackToDashboard}
      />
    );
  }

  // Calculate dashboard stats using REAL data  
  const todaysActivities = activities ? activities.filter(activity => {
    return activity.due_date === format(selectedDate, 'yyyy-MM-dd');
  }) : [];
  const totalActivities = activities ? activities.length : 0;
  const completedActivities = activities ? activities.filter(a => a.done).length : 0;

  // Refresh functions
  const handleRefreshInspections = useCallback(async () => {
    const loadingToastId = showToast('Refreshing inspections...', 'loading');
    try {
      const result = await refreshInspections();
      const newCount = result?.activities?.length || 0;
      
      // Count activities that need geocoding
      const activitiesNeedingGeocode = activities?.filter(a => 
        a.personAddress && !a.coordinates
      ) || [];
      
      hideToast(loadingToastId);
      
      if (activitiesNeedingGeocode.length > 0) {
        showToast(`Found ${newCount} inspections (${activitiesNeedingGeocode.length} need geocoding)`, 'success');
      } else {
        showToast(`Found ${newCount} inspections`, 'success');
      }
    } catch (error) {
      hideToast(loadingToastId);
      showToast('Failed to refresh inspections', 'error');
    }
  }, [refreshInspections, activities, showToast, hideToast]);

  const handleRefreshDeals = useCallback(async () => {
    const loadingToastId = showToast('Refreshing deals & geocoding...', 'loading');
    try {
      // Check geocoding stats first
      const geocodeStats = getGeocodeStats();
      
      // Only reset circuit breaker and clear cache if there were failures
      if (geocodeStats.circuitBreakerTripped || geocodeStats.consecutiveFailures > 0) {
        resetCircuitBreaker();
        clearGeocodeCache();
      }
      
      // Determine current region based on selected inspector
      const inspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
      const region = inspector?.region || 'R01';
      
      const result = await forceRefreshDeals(region);
      
      const message = result.newDeals > 0 
        ? `Found ${result.newDeals} new deals (${result.totalDeals} total)` 
        : `Refreshed ${result.totalDeals} deals`;
      
      hideToast(loadingToastId);
      showToast(message, 'success');
    } catch (error) {
      hideToast(loadingToastId);
      showToast('Failed to refresh deals', 'error');
    }
  }, [selectedInspector, pipedriveInspectors, showToast, hideToast]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header Controls */}
      <HeaderControls
        selectedInspector={selectedInspector}
        setSelectedInspector={setSelectedInspector}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        pipedriveInspectors={pipedriveInspectors}
        mobileViewMode={mobileViewMode}
        setMobileViewMode={setMobileViewMode}
        isLiveData={isLiveData}
        showOpportunities={showOpportunities}
        setShowOpportunities={setShowOpportunities}
        opportunitiesLoading={opportunitiesLoading}
        getPreviousDay={getPreviousDay}
        getNextDay={getNextDay}
      />

      {/* Main Content - Responsive Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Calendar Section */}
        <ErrorBoundary>
          <CalendarContainer
            selectedInspector={selectedInspector}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onSelectTimeSlot={handleTimeSlotSelection}
            hoveredAppointment={hoveredAppointment}
            onAppointmentHover={handleAppointmentHover}
            onAppointmentLeave={handleAppointmentLeave}
            enrichedActivities={enrichedActivities}
            pipedriveInspectors={pipedriveInspectors}
            isLiveData={isLiveData}
            loading={loading}
            isTimeout={isTimeout}
            error={error}
            showOpportunities={showOpportunities}
            onShowDealsDebugConsole={handleShowDealsDebugConsole}
            rosterData={rosterData}
            mobileViewMode={mobileViewMode}
          />
        </ErrorBoundary>

        {/* Map Section */}
        <ErrorBoundary>
          <MapContainer
            mobileViewMode={mobileViewMode}
            driveTimeImpact={driveTimeImpact}
            potentialBooking={potentialBooking}
            selectedInspector={selectedInspector}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onDriveTimeCalculated={handleDriveTimeCalculated}
            hoveredAppointment={hoveredAppointment}
            onAppointmentHover={handleAppointmentHover}
            onAppointmentLeave={handleAppointmentLeave}
            enrichedActivities={enrichedActivities}
            enrichedMapActivities={enrichedMapActivities}
            isLiveData={isLiveData}
            loading={loading}
            isTimeout={isTimeout}
            error={error}
            dealsToShowOnMap={dealsToShowOnMap}
            pipedriveInspectors={pipedriveInspectors}
          />
        </ErrorBoundary>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <RoofInspectionBooking
          selectedSlot={selectedTimeSlot}
          onBookingConfirm={handleBookingConfirm}
          onCancel={handleBookingCancel}
          onLocationUpdate={handleLocationUpdate}
        />
      )}

      {/* API Debug Console */}
      <ApiDebugConsole
        isOpen={showDebugConsole}
        onClose={() => setShowDebugConsole(false)}
        debugData={debugData}
        onPauseChange={setIsPaused}
        activities={activities}
        inspectors={pipedriveInspectors}
        selectedInspector={selectedInspector}
        loading={loading}
        error={error}
        isLiveData={isLiveData}
      />

      {/* Deals Debug Console */}
      <DealsDebugConsole
        isOpen={showDealsDebugConsole}
        onClose={() => {
          setShowDealsDebugConsole(false);
          setDealsToShowOnMap([]);
          setDealsConsoleContext(null);
        }}
        selectedInspector={selectedInspector}
        inspectors={pipedriveInspectors}
        selectedDate={selectedDate}
        inspectionActivities={enrichedMapActivities}
        viewMode={mobileViewMode}
        onDealsUpdate={handleDealsUpdate}
        context={dealsConsoleContext}
        dealStageFilter={dealStageFilter}
      />

      {/* App Unavailable Modal */}
      <AppUnavailableModal
        isOpen={isCircuitBreakerOpen}
        onRetry={handleRetryConnection}
        errorCount={errorCount}
        lastError={lastError}
      />

      {/* Developer Footer */}
      <DeveloperFooter
        dealStageFilter={dealStageFilter}
        setDealStageFilter={setDealStageFilter}
        setShowBookingForm={setShowBookingForm}
        showDebugConsole={showDebugConsole}
        setShowDebugConsole={setShowDebugConsole}
        showDealsDebugConsole={showDealsDebugConsole}
        setShowDealsDebugConsole={setShowDealsDebugConsole}
        handleRefreshInspections={handleRefreshInspections}
        handleRefreshDeals={handleRefreshDeals}
        showDeveloperMenu={showDeveloperMenu}
        setShowDeveloperMenu={setShowDeveloperMenu}
        debugData={debugData}
        totalActivities={totalActivities}
        pipedriveInspectors={pipedriveInspectors}
        error={error}
      />

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default InspectionDashboard;