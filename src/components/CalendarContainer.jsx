import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import InspectorCalendar from './InspectorCalendar';
import { getDealsForRegion, sortDealsByDistance } from '../api/pipedriveDeals.js';
import { regionCenters } from '../utils/regionValidation.js';

const CalendarContainer = ({
  selectedInspector,
  selectedDate,
  onDateChange,
  onSelectTimeSlot,
  hoveredAppointment,
  onAppointmentHover,
  onAppointmentLeave,
  enrichedActivities,
  pipedriveInspectors,
  isLiveData,
  loading,
  isTimeout,
  error,
  showOpportunities,
  onShowDealsDebugConsole,
  rosterData,
  mobileViewMode,
  dealStageFilter = 'all'
}) => {
  const [timeSlotDealCounts, setTimeSlotDealCounts] = useState({});
  const [dealCountsLoading, setDealCountsLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  
  // Persistent deals cache to avoid refetching on filter changes
  const [dealsCache, setDealsCache] = useState({});

  // Memoize the calculation function with proper dependencies
  const calculateTimeSlotDealCounts = useCallback(async () => {
    if (!selectedInspector || !showOpportunities) {
      setTimeSlotDealCounts({});
      return;
    }
    
    try {
      setDealCountsLoading(true);
      
      // Get inspector's default region from profile as fallback
      const currentInspector = pipedriveInspectors?.find(i => i.id === selectedInspector);
      const defaultRegion = currentInspector?.region || 'R01';
      
      const counts = {};
      
      // Generate days for multiple weeks ahead to match calendar navigation
      // Use same logic as calendar: start from Sunday (day 0) like InspectorCalendar
      const baseDate = selectedDate;
      const currentDay = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const calendarStartDate = addDays(baseDate, -currentDay); // Move to Sunday of current week
      const weeksToCalculate = 4; // Calculate 4 weeks ahead
      
      for (let dayOffset = 0; dayOffset < (7 * weeksToCalculate); dayOffset++) {
        const day = addDays(calendarStartDate, dayOffset);
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Check roster for this specific day
        const dayRoster = rosterData.find(r => 
          Number(r.inspector_id) === Number(selectedInspector) && 
          r.date === dayString
        );
        
        // Skip ONLY if explicitly not working
        if (dayRoster && dayRoster.status && dayRoster.status !== 'working') {
          continue;
        }
        
        // Use roster region if available and working, otherwise use profile region
        let regionForDay = defaultRegion;
        
        if (dayRoster?.status === 'working') {
          if (dayRoster.region_code) {
            regionForDay = dayRoster.region_code;
          } else if (dayRoster.region_name) {
            // Map city names to region codes
            const cityToRegion = {
              'Glen Innes': 'R08', 'Tamworth': 'R08', 'Armidale': 'R08',
              'Grafton': 'R07', 'Port Macquarie': 'R07', 'Coffs Harbour': 'R07',
              'Ipswich': 'R01', 'Gold Coast': 'R01', 'Logan': 'R01',
              'Brisbane': 'R01', 'Beaudesert': 'R01',
              'Gympie': 'R02', 'Maryborough': 'R02', 'Tin Can Bay': 'R02',
              'Sunshine Coast': 'R03', 'Moreton Region': 'R03',
              'Gatton': 'R04', 'Toowoomba': 'R04', 'Oakey': 'R04',
              'Stanthorpe': 'R05', 'Tara': 'R05', 'Warwick': 'R05', 'Texas': 'R05',
              'Emerald': 'R06', 'Rockhampton': 'R06', 'Roma': 'R06',
              'Newcastle': 'R09', 'Maitland': 'R09', 'Port Stephens': 'R09',
              'Cessnock': 'R09', 'Lake Macquarie': 'R09', 'Central Coast': 'R09',
              'Penrith': 'R10', 'Sydney': 'R10'
            };
            
            const mappedRegion = cityToRegion[dayRoster.region_name];
            if (mappedRegion) {
              regionForDay = mappedRegion;
            }
          }
        }
        
        let deals;
        // Create cache key that includes stage filter to avoid conflicts
        const cacheKey = dealStageFilter === 'all' ? `${regionForDay}_ALL` : regionForDay;
        
        if (!dealsCache[cacheKey]) {
          console.log(`🔄 Calendar: Fetching deals for region ${regionForDay} (not in cache, filter: ${dealStageFilter})`);
          
          let regionDeals;
          if (dealStageFilter === 'all') {
            // ISSUE: All regions use Pipedrive filter 222491 which is "Ready to Book" only!
            // This means "All Deals" still only shows "Lead to Book" deals from Pipedrive
            // TODO: Need different filter ID for all deals, or modify getDealsForRegion to accept no filter
            regionDeals = await getDealsForRegion(regionForDay, { limit: 500 });
            console.log(`⚠️ Calendar: "All Deals" limited to Pipedrive filter 222491 ("Ready to Book"). Fetched ${regionDeals?.length || 0} deals.`);
            console.log(`💡 To show true "All Deals": Need broader Pipedrive filter or no filter option in getDealsForRegion()`);
          } else {
            regionDeals = await getDealsForRegion(regionForDay, { limit: 200 });
          }
          
          setDealsCache(prev => ({
            ...prev,
            [cacheKey]: regionDeals || []
          }));
          // Use the fresh data immediately
          deals = regionDeals || [];
        } else {
          console.log(`📦 Calendar: Using cached deals for region ${regionForDay} (${dealsCache[cacheKey].length} deals, filter: ${dealStageFilter})`);
          deals = dealsCache[cacheKey] || [];
        }
        
        // Apply deal stage filter (same logic as DealsDebugConsole)
        const originalDealsCount = deals.length;
        if (dealStageFilter !== 'all' && deals.length > 0) {
          deals = deals.filter(deal => {
            if (!deal.stageName) return true; // Include deals without stage name
            const stageLower = deal.stageName.toLowerCase();
            
            if (dealStageFilter === 'lead_to_book') {
              return stageLower.includes('book') || 
                     stageLower.includes('to book') || 
                     stageLower.includes('ready') ||
                     stageLower === 'lead to book';
            } else if (dealStageFilter === 'lead_interested') {
              return stageLower.includes('interested') || 
                     stageLower.includes('lead interested') ||
                     stageLower.includes('qualify') ||
                     stageLower === 'lead interested';
            }
            return true;
          });
          
          // Debug logging for deal filtering
          if (originalDealsCount !== deals.length) {
            console.log(`🎯 Calendar: Stage filter '${dealStageFilter}' reduced deals from ${originalDealsCount} to ${deals.length} for region ${regionForDay}`);
          }
        }
        
        // Get ALL activities for this specific day for the selected inspector
        const dayActivities = enrichedActivities.filter(a =>
          Number(a.owner_id) === Number(selectedInspector) &&
          a.due_date === dayString &&
          !a.done &&
          a.due_time && a.due_time !== '00:00:00' &&
          !(a.subject && a.subject.includes('Inspector ENG Follow up'))
        );
        
        // Filter for activities that have coordinates
        const activitiesWithCoords = dayActivities.filter(a => a.coordinates);
        
        // Get region center for fallback when no inspections have coordinates
        const regionCenter = regionCenters[regionForDay];
        
        // Generate time slots - always include standard slots PLUS any activity-based slots
        const timeSlots = new Set(['09:00', '11:00', '13:00', '15:00']); // Always include defaults
        
        // Add additional slots from actual inspection times for better alignment  
        dayActivities.forEach(activity => {
          if (activity.due_time && activity.due_time !== '00:00:00') {
            const hour = parseInt(activity.due_time.split(':')[0]);
            const minutes = parseInt(activity.due_time.split(':')[1]);
            // Round to nearest hour for consistency
            const roundedHour = minutes >= 30 ? hour + 1 : hour;
            const slotTime = `${String(roundedHour).padStart(2, '0')}:00`;
            if (roundedHour >= 7 && roundedHour <= 18) { // Only work hours
              timeSlots.add(slotTime);
            }
          }
        });
        
        const timeSlotsArray = Array.from(timeSlots).sort();
        
        for (const timeSlot of timeSlotsArray) {
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
              id: `region-center-${regionForDay}-${dayString}-${timeSlot}`,
              coordinates: { lat: regionCenter.lat, lng: regionCenter.lng },
              personAddress: `${regionCenter.name} Center`,
              due_date: dayString,
              due_time: timeSlot,
              subject: `${regionCenter.name} Center Reference`
            };
          }
          
          if (referenceInspection && deals.length > 0) {
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
                  within2_5km,      // Keep cumulative - includes 1km deals
                  within5km,        // Keep cumulative - includes 2.5km deals  
                  within10km,       // Keep cumulative - includes 5km deals
                  within15km,       // Keep cumulative - includes 10km deals
                  within30km,       // Keep cumulative - includes 15km deals
                  // Priority radius for display (closest radius with deals)
                  radiusText: within1km > 0 ? '1km' : 
                             within2_5km > 0 ? '2.5km' :
                             within5km > 0 ? '5km' : 
                             within10km > 0 ? '10km' :
                             within15km > 0 ? '15km' : '30km',
                  referenceAddress: referenceInspection.personAddress?.substring(0, 40) || 'Unknown',
                  referenceInspection: referenceInspection // Store the full reference inspection for the modal
                };
              }
            } catch (error) {
              console.error(`Error calculating deals for ${dayString} ${timeSlot}:`, error);
            }
          }
        }
      }
      
      setTimeSlotDealCounts(counts);
      setDealCountsLoading(false);
      
    } catch (err) {
      console.error('❌ Error calculating time slot deal counts:', err);
      setDealCountsLoading(false);
    }
  }, [selectedInspector, pipedriveInspectors, selectedDate, rosterData, showOpportunities, dealStageFilter]);

  // Get week start for dependency tracking - match calendar logic (Sunday start)
  const weekStart = useMemo(() => {
    const currentDay = selectedDate.getDay();
    return addDays(selectedDate, -currentDay); // Sunday of current week
  }, [selectedDate]);
  

  // Recalculate deal counts when dependencies change (throttled)
  useEffect(() => {
    if (!showOpportunities) {
      setTimeSlotDealCounts({});
      return;
    }

    // Throttle to prevent excessive calls
    const timeoutId = setTimeout(() => {
      console.log(`🔄 Calendar: Recalculating deal counts (filter: ${dealStageFilter})`);
      calculateTimeSlotDealCounts();
    }, 200); // Reduced delay for faster response

    return () => clearTimeout(timeoutId);
  }, [selectedInspector, weekStart, showOpportunities, rosterData, dealStageFilter]);

  // Handle initial loading state
  useEffect(() => {
    if (enrichedActivities && enrichedActivities.length > 0) {
      setInitialDataLoading(false);
    }
  }, [enrichedActivities]);

  return (
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
        onDateChange={onDateChange}
        onSelectTimeSlot={onSelectTimeSlot}
        fullScreen={true}
        hoveredAppointment={hoveredAppointment}
        onAppointmentHover={onAppointmentHover}
        onAppointmentLeave={onAppointmentLeave}
        activities={enrichedActivities}
        inspectors={pipedriveInspectors}
        isLiveData={isLiveData}
        loading={initialDataLoading || loading}
        dealCountsLoading={dealCountsLoading}
        isTimeout={isTimeout}
        error={error}
        hideNavigation={true}
        enableOpportunities={showOpportunities}
        onShowDealsDebugConsole={onShowDealsDebugConsole}
        timeSlotDealCounts={timeSlotDealCounts}
        rosterData={rosterData}
      />
    </div>
  );
};

export default CalendarContainer;