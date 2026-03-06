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
 * Convert UTC time to Australian local time
 */
export const convertToAustralianTime = (utcTimeString, region = 'QLD', forceDST = null) => {
  if (!utcTimeString) return { time: '09:00', timezone: 'AEST' };
  
  try {
    // Parse the UTC time (could be just "HH:MM" or full datetime)
    let utcDate;
    if (utcTimeString.includes('T') || utcTimeString.includes(' ')) {
      utcDate = new Date(utcTimeString);
    } else {
      // Just time format like "14:30" - assume today
      const today = new Date();
      const [hours, minutes] = utcTimeString.split(':');
      utcDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                        parseInt(hours), parseInt(minutes), 0, 0);
    }
    
    if (isNaN(utcDate.getTime())) {
      return { time: utcTimeString, timezone: 'UTC' };
    }
    
    // Determine timezone based on region and daylight saving
    let timezone, timezoneCode;
    
    if (region === 'QLD') {
      // Queensland - always AEST (UTC+10), no daylight saving
      timezone = TIMEZONES.AEST;
      timezoneCode = 'AEST';
    } else if (region === 'NSW') {
      // NSW - check if daylight saving is active
      const isDST = forceDST !== null ? forceDST : isNSWDaylightSaving(utcDate);
      timezone = TIMEZONES.AEDT; // Sydney handles DST automatically
      timezoneCode = isDST ? 'AEDT' : 'AEST';
    } else {
      // Default to QLD time
      timezone = TIMEZONES.AEST;
      timezoneCode = 'AEST';
    }
    
    // Convert to local time
    const localTime = utcDate.toLocaleTimeString('en-AU', {
      timeZone: timezone,
      hour12: true,
      hour: 'numeric',
      minute: '2-digit'
    });
    
    return {
      time: localTime,
      timezone: timezoneCode,
      utcOffset: region === 'QLD' ? '+10' : (timezoneCode === 'AEDT' ? '+11' : '+10')
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
  return `${converted.time} ${converted.timezone}`;
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