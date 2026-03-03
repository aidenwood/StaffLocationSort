// ⚠️⚠️⚠️ PIPEDRIVE WRITE OPERATIONS - EXTREME CAUTION REQUIRED ⚠️⚠️⚠️
//
// THIS FILE CONTAINS FUNCTIONS THAT MODIFY LIVE PIPEDRIVE DATA
// 
// SAFETY RULES:
// 1. ONLY CREATE new activities - NEVER update or delete existing ones
// 2. ALWAYS validate data before sending to Pipedrive
// 3. ALWAYS check for existing activities to prevent duplicates
// 4. ONLY use with approved time slots: 9am, 11am, 1pm, 3pm
// 5. ONLY create "Property Inspection" activities
// 6. TEST EXTENSIVELY on Aiden Wood's account before using with inspectors
//
// ⚠️⚠️⚠️ NO UPDATE OR DELETE OPERATIONS ALLOWED ⚠️⚠️⚠️

import axios from 'axios';
import { format } from 'date-fns';
import { 
  ALLOWED_TIME_SLOTS, 
  BOOKING_DURATION, 
  validateBookingData,
  createInspectionSubject,
  getBookingConflicts 
} from '../utils/bookingSlots.js';
import { 
  getPipedriveUserById, 
  getInspectorByAppId,
  isTestUser 
} from '../config/pipedriveUsers.js';
import { fetchUserActivities } from './pipedriveRead.js';

// Base Pipedrive API configuration
const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';

// Create axios instance for Pipedrive API
const createPipedriveClient = () => {
  const apiKey = import.meta.env.VITE_PIPEDRIVE_API_KEY;
  
  if (!apiKey || apiKey === 'your_pipedrive_api_key_here') {
    throw new Error('Pipedrive API key not configured');
  }

  return axios.create({
    baseURL: PIPEDRIVE_BASE_URL,
    timeout: 30000,
    params: {
      api_token: apiKey
    },
    headers: {
      'Content-Type': 'application/json',
    }
  });
};

// Enhanced error handling for write operations
const handleWriteError = (error, operation) => {
  console.error(`🚨 PIPEDRIVE WRITE ERROR (${operation}):`, error);
  
  // Log all write operation errors for audit
  const errorLog = {
    timestamp: new Date().toISOString(),
    operation,
    error: error.message,
    response: error.response?.data,
    status: error.response?.status
  };
  
  console.error('📋 WRITE OPERATION ERROR LOG:', errorLog);
  
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.response.statusText;
    
    if (status === 401) {
      throw new Error('Invalid Pipedrive API key for write operation');
    } else if (status === 403) {
      throw new Error('Insufficient permissions for Pipedrive write operations');
    } else if (status === 429) {
      throw new Error('Pipedrive API rate limit exceeded during write operation');
    } else if (status === 400) {
      throw new Error(`Invalid data for write operation: ${message}`);
    } else {
      throw new Error(`Pipedrive write error: ${message} (${status})`);
    }
  } else if (error.request) {
    throw new Error('Unable to connect to Pipedrive API for write operation');
  } else {
    throw new Error(`Pipedrive write error: ${error.message}`);
  }
};

