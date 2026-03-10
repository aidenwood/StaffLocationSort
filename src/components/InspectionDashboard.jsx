import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  Plus,
  CheckCircle,
  AlertCircle,
  Bug,
  Maximize2,
  Columns2,
  Map,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import InspectorCalendar from './InspectorCalendar';
import InspectorView from './InspectorView';
import RoofInspectionBooking from './RoofInspectionBooking';
import GoogleMapsView from './GoogleMapsView';
import ApiDebugConsole from './ApiDebugConsole';
import AppUnavailableModal from './AppUnavailableModal';
import { inspectors } from '../data/mockActivities';
import { useApiDebug } from '../hooks/useApiDebug.js';
import { enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';

const InspectionDashboard = ({ pipedriveData }) => {
  const [selectedInspector, setSelectedInspector] = useState(2); // Ben Thompson (ID 2) for consistency with working Activities page
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [potentialBooking, setPotentialBooking] = useState(null);
  const [driveTimeImpact, setDriveTimeImpact] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'inspector'
  const [viewingInspectorId, setViewingInspectorId] = useState(null);
  const [hoveredAppointment, setHoveredAppointment] = useState(null);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState('split'); // 'split', 'calendar', 'map'

  // API Debug functionality
  const {
    debugData,
    setApiResponse,
    setTransformedData,
    trackApiCall,
    setIsPaused
  } = useApiDebug();

  // USE SHARED PIPEDRIVE DATA from App.jsx (no API calls in this component)
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

  // Address cache keyed by activity id
  const [addressMap, setAddressMap] = useState({});

  // Get all inspector activities (for enrichment)
  const inspectorActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(a =>
      Number(a.owner_id) === Number(selectedInspector) && !a.done &&
      a.due_time && a.due_time !== '00:00:00' &&
      !(a.subject && a.subject.includes('Inspector ENG Follow up'))
    );
  }, [activities, selectedInspector]);

  // Auto-select first date with activities for this inspector
  useEffect(() => {
    if (inspectorActivities.length === 0) return;

    const sorted = [...inspectorActivities].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    const today = format(new Date(), 'yyyy-MM-dd');
    const nextActivity = sorted.find(a => a.due_date >= today) || sorted[0];
    if (nextActivity?.due_date) {
      const [y, m, d] = nextActivity.due_date.split('-').map(Number);
      setSelectedDate(new Date(y, m - 1, d));
    }
  }, [inspectorActivities]);

  // Enrich all inspector activities with addresses (typically ~16-20 activities)
  useEffect(() => {
    if (inspectorActivities.length === 0) return;
    // Skip if all already enriched
    const unenriched = inspectorActivities.filter(a => !addressMap[a.id]);
    if (unenriched.length === 0) return;

    const doEnrich = async () => {
      try {
        const enriched = await enrichActivitiesWithAddresses(unenriched);
        setAddressMap(prev => {
          const updated = { ...prev };
          enriched.forEach(a => {
            if (a.personAddress) updated[a.id] = a.personAddress;
          });
          return updated;
        });
      } catch (err) {
        console.error('Address enrichment failed:', err);
      }
    };
    doEnrich();
  }, [inspectorActivities]);

  // Merge addresses into all activities for calendar + map
  const enrichedActivities = useMemo(() => {
    if (Object.keys(addressMap).length === 0) return activities;
    return activities.map(a => addressMap[a.id] ? { ...a, personAddress: addressMap[a.id] } : a);
  }, [activities, addressMap]);

  // Get enriched day activities for the map
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const enrichedMapActivities = useMemo(() => {
    return enrichedActivities.filter(a =>
      Number(a.owner_id) === Number(selectedInspector) &&
      a.due_date === dateString &&
      !a.done &&
      a.due_time && a.due_time !== '00:00:00' &&
      !(a.subject && a.subject.includes('Inspector ENG Follow up'))
    );
  }, [enrichedActivities, selectedInspector, dateString]);

  const handleTimeSlotSelection = (slotData) => {
    setSelectedTimeSlot(slotData);
    setShowBookingForm(true);
    
    // Create potential booking for map visualization
    setPotentialBooking({
      datetime: slotData.datetime,
      inspector: slotData.inspector,
      property_address: '', // Will be updated when user enters address
    });
  };

  const handleBookingCancel = () => {
    setShowBookingForm(false);
    setSelectedTimeSlot(null);
    setPotentialBooking(null);
    setDriveTimeImpact(null);
  };

  const handleBookingConfirm = (newActivity) => {
    // In a real app, this would save to Pipedrive API
    console.log('New booking confirmed:', newActivity);
    
    // Close the booking form
    handleBookingCancel();
    
    // Show success message (could be a toast notification)
    alert('Booking confirmed successfully!');
  };

  const handleLocationUpdate = (address) => {
    if (potentialBooking && address) {
      setPotentialBooking(prev => ({
        ...prev,
        property_address: address
      }));
    }
  };

  const handleDriveTimeCalculated = (impact) => {
    setDriveTimeImpact(impact);
  };

  const handleInspectorView = (inspectorId) => {
    setViewingInspectorId(inspectorId);
    setViewMode('inspector');
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setViewingInspectorId(null);
  };

  const handleAppointmentHover = (appointment) => {
    setHoveredAppointment(appointment);
  };

  const handleAppointmentLeave = () => {
    setHoveredAppointment(null);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const handleRetryConnection = () => {
    resetCircuitBreaker();
    refetch(); // Refetch REAL data
  };

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
    return activity.due_date === selectedDate.toISOString().split('T')[0];
  }) : [];
  const totalActivities = activities ? activities.length : 0;
  const completedActivities = activities ? activities.filter(a => a.done).length : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header - Figma Style */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-gray-900">
              Inspector Dashboard
            </h1>
            <div className="w-px h-4 bg-gray-300"></div>
            <span className="text-xs text-gray-500">
              Pipedrive Activities
            </span>
          </div>

          {/* Center Left: Date Control */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => handleDateChange(subDays(selectedDate, 1))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="px-2 py-1 text-xs text-gray-700 min-w-max">
              {format(selectedDate, 'EEE, MMM d')}
            </span>
            <button
              onClick={() => handleDateChange(addDays(selectedDate, 1))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* Center Right: View Mode Controls */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setMobileViewMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'split'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Split View"
            >
              <Columns2 className="w-3 h-3" />
              <span className="hidden md:inline text-xs">Split</span>
            </button>
            <button
              onClick={() => setMobileViewMode('calendar')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Calendar Only"
            >
              <Calendar className="w-3 h-3" />
              <span className="hidden md:inline text-xs">Calendar</span>
            </button>
            <button
              onClick={() => setMobileViewMode('map')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Map Only"
            >
              <Map className="w-3 h-3" />
              <Maximize2 className="w-2.5 h-2.5" />
              <span className="hidden md:inline text-xs">Map</span>
            </button>
          </div>

          {/* Right: Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs text-gray-500">
                {isLiveData ? 'Live' : 'Mock'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-auto">
        {/* Calendar Section */}
        <div className={`min-w-0 ${
          mobileViewMode === 'map' 
            ? 'hidden'
            : mobileViewMode === 'split'
              ? 'flex-1 min-h-[50vh] lg:w-1/2'
              : 'flex-1'
        }`}>
          <InspectorCalendar
            selectedInspector={selectedInspector}
            selectedDate={selectedDate}
            onInspectorChange={setSelectedInspector}
            onDateChange={null}
            onSelectTimeSlot={handleTimeSlotSelection}
            fullScreen={true}
            hoveredAppointment={hoveredAppointment}
            onAppointmentHover={handleAppointmentHover}
            onAppointmentLeave={handleAppointmentLeave}
            activities={enrichedActivities}
            inspectors={pipedriveInspectors}
            isLiveData={isLiveData}
            loading={loading}
            isTimeout={isTimeout}
            error={error}
            hideNavigation={true}
          />
        </div>

        {/* Map Section */}
        <div className={`flex flex-col gap-4 min-w-0 ${
          mobileViewMode === 'calendar'
            ? 'hidden'
            : mobileViewMode === 'split'
              ? 'flex-1 min-h-[50vh] lg:w-1/2'
              : 'flex-1'
        }`}>
          {/* Drive Time Impact */}
          {driveTimeImpact && potentialBooking && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Route Impact Analysis
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {driveTimeImpact.driveTimeToPrev && (
                  <div className="text-center">
                    <div className="text-gray-600">From Previous</div>
                    <div className="font-semibold text-lg">{Math.round(driveTimeImpact.driveTimeToPrev)}m</div>
                  </div>
                )}
                {driveTimeImpact.driveTimeToNext && (
                  <div className="text-center">
                    <div className="text-gray-600">To Next</div>
                    <div className="font-semibold text-lg">{Math.round(driveTimeImpact.driveTimeToNext)}m</div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className={`text-center font-semibold ${
                  driveTimeImpact.totalDriveTimeChange > 0 ? 'text-red-600' : 
                  driveTimeImpact.totalDriveTimeChange < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  Total Change: {driveTimeImpact.totalDriveTimeChange >= 0 ? '+' : ''}
                  {Math.round(driveTimeImpact.totalDriveTimeChange)}m
                </div>
                <div className={`text-xs text-center mt-2 p-2 rounded ${
                  driveTimeImpact.totalDriveTimeChange > 15 ? 'bg-red-50 text-red-700' :
                  driveTimeImpact.totalDriveTimeChange > 0 ? 'bg-amber-50 text-amber-700' :
                  'bg-green-50 text-green-700'
                }`}>
                  {driveTimeImpact.totalDriveTimeChange > 15 
                    ? 'Significant increase in drive time'
                    : driveTimeImpact.totalDriveTimeChange > 0 
                      ? 'Minor increase in drive time'
                      : 'Good scheduling - minimal impact'}
                </div>
              </div>
            </div>
          )}

          {/* Map View */}
          <div className={`${
            mobileViewMode === 'split' 
              ? 'flex-1 min-h-[40vh]' // Responsive height in split mode
              : 'flex-1'
          }`}>
            <GoogleMapsView
              selectedInspector={selectedInspector}
              selectedDate={selectedDate}
              onDateChange={null}
              potentialBooking={potentialBooking}
              onDriveTimeCalculated={handleDriveTimeCalculated}
              hoveredAppointment={hoveredAppointment}
              onAppointmentHover={handleAppointmentHover}
              onAppointmentLeave={handleAppointmentLeave}
              activities={enrichedActivities}
              enrichedDayActivities={enrichedMapActivities}
              isLiveData={isLiveData}
              loading={loading}
              isTimeout={isTimeout}
              error={error}
            />
          </div>

        </div>
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

      {/* App Unavailable Modal */}
      <AppUnavailableModal
        isOpen={isCircuitBreakerOpen}
        onRetry={handleRetryConnection}
        errorCount={errorCount}
        lastError={lastError}
      />

      {/* Developer Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-2 sm:px-4 py-2 flex-shrink-0">
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <a
                href="/#activities"
                className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
              >
                <Users className="w-3 h-3" />
              </a>
              <a
                href="/#book"
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              >
                <Calendar className="w-3 h-3" />
              </a>
              <button
                onClick={() => setShowBookingForm(true)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowDebugConsole(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                title="API Debug Console"
              >
                <Bug className="w-3 h-3" />
                {debugData.consoleLogs?.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1">
                    {debugData.consoleLogs.length}
                  </span>
                )}
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {activities?.length || 0}
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pages:</span>
              <a
                href="/#activities"
                className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
              >
                <Users className="w-3 h-3" />
                Activities
              </a>
              <a
                href="/#book"
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              >
                <Calendar className="w-3 h-3" />
                Book
              </a>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Developer Tools:</span>
              <button
                onClick={() => setShowBookingForm(true)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                New Booking
              </button>
              <button
                onClick={() => setShowDebugConsole(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                title="API Debug Console"
              >
                <Bug className="w-3 h-3" />
                Debug
                {debugData.consoleLogs?.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1">
                    {debugData.consoleLogs.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Activities: {activities?.length || 0}</span>
            <span>•</span>
            <span>Inspectors: {pipedriveInspectors?.length || 0}</span>
            {error && (
              <>
                <span>•</span>
                <span className="text-red-600">API Error</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectionDashboard;