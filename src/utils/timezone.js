// Australian Timezone Utilities for QLD/NSW Inspectors

/**
 * Australian Timezone Handling
 * 
 * Queensland (QLD): No daylight saving - always AEST (UTC+10)
 * New South Wales (NSW): Daylight saving Oct-Apr
 *   - Summer (Oct-Apr): AEDT (UTC+11) 
 *   - Winter (Apr-Oct): AEST (UTC+10)
 */

// Timezone constants
export const TIMEZONES = {
  AEST: 'Australia/Brisbane', // QLD - no daylight saving
  AEDT: 'Australia/Sydney',   // NSW - with daylight saving
};

/**
 * Check if a date falls within NSW daylight saving period
 * Daylight saving: First Sunday in October to First Sunday in April
 */
export const isNSWDaylightSaving = (date = new Date()) => {
  const year = date.getFullYear();
  
  // First Sunday in October (start of daylight saving)
  const octFirst = new Date(year, 9, 1); // October 1st
  const dstStart = new Date(year, 9, 1 + (7 - octFirst.getDay()) % 7);
  
  // First Sunday in April (end of daylight saving) 
  const aprFirst = new Date(year + 1, 3, 1); // April 1st next year
  const dstEnd = new Date(year + 1, 3, 1 + (7 - aprFirst.getDay()) % 7);
  
  return date >= dstStart && date < dstEnd;
};

/**
 * Convert UTC time to Australian local time - SIMPLE 10 hour addition
 */
export const convertToAustralianTime = (utcTimeString, region = 'QLD', forceDST = null) => {
  if (!utcTimeString || utcTimeString === '00:00:00') return { time: '09:00 AM', timezone: 'AEST' };
  
  try {
    // Extract hours and minutes from time string like "14:30:00" or "14:30"
    const timePart = utcTimeString.split(':');
    let hours = parseInt(timePart[0]);
    const minutes = parseInt(timePart[1]) || 0;
    
    // Add 10 hours for Australian timezone
    hours = hours + 10;
    
    // Handle day rollover
    if (hours >= 24) {
      hours = hours - 24;
    }
    
    // Return 24-hour format for calendar use
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Also provide 12-hour format
    const isPM = hours >= 12;
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = isPM ? 'PM' : 'AM';
    const time12Hour = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    
    return {
      time: timeString, // 24-hour format
      time12Hour: time12Hour, // 12-hour format 
      timezone: 'AEST',
      utcOffset: '+10'
    };
    
  } catch (error) {
    console.warn('Error converting time:', error);
    return { time: utcTimeString, timezone: 'UTC' };
  }
};

/**
 * Format activity time for display  
 */
export const formatActivityTime = (dueTime, region = 'QLD', forceDST = null) => {
  const converted = convertToAustralianTime(dueTime, region, forceDST);
  return `${converted.time12Hour} ${converted.timezone}`;
};

/**
 * Get inspector's region from configuration
 */
export const getInspectorRegion = (inspectorConfig) => {
  // Default to QLD if no region specified
  return inspectorConfig?.region || 'QLD';
};

/**
 * Check if daylight saving toggle should be shown
 */
export const shouldShowDSTToggle = (region) => {
  return region === 'NSW'; // Only NSW has daylight saving
};