import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, subDays, startOfWeek } from 'date-fns';
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
  ChevronRight,
  Grid3x3,
  Target
} from 'lucide-react';
import InspectorCalendar from './InspectorCalendar';
import InspectorView from './InspectorView';
import RoofInspectionBooking from './RoofInspectionBooking';
import GoogleMapsView from './GoogleMapsView';
import ApiDebugConsole from './ApiDebugConsole';
import DealsDebugConsole from './DealsDebugConsole';
import AppUnavailableModal from './AppUnavailableModal';
import DatePickerDropdown from './DatePickerDropdown';
import { inspectors } from '../data/mockActivities';
import { useApiDebug } from '../hooks/useApiDebug.js';
import { enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';
import { getDealsForRegion, sortDealsByDistance } from '../api/pipedriveDeals.js';

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
  const [showDealsDebugConsole, setShowDealsDebugConsole] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [timeSlotDealCounts, setTimeSlotDealCounts] = useState({});
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
        setAddressMap(prev => {
          const updated = { ...prev };
          enriched.forEach(a => {
            if (a.personAddress) {
              // Store the full enriched data including coordinates
              updated[a.id] = {
                personAddress: a.personAddress,
                coordinates: a.coordinates,
                lat: a.lat,
                lng: a.lng,
                addressSource: a.addressSource,
                label: a.label
              };
              console.log(`📍 Added to addressMap: Activity ${a.id}`, {
                hasPersonAddress: !!a.personAddress,
                hasCoordinates: !!a.coordinates,
                addressSource: a.addressSource
              });
            }
          });
          console.log(`🗺️ AddressMap now contains ${Object.keys(updated).length} activities`);
          return updated;
        });
        
        // Auto-enable opportunities after successful enrichment
        setTimeout(() => {
          setShowOpportunities(true);
          setOpportunitiesLoading(false);
          // Calculate deal counts for time slots
          calculateTimeSlotDealCounts();
        }, 1000);
      } catch (err) {
        console.error('Address enrichment failed:', err);
        setOpportunitiesLoading(false);
      }
    };
    doEnrich();
  }, [inspectorActivities]);


  // Merge addresses into all activities for calendar + map, preserving existing coordinates
  const enrichedActivities = useMemo(() => {
    console.log(`🔄 Building enrichedActivities from ${activities?.length || 0} activities and ${Object.keys(addressMap).length} addressMap entries`);
    
    return activities.map(a => {
      // If activity already has coordinates from App.jsx, keep them
      if (a.coordinates) {
        console.log(`   ✅ Activity ${a.id} already has coordinates`);
        return a;
      }
      
      // Otherwise, add enriched data from addressMap if available
      if (addressMap[a.id]) {
        const enrichedData = addressMap[a.id];
        console.log(`   📍 Enriching activity ${a.id} with addressMap data:`, {
          hasPersonAddress: !!enrichedData.personAddress,
          hasCoordinates: !!enrichedData.coordinates
        });
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
      
      console.log(`   ⚠️ Activity ${a.id} not found in addressMap`);
      return a;
    });
  }, [activities, addressMap]);

  // Get enriched day activities for the map (inspector-specific)
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const enrichedMapActivities = useMemo(() => {
    const filtered = enrichedActivities.filter(a =>
      Number(a.owner_id) === Number(selectedInspector) &&
      a.due_date === dateString &&
      !a.done &&
      a.due_time && a.due_time !== '00:00:00' &&
      !(a.subject && a.subject.includes('Inspector ENG Follow up'))
    );
    
    console.log(`🔍 EnrichedMapActivities debug for ${dateString}:`);
    console.log(`   Selected inspector: ${selectedInspector}`);
    console.log(`   Total enrichedActivities: ${enrichedActivities.length}`);
    console.log(`   Filtered for inspector/date: ${filtered.length}`);
    filtered.forEach((a, i) => {
      console.log(`   Activity ${i + 1}:`, {
        id: a.id,
        subject: a.subject?.substring(0, 50) + '...',
        hasPersonAddress: !!a.personAddress,
        hasCoordinates: !!a.coordinates,
        addressSource: a.addressSource
      });
    });
    
    return filtered;
  }, [enrichedActivities, selectedInspector, dateString]);

  // Get ALL inspection activities for the date (for distance sorting)
  const allDayInspectionActivities = useMemo(() => {
    const filtered = enrichedActivities.filter(a =>
      a.due_date === dateString &&
      !a.done &&
      a.due_time && a.due_time !== '00:00:00' &&
      !(a.subject && a.subject.includes('Inspector ENG Follow up'))
    );
    
    console.log(`🌍 AllDayInspectionActivities for ${dateString}: ${filtered.length} total activities`);
    const withCoords = filtered.filter(a => a.coordinates);
    console.log(`   ${withCoords.length} have coordinates for distance calculations`);
    
    return filtered;
  }, [enrichedActivities, dateString]);

  // Function to calculate deal counts individually for each time slot across the entire week
  const calculateTimeSlotDealCounts = async () => {
    try {
      if (!selectedInspector) return;
      
      // Get current inspector region
      const currentInspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
      const region = currentInspector?.region || 'R1';
      
      // Fetch deals for the region
      const deals = await getDealsForRegion(region, { limit: 200 });
      if (!deals || deals.length === 0) return;
      
      const timeSlots = ['09:00', '11:00', '13:00', '15:00'];
      const counts = {};
      
      // Generate all days for the current week
      const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const day = addDays(startOfCurrentWeek, dayOffset);
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Get activities for this specific day across all inspectors
        const dayActivities = enrichedActivities.filter(a =>
          a.due_date === dayString &&
          !a.done &&
          a.due_time && a.due_time !== '00:00:00' &&
          !(a.subject && a.subject.includes('Inspector ENG Follow up')) &&
          a.coordinates // Only activities with coordinates
        );
        
        for (const timeSlot of timeSlots) {
          let referenceInspection = null;
          
          if (timeSlot === '09:00') {
            // For 9am, use the following appointment (next inspection)
            const activitiesAfterSlot = dayActivities
              .filter(a => a.due_time > timeSlot)
              .sort((a, b) => a.due_time.localeCompare(b.due_time)); // Earliest first
            referenceInspection = activitiesAfterSlot[0];
          } else {
            // For other slots, use the previous appointment
            const activitiesBeforeSlot = dayActivities
              .filter(a => a.due_time < timeSlot)
              .sort((a, b) => b.due_time.localeCompare(a.due_time)); // Latest first
            referenceInspection = activitiesBeforeSlot[0];
          }
          
          if (referenceInspection) {
            try {
              // Sort deals by distance to this specific inspection
              const sortedDeals = await sortDealsByDistance(deals, [referenceInspection]);
              const dealsWithDistance = sortedDeals.filter(d => d.distanceInfo?.minDistance !== null);
              
              if (dealsWithDistance.length > 0) {
                const within5km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 5).length;
                const within10km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 10).length;
                const within15km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 15).length;
                
                counts[`${dayString}-${timeSlot}`] = {
                  within5km,
                  within10km: within10km - within5km, // 5-10km range only
                  within15km: within15km - within10km, // 10-15km range only
                  radiusText: within5km > 0 ? '5km' : (within10km > within5km ? '10km' : '15km'),
                  referenceAddress: referenceInspection.personAddress?.substring(0, 40) || 'Unknown'
                };
                
                console.log(`🔍 ${dayString} ${timeSlot}: ${within5km}/5km, ${within10km-within5km}/5-10km, ${within15km-within10km}/10-15km near ${referenceInspection.personAddress?.substring(0, 30)}`);
              }
            } catch (error) {
              console.error(`Error calculating deals for ${dayString} ${timeSlot}:`, error);
            }
          }
        }
      }
      
      setTimeSlotDealCounts(counts);
      console.log(`📅 Calculated individual deal counts for ${Object.keys(counts).length} time slots across the week`);
      
    } catch (err) {
      console.error('❌ Error calculating time slot deal counts:', err);
    }
  };

  // Recalculate deal counts when date or inspector changes and opportunities are enabled
  useEffect(() => {
    if (showOpportunities && !opportunitiesLoading && enrichedActivities.length > 0) {
      calculateTimeSlotDealCounts();
    }
  }, [selectedDate, selectedInspector, showOpportunities, enrichedActivities]);

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

  const handleShowDealsDebugConsole = (date, timeSlot = null) => {
    if (date) {
      setSelectedDate(date);
    }
    
    // If a timeSlot is provided, find the previous inspection for sorting
    if (timeSlot && date) {
      const dayActivities = enrichedMapActivities.filter(a => a.due_date === format(date, 'yyyy-MM-dd'));
      
      // Sort activities by time to find the one before this timeSlot
      const sortedActivities = dayActivities
        .filter(a => a.due_time && a.due_time < timeSlot)
        .sort((a, b) => a.due_time.localeCompare(b.due_time));
      
      const previousInspection = sortedActivities[sortedActivities.length - 1]; // Last one before timeSlot
      
      if (previousInspection) {
        console.log(`🎯 Opening deals console for ${timeSlot} with previous inspection:`, {
          time: previousInspection.due_time,
          address: previousInspection.personAddress,
          coordinates: previousInspection.coordinates
        });
        
        // Store the sort-by inspection for DealsDebugConsole
        window.dealsSortByInspection = previousInspection;
      }
    }
    
    setShowDealsDebugConsole(true);
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
      {/* Header - Responsive Figma Style */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2">
        {/* Desktop Layout - Single Row */}
        <div className="hidden lg:flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <h1 className="text-sm font-medium text-gray-900">
              Inspector Dashboard
            </h1>
            <div className="w-px h-4 bg-gray-300"></div>
            <span className="text-xs text-gray-500">
              Pipedrive Activities
            </span>
          </div>

          {/* Center Controls */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {/* Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5">
              <select
                value={selectedInspector || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setSelectedInspector('all');
                  } else if (value) {
                    setSelectedInspector(parseInt(value));
                  } else {
                    setSelectedInspector(null);
                  }
                }}
                className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer min-w-0"
              >
                <option value="">All Inspectors</option>
                {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => handleDateChange(subDays(selectedDate, 1))}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className="px-1"
              />
              
              <button
                onClick={() => handleDateChange(addDays(selectedDate, 1))}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* View Mode Controls */}
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
                <span className="text-xs">Split</span>
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
                <span className="text-xs">Calendar</span>
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
                <span className="text-xs">Map</span>
              </button>
              
              {/* Availability Grid Button */}
              <button
                onClick={() => {
                  window.location.hash = '#grid';
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                title="Availability Grid View"
              >
                <Grid3x3 className="w-3 h-3" />
                <span className="text-xs">Grid</span>
              </button>
            </div>
          </div>

          {/* Right: Status & Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Opportunities Toggle */}
            <button
              onClick={() => setShowOpportunities(!showOpportunities)}
              disabled={opportunitiesLoading}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                opportunitiesLoading
                  ? 'bg-blue-100 text-blue-700'
                  : showOpportunities 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opportunitiesLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  <Target className="w-3 h-3" />
                  Opportunities
                </>
              )}
            </button>
            
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

        {/* Tablet Layout - Two Rows */}
        <div className="hidden md:block lg:hidden">
          {/* First Row - Title and Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-medium text-gray-900">Inspector Dashboard</h1>
              <div className="w-px h-4 bg-gray-300"></div>
              <span className="text-xs text-gray-500">Pipedrive Activities</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs text-gray-500">
                {isLiveData ? 'Live' : 'Mock'}
              </span>
            </div>
          </div>

          {/* Second Row - Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5">
              <select
                value={selectedInspector || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setSelectedInspector('all');
                  } else if (value) {
                    setSelectedInspector(parseInt(value));
                  } else {
                    setSelectedInspector(null);
                  }
                }}
                className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="">All Inspectors</option>
                {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => handleDateChange(subDays(selectedDate, 1))}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className="px-1"
              />
              
              <button
                onClick={() => handleDateChange(addDays(selectedDate, 1))}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* View Mode Controls */}
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
                <span className="text-xs">Split</span>
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
                <span className="text-xs">Cal</span>
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
                <span className="text-xs">Map</span>
              </button>
              
              {/* Grid Button */}
              <button
                onClick={() => {
                  window.location.hash = '#grid';
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                title="Availability Grid View"
              >
                <Grid3x3 className="w-3 h-3" />
                <span className="text-xs">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Single Row */}
        <div className="block md:hidden">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Title and Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <h1 className="text-sm font-medium text-gray-900">Dashboard</h1>
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
            </div>

            {/* Center: Compact Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 min-w-0 flex-1 max-w-[120px]">
              <select
                value={selectedInspector || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setSelectedInspector('all');
                  } else if (value) {
                    setSelectedInspector(parseInt(value));
                  } else {
                    setSelectedInspector(null);
                  }
                }}
                className="bg-transparent text-[10px] font-medium text-gray-700 px-1 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer w-full truncate"
              >
                <option value="">All Inspectors</option>
                {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Center Right: Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => handleDateChange(subDays(selectedDate, 1))}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className=""
              />
              
              <button
                onClick={() => handleDateChange(addDays(selectedDate, 1))}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* Right: Compact View Controls */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5 flex-shrink-0">
              <button
                onClick={() => setMobileViewMode('split')}
                className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                  mobileViewMode === 'split'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Split View"
              >
                <Columns2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setMobileViewMode('calendar')}
                className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                  mobileViewMode === 'calendar'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Calendar Only"
              >
                <Calendar className="w-3 h-3" />
              </button>
              <button
                onClick={() => setMobileViewMode('map')}
                className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                  mobileViewMode === 'map'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Map Only"
              >
                <Map className="w-3 h-3" />
              </button>
              
              {/* Grid Button */}
              <button
                onClick={() => {
                  window.location.hash = '#grid';
                }}
                className="flex items-center p-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                title="Availability Grid View"
              >
                <Grid3x3 className="w-3 h-3" />
              </button>
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
            onDateChange={setSelectedDate}
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
            enableOpportunities={showOpportunities}
            onShowDealsDebugConsole={handleShowDealsDebugConsole}
            timeSlotDealCounts={timeSlotDealCounts}
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
              onDateChange={setSelectedDate}
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

      {/* Deals Debug Console */}
      <DealsDebugConsole
        isOpen={showDealsDebugConsole}
        onClose={() => setShowDealsDebugConsole(false)}
        selectedInspector={selectedInspector}
        inspectors={pipedriveInspectors}
        selectedDate={selectedDate}
        inspectionActivities={enrichedMapActivities}
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
              <button
                onClick={() => setShowDealsDebugConsole(true)}
                className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                title="Deals Debug Console"
              >
                <MapPin className="w-3 h-3" />
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
              <button
                onClick={() => setShowDealsDebugConsole(true)}
                className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                title="Deals Debug Console"
              >
                <MapPin className="w-3 h-3" />
                Deals
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