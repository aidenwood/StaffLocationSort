// Time Slot Deals Analyzer
// Analyzes opportunities to book nearby deals in available time slots

import { format, eachDayOfInterval, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { calculateDistance } from './regionValidation.js';
import { ALLOWED_TIME_SLOTS, TIME_SLOT_LABELS, isTimeSlotAvailable } from './bookingSlots.js';

/**
 * Analyze deals near existing bookings for available time slots
 * @param {Array} deals - Array of deals with coordinates and distanceInfo
 * @param {Array} activities - Array of existing activities/bookings
 * @param {Date} selectedDate - Current date for weekly analysis
 * @param {number} proximityThreshold - Distance threshold in km (default 1km)
 * @returns {Object} Analysis results by day and time slot
 */
export const analyzeDealsNearTimeSlots = (deals = [], activities = [], selectedDate = new Date(), proximityThreshold = 1) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
  
  // Only analyze weekdays (Monday to Friday)
  const weekdays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter(day => day.getDay() >= 1 && day.getDay() <= 5);

  const analysis = {};

  weekdays.forEach(day => {
    const dateString = format(day, 'yyyy-MM-dd');
    analysis[dateString] = {
      date: day,
      dateString,
      dayName: format(day, 'EEEE'),
      timeSlots: {}
    };

    // Analyze each allowed time slot for this day
    ALLOWED_TIME_SLOTS.forEach(timeSlot => {
      const slotAnalysis = {
        time: timeSlot,
        label: TIME_SLOT_LABELS[timeSlot],
        available: isTimeSlotAvailable(timeSlot, day, activities),
        existingBooking: null,
        nearbyOpportunities: [],
        totalNearbyDeals: 0,
        optimizationScore: 0
      };

      // Check if there's an existing booking at this time
      const existingBooking = activities.find(activity => {
        if (activity.due_date !== dateString) return false;
        const activityTime = activity.due_time ? activity.due_time.substring(0, 5) : '';
        return activityTime === timeSlot;
      });

      if (existingBooking) {
        slotAnalysis.existingBooking = existingBooking;
        
        // If there's a booking with coordinates, find nearby deals
        if (existingBooking.coordinates) {
          const nearbyDeals = findDealsNearLocation(
            deals,
            existingBooking.coordinates,
            proximityThreshold
          );
          
          slotAnalysis.nearbyOpportunities = nearbyDeals;
          slotAnalysis.totalNearbyDeals = nearbyDeals.length;
        }
      } else if (slotAnalysis.available) {
        // For available slots, check proximity to other bookings on the same day
        const dayActivities = activities.filter(activity => 
          activity.due_date === dateString && 
          activity.coordinates &&
          activity.due_time && 
          activity.due_time !== '00:00:00'
        );

        // Find deals that would be near any existing booking on this day
        const potentialOpportunities = new Map();
        
        dayActivities.forEach(activity => {
          const nearbyDeals = findDealsNearLocation(
            deals,
            activity.coordinates,
            proximityThreshold
          );
          
          nearbyDeals.forEach(deal => {
            const key = deal.id;
            if (!potentialOpportunities.has(key)) {
              potentialOpportunities.set(key, {
                ...deal,
                nearActivities: [],
                minDistanceToBookings: Infinity
              });
            }
            
            const existingDeal = potentialOpportunities.get(key);
            existingDeal.nearActivities.push({
              activity,
              distance: deal.distanceToLocation
            });
            
            if (deal.distanceToLocation < existingDeal.minDistanceToBookings) {
              existingDeal.minDistanceToBookings = deal.distanceToLocation;
            }
          });
        });

        slotAnalysis.nearbyOpportunities = Array.from(potentialOpportunities.values());
        slotAnalysis.totalNearbyDeals = slotAnalysis.nearbyOpportunities.length;
        
        // Calculate optimization score based on nearby deals and proximity
        slotAnalysis.optimizationScore = calculateOptimizationScore(
          slotAnalysis.nearbyOpportunities,
          dayActivities.length
        );
      }

      analysis[dateString].timeSlots[timeSlot] = slotAnalysis;
    });
  });

  return analysis;
};

/**
 * Find deals within a specified distance of a location
 * @param {Array} deals - Array of deals with coordinates
 * @param {Object} location - { lat, lng }
 * @param {number} threshold - Distance threshold in km
 * @returns {Array} Deals within threshold distance
 */
export const findDealsNearLocation = (deals, location, threshold) => {
  if (!location || !location.lat || !location.lng) {
    return [];
  }

  return deals
    .filter(deal => deal.coordinates && deal.coordinates.lat && deal.coordinates.lng)
    .map(deal => {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        deal.coordinates.lat,
        deal.coordinates.lng
      );
      
      return {
        ...deal,
        distanceToLocation: Math.round(distance * 100) / 100
      };
    })
    .filter(deal => deal.distanceToLocation <= threshold)
    .sort((a, b) => a.distanceToLocation - b.distanceToLocation);
};

