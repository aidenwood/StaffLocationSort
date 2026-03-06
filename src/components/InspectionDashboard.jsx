import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  Plus,
  CheckCircle,
  AlertCircle,
  Bug
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inspection Scheduler V4
            </h1>
            <p className="text-gray-600 text-sm">
              V4: Raw Pipedrive Calendar (No Filters) - Debug view for Logan, QLD area
            </p>
          </div>
          
          {/* Stats Pills */}
          <div className="flex items-center gap-4">
           
            
            {/* Inspector Quick Access */}
            <div className="border-l border-gray-300 pl-4 ml-2">
              <div className="text-xs text-gray-500 mb-2">Quick Inspector Access:</div>
              <div className="flex gap-2">
                {inspectors.map(inspector => (
                  <button
                    key={inspector.id}
                    onClick={() => handleInspectorView(inspector.id)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
                  >
                    {inspector.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowBookingForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Booking
            </button>
            
            <button
              onClick={() => setShowDebugConsole(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
              title="Open API Debug Console"
            >
              <Bug className="w-4 h-4" />
              Debug Console
              {debugData.consoleLogs?.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {debugData.consoleLogs.length}
                </span>
              )}
            </button>
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Region:</label>
            <select
              value={selectedInspector ? inspectors.find(i => i.id === selectedInspector)?.region || '' : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const inspector = inspectors.find(i => i.region === e.target.value);
                  setSelectedInspector(inspector ? inspector.id : null);
                } else {
                  setSelectedInspector(null);
                }
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Regions</option>
              {[...new Set(inspectors.map(i => i.region))].map(region => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Calendar Section */}
        <div className="flex-1 lg:w-1/2 min-w-0">
          <InspectorCalendar
            selectedInspector={selectedInspector}
            selectedDate={selectedDate}
            onInspectorChange={setSelectedInspector}
            onDateChange={handleDateChange}
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
          />
        </div>

        {/* Map Section */}
        <div className="flex-1 lg:w-1/2 flex flex-col gap-4 min-w-0">
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
          <div className="flex-1">
            <GoogleMapsView
              selectedInspector={selectedInspector}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
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
    </div>
  );
};

export default InspectionDashboard;