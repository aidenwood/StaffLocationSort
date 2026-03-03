// Booking Time Slots Management
// Defines allowed time slots and availability logic for roof inspections

import { format, parse, isSameDay } from 'date-fns';
import { PIPEDRIVE_ACTIVITY_TYPES } from '../config/pipedriveUsers.js';

// Allowed booking times for roof inspections
export const ALLOWED_TIME_SLOTS = [
  '09:00',  // 9am
  '11:00',  // 11am
  '13:00',  // 1pm
  '15:00'   // 3pm
];

// Standard booking duration (1 hour)
export const BOOKING_DURATION = '01:00:00';

// Time slot labels for display
export const TIME_SLOT_LABELS = {
  '09:00': '9:00 AM',
  '11:00': '11:00 AM', 
  '13:00': '1:00 PM',
  '15:00': '3:00 PM'
};

// Check if a time slot is valid for booking
export const isValidTimeSlot = (timeString) => {
  return ALLOWED_TIME_SLOTS.includes(timeString);
};

// Get all available time slots for display
export const getAllTimeSlots = () => {
  return ALLOWED_TIME_SLOTS.map(time => ({
    value: time,
    label: TIME_SLOT_LABELS[time],
    duration: BOOKING_DURATION
  }));
};

// Check if a time slot is available based on existing activities
export const isTimeSlotAvailable = (timeSlot, date, existingActivities = []) => {
  const targetDate = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  
  // Check if this exact time slot is already booked
  const isBooked = existingActivities.some(activity => {
    if (activity.due_date !== targetDate) return false;
    
    const activityTime = activity.due_time ? activity.due_time.substring(0, 5) : '';
    return activityTime === timeSlot;
  });
  
  if (isBooked) return false;
  
  // Check for blocking activities (Day Off, Flying, etc.)
  const hasBlockingActivity = existingActivities.some(activity => {
    if (activity.due_date !== targetDate) return false;
    
    const activityType = activity.type || activity.subject || '';
    
    // Full day blocks
    if (activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.DAY_OFF) ||
        activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.FLYING)) {
      return true;
    }
    
    // Time-specific blocks (travelling)
    if (activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.TRAVELLING)) {
      const activityTime = activity.due_time ? activity.due_time.substring(0, 5) : '';
      const activityEndTime = calculateEndTime(activityTime, activity.duration || '01:00:00');
      
      // Check if the travelling activity overlaps with our time slot
      const slotEndTime = calculateEndTime(timeSlot, BOOKING_DURATION);
      
      return timeOverlaps(timeSlot, slotEndTime, activityTime, activityEndTime);
    }
    
    return false;
  });
  
  return !hasBlockingActivity;
};

// Calculate end time given start time and duration
export const calculateEndTime = (startTime, duration) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [durationHour, durationMin] = duration.split(':').map(Number);
  
  const totalMinutes = (startHour * 60 + startMin) + (durationHour * 60 + durationMin);
  const endHour = Math.floor(totalMinutes / 60);
  const endMin = totalMinutes % 60;
  
  return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
};

// Check if two time ranges overlap
export const timeOverlaps = (start1, end1, start2, end2) => {
  const parseTime = (timeStr) => {
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
  };
  
  const start1Min = parseTime(start1);
  const end1Min = parseTime(end1);
  const start2Min = parseTime(start2);
  const end2Min = parseTime(end2);
  
  return start1Min < end2Min && start2Min < end1Min;
};

// Get available time slots for a specific date
export const getAvailableSlots = (date, existingActivities = []) => {
  return ALLOWED_TIME_SLOTS.filter(timeSlot => 
    isTimeSlotAvailable(timeSlot, date, existingActivities)
  ).map(time => ({
    value: time,
    label: TIME_SLOT_LABELS[time],
    duration: BOOKING_DURATION
  }));
};

// Get next available time slot
export const getNextAvailableSlot = (date, existingActivities = []) => {
  const availableSlots = getAvailableSlots(date, existingActivities);
  return availableSlots.length > 0 ? availableSlots[0] : null;
};

// Validate booking data before creation
export const validateBookingData = (bookingData) => {
  const errors = [];
  
  // Check required fields
  if (!bookingData.time) {
    errors.push('Time is required');
  }
  
  if (!bookingData.date) {
    errors.push('Date is required');
  }
  
  if (!bookingData.inspector) {
    errors.push('Inspector is required');
  }
  
  // Validate time slot
  if (bookingData.time && !isValidTimeSlot(bookingData.time)) {
    errors.push(`Invalid time slot. Allowed times: ${ALLOWED_TIME_SLOTS.join(', ')}`);
  }
  
  // Validate date is not in the past (allow today)
  if (bookingData.date) {
    const bookingDate = new Date(bookingData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (bookingDate < today) {
      errors.push('Cannot book appointments in the past');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Create standardized activity subject for inspections
export const createInspectionSubject = (inspectorName, address) => {
  const suburb = extractSuburb(address);
  return `Property Inspection - ${inspectorName} - ${suburb}`;
};

// Extract suburb from full address
export const extractSuburb = (address) => {
  if (!address) return '';
  
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[1].trim();
  }
  
  // Fallback to extract from address pattern
  const addressParts = address.split(' ');
  if (addressParts.length >= 3) {
    return addressParts.slice(-3, -2).join(' ');
  }
  
  return address;
};

// Get booking conflict information
export const getBookingConflicts = (timeSlot, date, existingActivities = []) => {
  const targetDate = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  
  const conflicts = existingActivities.filter(activity => {
    if (activity.due_date !== targetDate) return false;
    
    const activityTime = activity.due_time ? activity.due_time.substring(0, 5) : '';
    const activityType = activity.type || activity.subject || '';
    
    // Direct time conflict
    if (activityTime === timeSlot) {
      return true;
    }
    
    // Blocking activity conflicts
    if (activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.DAY_OFF) ||
        activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.FLYING)) {
      return true;
    }
    
    // Travelling conflicts
    if (activityType.includes(PIPEDRIVE_ACTIVITY_TYPES.TRAVELLING)) {
      const activityEndTime = calculateEndTime(activityTime, activity.duration || '01:00:00');
      const slotEndTime = calculateEndTime(timeSlot, BOOKING_DURATION);
      
      return timeOverlaps(timeSlot, slotEndTime, activityTime, activityEndTime);
    }
    
    return false;
  });
  
  return conflicts;
};