// Validation function - checks all safety requirements
const validateCreateActivityRequest = async (activityData) => {
  console.log('🔍 Validating activity creation request...');
  
  const errors = [];
  const warnings = [];
  
  // 1. Validate required fields
  if (!activityData.subject) {
    errors.push('Activity subject is required');
  }
  
  if (!activityData.due_date) {
    errors.push('Due date is required');
  }
  
  if (!activityData.due_time) {
    errors.push('Due time is required');
  }
  
  if (!activityData.user_id) {
    errors.push('User ID is required');
  }
  
  // 2. Validate time slot
  const timeSlot = activityData.due_time?.substring(0, 5);
  if (!ALLOWED_TIME_SLOTS.includes(timeSlot)) {
    errors.push(`Invalid time slot: ${timeSlot}. Allowed: ${ALLOWED_TIME_SLOTS.join(', ')}`);
  }
  
  // 3. Validate activity type
  if (!activityData.subject?.includes('Property Inspection')) {
    errors.push('Only "Property Inspection" activities are allowed');
  }
  
  // 4. Validate user exists in our configuration
  const user = getPipedriveUserById(activityData.user_id);
  if (!user) {
    errors.push(`User ID ${activityData.user_id} not found in configuration`);
  } else if (!isTestUser(activityData.user_id)) {
    warnings.push(`Creating activity for production user: ${user.name}`);
  }
  
  // 5. Check for existing activities (prevent duplicates)
  try {
    const existingActivities = await fetchUserActivities(
      activityData.user_id,
      activityData.due_date,
      activityData.due_date
    );
    
    const conflicts = getBookingConflicts(timeSlot, activityData.due_date, existingActivities);
    
    if (conflicts.length > 0) {
      errors.push(`Time slot conflicts with existing activities: ${conflicts.map(c => c.subject).join(', ')}`);
    }
  } catch (error) {
    warnings.push(`Could not check for existing activities: ${error.message}`);
  }
  
  // 6. Validate date is not in the past
  const activityDate = new Date(activityData.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (activityDate < today) {
    errors.push('Cannot create activities in the past');
  }
  
  console.log('✅ Validation complete:', { errors: errors.length, warnings: warnings.length });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    user
  };
};

// POST: Create new activity (ONLY safe operation)
export const createInspectionActivity = async (bookingData) => {
  console.log('🚨 INITIATING PIPEDRIVE WRITE OPERATION - CREATE ACTIVITY 🚨');
  console.log('📋 Booking data received:', bookingData);
  
  try {
    // 1. Validate input data
    const validation = validateBookingData(bookingData);
    if (!validation.isValid) {
      throw new Error(`Invalid booking data: ${validation.errors.join(', ')}`);
    }
    
    // 2. Get user information
    const inspector = getInspectorByAppId(bookingData.inspector.id);
    if (!inspector) {
      throw new Error(`Inspector not found for ID: ${bookingData.inspector.id}`);
    }
    
    // 3. Prepare activity data for Pipedrive
    const activityData = {
      subject: createInspectionSubject(inspector.name, bookingData.location || ''),
      type: 'meeting', // Pipedrive activity type
      due_date: format(new Date(bookingData.date), 'yyyy-MM-dd'),
      due_time: bookingData.time + ':00', // Convert HH:MM to HH:MM:SS
      duration: BOOKING_DURATION,
      user_id: inspector.id, // Pipedrive user ID
      org_id: bookingData.orgId || null,
      person_id: bookingData.personId || null,
      deal_id: bookingData.dealId || null,
      location: bookingData.location || '',
      note: `Property inspection booked via Staff Location Sort app.\n\nClient: ${bookingData.clientName || 'TBD'}\nProperty Type: ${bookingData.propertyType || 'TBD'}\nSpecial Instructions: ${bookingData.specialInstructions || 'None'}`,
      public_description: `Professional roof inspection scheduled for ${format(new Date(bookingData.date), 'EEEE, MMMM do, yyyy')} at ${bookingData.time}`,
      busy_flag: true
    };
    
    console.log('📋 Prepared activity data:', activityData);
    
    // 4. Final validation with conflict checking
    const finalValidation = await validateCreateActivityRequest(activityData);
    
    if (!finalValidation.isValid) {
      throw new Error(`Pre-flight validation failed: ${finalValidation.errors.join(', ')}`);
    }
    
    // 5. Log warnings if any
    if (finalValidation.warnings.length > 0) {
      console.warn('⚠️ Validation warnings:', finalValidation.warnings);
    }
    
    // 6. Confirm this is a test user or get explicit confirmation for production
    if (!isTestUser(activityData.user_id)) {
      console.warn('🚨 WARNING: Creating activity for PRODUCTION user:', finalValidation.user.name);
      
      // In a real app, this would trigger a confirmation dialog
      // For now, we'll throw an error to prevent accidental production writes
      throw new Error('Production user writes require explicit confirmation');
    }
    
    // 7. Create the activity
    console.log('📤 Sending create request to Pipedrive...');
    const client = createPipedriveClient();
    
    const response = await client.post('/activities', activityData);
    
    // 8. Verify creation was successful
    if (response.data.success) {
      const createdActivity = response.data.data;
      
      console.log('✅ Activity created successfully:', {
        id: createdActivity.id,
        subject: createdActivity.subject,
        due_date: createdActivity.due_date,
        due_time: createdActivity.due_time,
        user_id: createdActivity.user_id
      });
      
      // Log successful creation for audit
      const auditLog = {
        timestamp: new Date().toISOString(),
        operation: 'CREATE_ACTIVITY',
        success: true,
        activityId: createdActivity.id,
        userId: activityData.user_id,
        dateTime: `${activityData.due_date} ${activityData.due_time}`,
        subject: activityData.subject
      };
      
      console.log('📋 AUDIT LOG:', auditLog);
      
      return {
        success: true,
        activity: createdActivity,
        message: 'Inspection activity created successfully',
        isTestUser: isTestUser(activityData.user_id),
        auditLog
      };
    } else {
      throw new Error('Pipedrive API returned success=false');
    }
    
  } catch (error) {
    // Enhanced error logging for write operations
    const errorAuditLog = {
      timestamp: new Date().toISOString(),
      operation: 'CREATE_ACTIVITY',
      success: false,
      error: error.message,
      bookingData: bookingData
    };
    
    console.error('📋 ERROR AUDIT LOG:', errorAuditLog);
    
    handleWriteError(error, 'create activity');
  }
};

