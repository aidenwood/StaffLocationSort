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
import DeveloperFooter from './DeveloperFooter';
import Toast from './Toast.jsx';
// Mock data removed - using live Pipedrive data only
import { useApiDebug } from '../hooks/useApiDebug.js';
import { useToast } from '../hooks/useToast.js';
import useRosterData from '../hooks/useRosterData.js';
import { enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';
import { forceRefreshDeals } from '../api/pipedriveDeals.js';
import { resetCircuitBreaker, getGeocodeStats, clearGeocodeCache } from '../services/geocoding';
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
    return saved ? parseInt(saved, 10) : 2; // Ben Thompson (ID 2) for consistency with working Activities page
  });
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
  // Load showOpportunities from localStorage with default true (since this is a key feature)
  const [showOpportunities, setShowOpportunities] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.showOpportunities');
    // Default to true if not set (better UX for new users)
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [timeSlotDealCounts, setTimeSlotDealCounts] = useState({});
  const [mobileViewMode, setMobileViewMode] = useState('split'); // 'split', 'calendar', 'map'
  const [dealsToShowOnMap, setDealsToShowOnMap] = useState([]); // Deals to display as markers on map
  const [dealsConsoleContext, setDealsConsoleContext] = useState(null); // Context for deals console (time slot info)
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false); // Developer tools dropdown menu
  
  // Deal stage filter state - saved to localStorage
  const [dealStageFilter, setDealStageFilter] = useState(() => {
    const saved = localStorage.getItem('staffLocationSort.dealStageFilter');
    return saved || 'all'; // 'all', 'lead_to_book', 'lead_interested'
  });

  // Save deal stage filter preference when it changes
  useEffect(() => {
    localStorage.setItem('staffLocationSort.dealStageFilter', dealStageFilter);
  }, [dealStageFilter]);


  // ⚠️ URGENT: Wrap setDealsToShowOnMap in useCallback to prevent infinite loops in DealsDebugConsole
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

  // Use shared address cache from App.jsx and merge with local cache
  const [localAddressMap, setLocalAddressMap] = useState({});
  
  // Get shared address cache from localStorage
  const getSharedAddressCache = () => {
    try {
      const cached = localStorage.getItem('staffLocationSort.addressCache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Error loading shared address cache:', error);
      return {};
    }
  };
  
  // State to trigger shared cache refresh
  const [sharedCacheRefresh, setSharedCacheRefresh] = useState(0);
  
  // Combined address map (shared + local)
  const addressMap = useMemo(() => {
    const sharedCache = getSharedAddressCache();
    const combined = { ...sharedCache, ...localAddressMap };
    return combined;
  }, [localAddressMap, sharedCacheRefresh]);
  
  // Manual refresh only - no auto-refresh to avoid interrupting user experience
  // User can use the manual refresh button when needed

  // Save selectedInspector to localStorage when it changes
  useEffect(() => {
    if (selectedInspector !== null) {
      localStorage.setItem('staffLocationSort.selectedInspector', selectedInspector.toString());
    } else {
      localStorage.removeItem('staffLocationSort.selectedInspector');
    }
  }, [selectedInspector]);

  // Save showOpportunities to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('staffLocationSort.showOpportunities', JSON.stringify(showOpportunities));
  }, [showOpportunities]);

  // Get roster data for the current week
  const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const endOfCurrentWeek = addDays(startOfCurrentWeek, 6);
  const { rosterData, loading: rosterLoading } = useRosterData(startOfCurrentWeek, endOfCurrentWeek);

  // Get all inspector activities (for enrichment)
  const inspectorActivities = useMemo(() => {
    if (!activities) return [];
    
    
    return activities.filter(a => {
      // For "All Inspectors" view (selectedInspector is null), show all activities
      const matchesInspector = selectedInspector === null || Number(a.owner_id) === Number(selectedInspector);
      
      return matchesInspector && !a.done &&
        a.due_time && a.due_time !== '00:00:00' &&
        !(a.subject && a.subject.includes('Inspector ENG Follow up'));
    });
  }, [activities, selectedInspector]);

  // Auto-select first date with activities for this inspector
  useEffect(() => {
    if (inspectorActivities.length === 0) return;

    const sorted = [...inspectorActivities].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    const today = format(new Date(), 'yyyy-MM-dd');
    const nextActivity = sorted.find(a => a.due_date >= today) || sorted[0];
    if (nextActivity?.due_date) {
      const [y, m, d] = nextActivity.due_date.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      console.log(`📅 Auto-selecting date: due_date="${nextActivity.due_date}" -> Date object=${newDate.toDateString()}`);
      setSelectedDate(newDate);
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
        
        // Update local state
        setLocalAddressMap(prev => {
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
            }
          });
          // Updated local address map
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
          // Saved enriched activities to shared cache
        } catch (error) {
          console.warn('Error saving to shared address cache:', error);
        }
        
        // Auto-enable opportunities after successful enrichment
        setTimeout(() => {
          setShowOpportunities(true);
          setOpportunitiesLoading(false);
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
    // Build enriched activities with addressMap data (reduced logging)
    let enrichedCount = 0;
    let missingCount = 0;
    
    const result = activities.map(a => {
      // If activity already has coordinates from App.jsx, keep them
      if (a.coordinates) {
        enrichedCount++;
        return a;
      }
      
      // Otherwise, add enriched data from addressMap if available
      if (addressMap[a.id]) {
        const enrichedData = addressMap[a.id];
        enrichedCount++;
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
      
      missingCount++;
      return a;
    });
    
    // Process activities for selected inspector
    return result;
  }, [activities, addressMap]);

  // Get enriched day activities for the map (inspector-specific)
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  
  const enrichedMapActivities = useMemo(() => {
    const filtered = enrichedActivities.filter(a => {
      // For "All Inspectors" view (selectedInspector is null), show all activities
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
    
    // Activities filtered for current day/inspector
    
    return filtered;
  }, [enrichedActivities, selectedInspector, dateString]);

  // Get ALL inspection activities for the date (for distance sorting)
  const allDayInspectionActivities = useMemo(() => {
    const filtered = enrichedActivities.filter(a => {
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
      
      return adjustedDate === dateString &&
        !a.done &&
        a.due_time && a.due_time !== '00:00:00' &&
        !(a.subject && a.subject.includes('Inspector ENG Follow up'));
    });
    
    const withCoords = filtered.filter(a => a.coordinates);
    // Filter activities with coordinates
    
    return filtered;
  }, [enrichedActivities, dateString]);

  // Function to calculate deal counts individually for each time slot across the entire week
  const calculateTimeSlotDealCounts = useCallback(async () => {
    try {
      if (!selectedInspector) return;
      
      // Don't clear counts until we have new ones ready
      // setTimeSlotDealCounts({});
      
      // Get inspector's default region from profile as fallback
      const currentInspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
      const defaultRegion = currentInspector?.region || 'R01';
      
      // Cache deals per region to avoid multiple fetches
      let dealsCache = {};
      
      // Calculate for all half-hour slots from 6am to 7pm
      const timeSlots = [];
      for (let hour = 6; hour <= 19; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 19) {
          timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
      const counts = {};
      
      // Generate all days for the current week
      const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const day = addDays(startOfCurrentWeek, dayOffset);
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Check roster for this specific day (handle string/number comparison)
        const dayRoster = rosterData.find(r => 
          Number(r.inspector_id) === Number(selectedInspector) && 
          r.date === dayString
        );
        
        // Skip ONLY if explicitly not working (sick, RDO, etc)
        if (dayRoster && dayRoster.status && dayRoster.status !== 'working') {
          continue; // No deal recommendations for days off
        }
        
        // Use roster region if available and working, otherwise use profile region
        let regionForDay = defaultRegion;
        
        if (dayRoster?.status === 'working') {
          if (dayRoster.region_code) {
            regionForDay = dayRoster.region_code;
          } else if (dayRoster.region_name) {
            // Map city names to region codes
            const cityToRegion = {
              'Glen Innes': 'R08',
              'Tamworth': 'R08',
              'Armidale': 'R08',
              'Grafton': 'R07',
              'Port Macquarie': 'R07',
              'Coffs Harbour': 'R07',
              'Ipswich': 'R01',
              'Gold Coast': 'R01',
              'Logan': 'R01',
              'Brisbane': 'R01',
              'Beaudesert': 'R01',
              'Gympie': 'R02',
              'Maryborough': 'R02',
              'Tin Can Bay': 'R02',
              'Sunshine Coast': 'R03',
              'Moreton Region': 'R03',
              'Gatton': 'R04',
              'Toowoomba': 'R04',
              'Oakey': 'R04',
              'Stanthorpe': 'R05',
              'Tara': 'R05',
              'Warwick': 'R05',
              'Texas': 'R05',
              'Emerald': 'R06',
              'Rockhampton': 'R06',
              'Roma': 'R06',
              'Newcastle': 'R09',
              'Maitland': 'R09',
              'Port Stephens': 'R09',
              'Cessnock': 'R09',
              'Lake Macquarie': 'R09',
              'Central Coast': 'R09',
              'Penrith': 'R10',
              'Sydney': 'R10'
            };
            
            // Try to find region code from city name
            const mappedRegion = cityToRegion[dayRoster.region_name];
            if (mappedRegion) {
              regionForDay = mappedRegion;
            }
          }
        }
        if (!dealsCache[regionForDay]) {
          const regionDeals = await getDealsForRegion(regionForDay, { limit: 200 });
          if (!regionDeals || regionDeals.length === 0) {
            console.log(`⚠️ No deals found for region ${regionForDay}`);
            dealsCache[regionForDay] = [];
          } else {
            dealsCache[regionForDay] = regionDeals;
            const dealsWithCoords = regionDeals.filter(d => d.coordinates && d.coordinates.lat && d.coordinates.lng);
            console.log(`📍 Region ${regionForDay}: ${dealsWithCoords.length}/${regionDeals.length} deals have coordinates`);
          }
        }
        
        const deals = dealsCache[regionForDay] || [];
        // Don't skip - still show empty slots even if no deals in region
        
        // Get ALL activities for this specific day for the selected inspector
        const dayActivities = enrichedActivities.filter(a =>
          Number(a.owner_id) === Number(selectedInspector) &&
          a.due_date === dayString &&
          !a.done &&
          a.due_time && a.due_time !== '00:00:00' &&
          !(a.subject && a.subject.includes('Inspector ENG Follow up'))
        );
        
        if (dayActivities.length > 0) {
          console.log(`📅 ${dayString}: Found ${dayActivities.length} activities for inspector ${selectedInspector}`);
        }
        
        // Filter for activities that have coordinates
        const activitiesWithCoords = dayActivities.filter(a => a.coordinates);
        
        // Get region center for fallback when no inspections have coordinates
        const regionCenter = regionCenters[regionForDay];
        
        // Debug logging for empty days
        
        // Calculate only for key time slots (9am, 11am, 1pm, 3pm)
        const timeSlots = ['09:00', '11:00', '13:00', '15:00'];
        
        for (const timeSlot of timeSlots) {
          // Check if this time slot already has an activity
          const slotHour = parseInt(timeSlot.split(':')[0]);
          const slotMin = parseInt(timeSlot.split(':')[1]);
          
          const slotHasActivity = dayActivities.some(a => {
            if (!a.due_time) return false;
            const [actHour, actMin] = a.due_time.split(':').map(n => parseInt(n));
            // Check if activity is within 30 mins of this slot
            return actHour === slotHour && Math.abs(actMin - slotMin) < 30;
          });
          
          // Skip slots that already have activities
          if (slotHasActivity) continue;
          
          let referenceInspection = null;
          
          if (activitiesWithCoords.length > 0) {
            // Find the closest inspection by time
            const slotTotalMinutes = slotHour * 60 + slotMin;
            
            let closestActivity = null;
            let minTimeDiff = Infinity;
            
            activitiesWithCoords.forEach(activity => {
              const [actHour, actMin] = activity.due_time.split(':').map(n => parseInt(n));
              const actTotalMinutes = actHour * 60 + actMin;
              const timeDiff = Math.abs(actTotalMinutes - slotTotalMinutes);
              
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestActivity = activity;
              }
            });
            
            referenceInspection = closestActivity;
          }
          
          // Always use region center as fallback
          if (!referenceInspection && regionCenter) {
            referenceInspection = {
              coordinates: { lat: regionCenter.lat, lng: regionCenter.lng },
              personAddress: `${regionCenter.name} Center`,
              due_date: dayString
            };
          }
          
          if (referenceInspection) {
            try {
              // Sort deals by distance to this specific inspection or region center
              const sortedDeals = sortDealsByDistance(deals, [referenceInspection]);
              
              const dealsWithDistance = sortedDeals.filter(d => d.distanceInfo?.minDistance !== null);
              
              if (dealsWithDistance.length > 0) {
                const within1km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 1).length;
                const within2_5km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 2.5).length;
                const within5km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 5).length;
                const within10km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 10).length;
                const within15km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 15).length;
                const within30km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 30).length;
                
                counts[`${dayString}-${timeSlot}`] = {
                  within1km,
                  within2_5km: within2_5km - within1km, // 1-2.5km range only
                  within5km: within5km - within2_5km, // 2.5-5km range only
                  within10km: within10km - within5km, // 5-10km range only
                  within15km: within15km - within10km, // 10-15km range only
                  within30km: within30km - within15km, // 15-30km range only
                  radiusText: within1km > 0 ? '1km' : (within2_5km > within1km ? '2.5km' : (within5km > within2_5km ? '5km' : (within10km > within5km ? '10km' : (within15km > within10km ? '15km' : '30km')))),
                  referenceAddress: referenceInspection.personAddress?.substring(0, 40) || 'Unknown'
                };
                
                // Individual slot calculation complete
              }
            } catch (error) {
              console.error(`Error calculating deals for ${dayString} ${timeSlot}:`, error);
            }
          }
        }
      }
      
      setTimeSlotDealCounts(counts);
      
    } catch (err) {
      console.error('❌ Error calculating time slot deal counts:', err);
    }
  }, [selectedInspector, pipedriveInspectors, enrichedActivities.length, selectedDate, rosterData.length]);

  // Recalculate deal counts when date or inspector changes and opportunities are enabled
  // Use week start as dependency to ensure recalculation when navigating weeks
  const weekStart = useMemo(() => {
    return startOfWeek(selectedDate, { weekStartsOn: 1 });
  }, [selectedDate]);
  
  useEffect(() => {
    if (showOpportunities && !opportunitiesLoading) {
      calculateTimeSlotDealCounts();
    }
  }, [weekStart, selectedInspector, showOpportunities, enrichedActivities.length, opportunitiesLoading, rosterData.length]);

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
    // New booking confirmed
    
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
    // Allow weekend dates now
    setSelectedDate(newDate);
  };

  const handleRetryConnection = () => {
    resetCircuitBreaker();
    refetch(); // Refetch REAL data
  };

  const handleShowDealsDebugConsole = (date, timeSlot = null, radius = null) => {
    if (date) {
      setSelectedDate(date);
    }
    
    // Set context for deals console title and radius
    if (timeSlot && date) {
      const contextInfo = {
        timeSlot,
        date,
        radius,
        formattedTime: timeSlot ? timeSlot.substring(0, 5) : null, // "09:00" from "09:00:00"
        formattedDate: format(date, 'do \'of\' MMMM'), // "13th of March"
        regionCenter: null // Will be set below if needed
      };
      setDealsConsoleContext(contextInfo);
    } else {
      setDealsConsoleContext(null);
    }
    
    // If a timeSlot is provided, find the reference inspection for sorting
    if (timeSlot && date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayActivities = enrichedMapActivities.filter(a => a.due_date === dateStr);
      let referenceInspection = null;
      
      if (timeSlot === '09:00') {
        // For 9am, use the following appointment (next inspection)
        const activitiesAfterSlot = dayActivities
          .filter(a => a.due_time && a.due_time > timeSlot)
          .sort((a, b) => a.due_time.localeCompare(b.due_time)); // Earliest first
        referenceInspection = activitiesAfterSlot[0];
        
        // If no following appointment, fallback to any activity on this day
        if (!referenceInspection && dayActivities.length > 0) {
          referenceInspection = dayActivities[0]; // Use first available activity
        }
      } else {
        // For other slots, use the previous appointment
        const activitiesBeforeSlot = dayActivities
          .filter(a => a.due_time && a.due_time < timeSlot)
          .sort((a, b) => a.due_time.localeCompare(b.due_time));
        referenceInspection = activitiesBeforeSlot[activitiesBeforeSlot.length - 1]; // Last one before timeSlot
      }
      
      // If no inspection found, use region center as fallback
      if (!referenceInspection) {
        const dayRoster = rosterData.find(r => 
          Number(r.inspector_id) === Number(selectedInspector) && 
          r.date === dateStr
        );
        const currentInspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
        let regionForDay = currentInspector?.region || 'R01';
        
        if (dayRoster?.status === 'working') {
          if (dayRoster.region_code) {
            regionForDay = dayRoster.region_code;
          } else if (dayRoster.region_name) {
            // Map city names to region codes
            const cityToRegion = {
              'Glen Innes': 'R08',
              'Tamworth': 'R08',
              'Armidale': 'R08',
              'Grafton': 'R07',
              'Port Macquarie': 'R07',
              'Coffs Harbour': 'R07',
              'Ipswich': 'R01',
              'Gold Coast': 'R01',
              'Logan': 'R01',
              'Brisbane': 'R01',
              'Beaudesert': 'R01',
              'Gympie': 'R02',
              'Maryborough': 'R02',
              'Tin Can Bay': 'R02',
              'Sunshine Coast': 'R03',
              'Moreton Region': 'R03',
              'Gatton': 'R04',
              'Toowoomba': 'R04',
              'Oakey': 'R04',
              'Stanthorpe': 'R05',
              'Tara': 'R05',
              'Warwick': 'R05',
              'Texas': 'R05',
              'Emerald': 'R06',
              'Rockhampton': 'R06',
              'Roma': 'R06',
              'Newcastle': 'R09',
              'Maitland': 'R09',
              'Port Stephens': 'R09',
              'Cessnock': 'R09',
              'Lake Macquarie': 'R09',
              'Central Coast': 'R09',
              'Penrith': 'R10',
              'Sydney': 'R10'
            };
            
            // Try to find region code from city name
            const mappedRegion = cityToRegion[dayRoster.region_name];
            if (mappedRegion) {
              regionForDay = mappedRegion;
            }
          }
        }
        
        const regionCenter = regionCenters[regionForDay];
        if (regionCenter) {
          referenceInspection = {
            coordinates: { lat: regionCenter.lat, lng: regionCenter.lng },
            personAddress: `${regionCenter.name} Center`,
            due_date: dateStr
          };
          
          // Also update context to include region center for map display
          setDealsConsoleContext(prev => ({
            ...prev,
            regionCenter: { lat: regionCenter.lat, lng: regionCenter.lng }
          }));
        }
      }
      
      if (referenceInspection) {
        // Store the sort-by inspection for DealsDebugConsole
        window.dealsSortByInspection = referenceInspection;
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
    return activity.due_date === format(selectedDate, 'yyyy-MM-dd'); // Fix timezone issue
  }) : [];
  const totalActivities = activities ? activities.length : 0;
  const completedActivities = activities ? activities.filter(a => a.done).length : 0;

  // Refresh functions
  const handleRefreshInspections = async () => {
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
        console.log(`⚠️ ${activitiesNeedingGeocode.length} activities have addresses but no coordinates`);
      } else {
        showToast(`Found ${newCount} inspections`, 'success');
      }
    } catch (error) {
      console.error('Error refreshing inspections:', error);
      hideToast(loadingToastId);
      showToast('Failed to refresh inspections', 'error');
    }
  };

  const handleRefreshDeals = async () => {
    const loadingToastId = showToast('Refreshing deals & geocoding...', 'loading');
    try {
      // Check geocoding stats first
      const geocodeStats = getGeocodeStats();
      console.log('🔍 Geocoding stats before refresh:', geocodeStats);
      
      // Only reset circuit breaker and clear cache if there were failures
      if (geocodeStats.circuitBreakerTripped || geocodeStats.consecutiveFailures > 0) {
        console.log('⚡ Resetting geocoding circuit breaker and cache');
        resetCircuitBreaker();
        clearGeocodeCache(); // Clear failed geocoding cache
      }
      
      // Determine current region based on selected inspector
      const inspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
      const region = inspector?.region || 'R01'; // Default to R01
      
      const result = await forceRefreshDeals(region);
      
      const message = result.newDeals > 0 
        ? `Found ${result.newDeals} new deals (${result.totalDeals} total)` 
        : `Refreshed ${result.totalDeals} deals`;
      
      hideToast(loadingToastId);
      showToast(message, 'success');
    } catch (error) {
      console.error('Error refreshing deals:', error);
      hideToast(loadingToastId);
      showToast('Failed to refresh deals', 'error');
    }
  };

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
                onClick={() => handleDateChange(getPreviousDay(selectedDate))}
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
                onClick={() => handleDateChange(getNextDay(selectedDate))}
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
                onClick={() => handleDateChange(getPreviousDay(selectedDate))}
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
                onClick={() => handleDateChange(getNextDay(selectedDate))}
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
                onClick={() => handleDateChange(getPreviousDay(selectedDate))}
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
                onClick={() => handleDateChange(getNextDay(selectedDate))}
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
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Calendar Section */}
        <div className={`min-w-0 transition-all duration-500 ease-in-out overflow-hidden ${
          mobileViewMode === 'map' 
            ? 'h-0 w-0 lg:w-0 opacity-0 -translate-x-full lg:translate-x-0 -translate-y-full'
            : mobileViewMode === 'split'
              ? 'h-1/2 w-full min-h-[50vh] lg:h-auto lg:w-1/2 opacity-100 translate-x-0 translate-y-0'
              : 'h-full w-full lg:h-auto lg:w-full opacity-100 translate-x-0 translate-y-0'
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
            rosterData={rosterData}
          />
        </div>

        {/* Map Section */}
        <div className={`flex flex-col gap-4 min-w-0 transition-all duration-500 ease-in-out overflow-hidden ${
          mobileViewMode === 'calendar'
            ? 'h-0 w-0 lg:w-0 opacity-0 translate-x-full lg:translate-x-0 translate-y-full'
            : mobileViewMode === 'split'
              ? 'h-1/2 w-full min-h-[50vh] lg:h-auto lg:w-1/2 opacity-100 translate-x-0 translate-y-0'
              : 'h-full w-full lg:h-auto lg:w-full opacity-100 translate-x-0 translate-y-0'
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
              dealsToShow={dealsToShowOnMap}
              inspectors={pipedriveInspectors}
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
        onClose={() => {
          setShowDealsDebugConsole(false);
          setDealsToShowOnMap([]); // Clear deal markers when closing
          setDealsConsoleContext(null); // Clear context when closing
        }}
        selectedInspector={selectedInspector}
        inspectors={pipedriveInspectors}
        selectedDate={selectedDate}
        inspectionActivities={enrichedMapActivities}
        viewMode={mobileViewMode}
        onDealsUpdate={handleDealsUpdate}
        context={dealsConsoleContext} // Pass time slot context
        dealStageFilter={dealStageFilter} // Pass deal stage filter for filtering
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
          {/* Deal Filter Toggle - Mobile */}
          <div className="flex justify-center mb-2">
            <div className="flex bg-gray-100 rounded-md p-0.5">
              <button
                onClick={() => setDealStageFilter('all')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDealStageFilter('lead_to_book')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'lead_to_book'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-green-100 hover:text-green-700'
                }`}
              >
                To Book
              </button>
              <button
                onClick={() => setDealStageFilter('lead_interested')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'lead_interested'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                }`}
              >
                Interested
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <a
                href="/#activities"
                className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
              >
                <Users className="w-3 h-3" />
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
              <button
                onClick={handleRefreshInspections}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                title="Refresh Inspections"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={handleRefreshDeals}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                title="Refresh Deals"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
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
                href="/#estimator"
                className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
              >
                <Target className="w-3 h-3" />
                Risk Estimator
              </a>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <button
              onClick={() => setShowDeveloperMenu(!showDeveloperMenu)}
              className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              title="Developer Tools Menu"
            >
              {showDeveloperMenu ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
              <span>Dev Tools</span>
              {debugData.consoleLogs?.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1 ml-1">
                  {debugData.consoleLogs.length}
                </span>
              )}
            </button>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Refresh:</span>
              <button
                onClick={handleRefreshInspections}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                title="Refresh Inspections"
              >
                <RefreshCw className="w-3 h-3" />
                Inspections
              </button>
              <button
                onClick={handleRefreshDeals}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                title="Refresh Deals"
              >
                <RefreshCw className="w-3 h-3" />
                Deals
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Activities: {totalActivities}</span>
              <span>•</span>
              <span>Inspectors: {pipedriveInspectors?.length || 0}</span>
              {error && (
                <>
                  <span>•</span>
                  <span className="text-red-600">API Error</span>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Deal Stage:</span>
              <div className="flex bg-gray-100 rounded-md p-0.5">
                <button
                  onClick={() => setDealStageFilter('all')}
                  className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                    dealStageFilter === 'all'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Deals
                </button>
                <button
                  onClick={() => setDealStageFilter('lead_to_book')}
                  className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                    dealStageFilter === 'lead_to_book'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-green-100 hover:text-green-700'
                  }`}
                >
                  Lead to Book
                </button>
                <button
                  onClick={() => setDealStageFilter('lead_interested')}
                  className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                    dealStageFilter === 'lead_interested'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  Lead Interested
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Tools Menu Modal */}
      {showDeveloperMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 m-4 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Developer Tools</h3>
              <button
                onClick={() => setShowDeveloperMenu(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowBookingForm(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">New Booking Form</span>
              </button>
              <a
                href="/#book"
                onClick={() => setShowDeveloperMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Book Page</span>
              </a>
              <button
                onClick={() => {
                  setShowDebugConsole(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <Bug className="w-4 h-4" />
                <span className="text-sm">API Debug Console</span>
                {debugData.consoleLogs?.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 ml-auto">
                    {debugData.consoleLogs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setShowDealsDebugConsole(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Deals Debug Console</span>
              </button>
            </div>
          </div>
        </div>
      )}

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