/**
 * Calculate optimization score for a time slot
 * Higher score = better opportunity for booking
 * @param {Array} nearbyDeals - Deals near existing bookings
 * @param {number} existingBookingsCount - Number of existing bookings on the day
 * @returns {number} Optimization score (0-100)
 */
export const calculateOptimizationScore = (nearbyDeals, existingBookingsCount) => {
  if (nearbyDeals.length === 0) return 0;
  
  // Base score from number of nearby deals
  let score = Math.min(nearbyDeals.length * 10, 50);
  
  // Bonus for having existing bookings to optimize around
  if (existingBookingsCount > 0) {
    score += 20;
  }
  
  // Bonus for very close deals (within 0.5km)
  const veryCloseDeals = nearbyDeals.filter(deal => deal.minDistanceToBookings <= 0.5);
  score += veryCloseDeals.length * 5;
  
  // Bonus for high-value deals
  const highValueDeals = nearbyDeals.filter(deal => (deal.value || 0) > 1000);
  score += highValueDeals.length * 10;
  
  return Math.min(score, 100);
};

/**
 * Get summary statistics for the week
 * @param {Object} weekAnalysis - Result from analyzeDealsNearTimeSlots
 * @returns {Object} Summary statistics
 */
export const getWeekSummary = (weekAnalysis) => {
  const summary = {
    totalOpportunities: 0,
    totalNearbyDeals: 0,
    availableSlots: 0,
    occupiedSlots: 0,
    highValueOpportunities: 0,
    bestOpportunitySlot: null,
    bestOpportunityScore: 0
  };

  Object.values(weekAnalysis).forEach(dayAnalysis => {
    Object.values(dayAnalysis.timeSlots).forEach(slotAnalysis => {
      if (slotAnalysis.available) {
        summary.availableSlots++;
        if (slotAnalysis.totalNearbyDeals > 0) {
          summary.totalOpportunities++;
          summary.totalNearbyDeals += slotAnalysis.totalNearbyDeals;
          
          if (slotAnalysis.optimizationScore > summary.bestOpportunityScore) {
            summary.bestOpportunityScore = slotAnalysis.optimizationScore;
            summary.bestOpportunitySlot = {
              date: dayAnalysis.dateString,
              time: slotAnalysis.time,
              label: slotAnalysis.label,
              score: slotAnalysis.optimizationScore,
              nearbyDeals: slotAnalysis.totalNearbyDeals
            };
          }
          
          // Count high-value opportunities (score > 50)
          if (slotAnalysis.optimizationScore > 50) {
            summary.highValueOpportunities++;
          }
        }
      } else {
        summary.occupiedSlots++;
      }
    });
  });

  return summary;
};

/**
 * Group deals by their proximity to different time slots
 * @param {Array} deals - Array of deals with coordinates
 * @param {Object} weekAnalysis - Result from analyzeDealsNearTimeSlots
 * @returns {Array} Deals grouped by opportunities
 */
export const groupDealsByOpportunity = (deals, weekAnalysis) => {
  const dealOpportunities = new Map();

  Object.values(weekAnalysis).forEach(dayAnalysis => {
    Object.values(dayAnalysis.timeSlots).forEach(slotAnalysis => {
      if (slotAnalysis.available && slotAnalysis.nearbyOpportunities.length > 0) {
        slotAnalysis.nearbyOpportunities.forEach(deal => {
          const dealId = deal.id;
          if (!dealOpportunities.has(dealId)) {
            dealOpportunities.set(dealId, {
              ...deal,
              opportunities: []
            });
          }
          
          dealOpportunities.get(dealId).opportunities.push({
            date: dayAnalysis.dateString,
            dayName: dayAnalysis.dayName,
            time: slotAnalysis.time,
            label: slotAnalysis.label,
            optimizationScore: slotAnalysis.optimizationScore,
            distanceToBookings: deal.minDistanceToBookings || deal.distanceToLocation
          });
        });
      }
    });
  });

  // Convert to array and sort by best opportunity scores
  return Array.from(dealOpportunities.values())
    .map(deal => ({
      ...deal,
      bestOpportunityScore: Math.max(...deal.opportunities.map(opp => opp.optimizationScore))
    }))
    .sort((a, b) => b.bestOpportunityScore - a.bestOpportunityScore);
};

export default {
  analyzeDealsNearTimeSlots,
  findDealsNearLocation,
  calculateOptimizationScore,
  getWeekSummary,
  groupDealsByOpportunity
};