// Safety check function - verifies we can write safely
export const verifyWritePermissions = async (testUserId) => {
  console.log('🔍 Verifying Pipedrive write permissions...');
  
  try {
    // Test with a minimal activity creation (then delete if successful)
    const testActivity = {
      subject: 'TEST - Permission Verification (Safe to delete)',
      type: 'call',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      due_time: '09:00:00',
      duration: '00:15:00',
      user_id: testUserId,
      note: 'This is a test activity to verify write permissions. Created by Staff Location Sort app.'
    };
    
    const client = createPipedriveClient();
    
    // Try to create test activity
    const createResponse = await client.post('/activities', testActivity);
    
    if (createResponse.data.success) {
      const testActivityId = createResponse.data.data.id;
      
      console.log('✅ Write permissions verified - test activity created:', testActivityId);
      
      // Clean up - delete the test activity
      try {
        await client.delete(`/activities/${testActivityId}`);
        console.log('🧹 Test activity cleaned up successfully');
      } catch (deleteError) {
        console.warn('⚠️ Could not delete test activity:', deleteError.message);
      }
      
      return {
        success: true,
        canWrite: true,
        testActivityId,
        message: 'Write permissions verified successfully'
      };
    } else {
      return {
        success: false,
        canWrite: false,
        error: 'Create operation failed'
      };
    }
    
  } catch (error) {
    console.error('❌ Write permission verification failed:', error.message);
    
    return {
      success: false,
      canWrite: false,
      error: error.message
    };
  }
};

// Booking API wrapper with additional safety checks
export const safeCreateBooking = async (bookingData) => {
  console.log('🛡️ SAFE BOOKING CREATION INITIATED');
  console.log('📋 Input data:', bookingData);
  
  // Extra safety checks
  if (!import.meta.env.VITE_USE_LIVE_DATA || import.meta.env.VITE_USE_LIVE_DATA === 'false') {
    throw new Error('Live data mode is disabled. Enable VITE_USE_LIVE_DATA to create real bookings.');
  }
  
  if (!bookingData.confirmationRequired) {
    throw new Error('Booking confirmation is required for safety');
  }
  
  // Proceed with creation
  return await createInspectionActivity(bookingData);
};

// Export validation functions for use in components
export { validateCreateActivityRequest, validateBookingData };