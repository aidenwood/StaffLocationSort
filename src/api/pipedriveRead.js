// Pipedrive READ-ONLY API Service
// ⚠️ THIS FILE CONTAINS ONLY GET REQUESTS - NO WRITE OPERATIONS
// Safe for production use - only reads data from Pipedrive

import axios from 'axios';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  PIPEDRIVE_ACTIVITY_TYPES,
  getPipedriveUserById,
  getInspectorByAppId,
  isTestUser
} from '../config/pipedriveUsers.js';

// Base Pipedrive API configuration
const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';
const PIPEDRIVE_V2_BASE_URL = 'https://api.pipedrive.com/v2';

// Create axios instance for Pipedrive API
const createPipedriveClient = (useV2 = false) => {
  const apiKey = import.meta.env.VITE_PIPEDRIVE_API_KEY;
  
  if (!apiKey || apiKey === 'your_pipedrive_api_key_here') {
    throw new Error('Pipedrive API key not configured');
  }

  return axios.create({
    baseURL: useV2 ? PIPEDRIVE_V2_BASE_URL : PIPEDRIVE_BASE_URL,
    timeout: 30000,
    params: {
      api_token: apiKey
    },
    headers: {
      'Content-Type': 'application/json',
    }
  });
};

// Error handling wrapper
const handleApiError = (error, operation) => {
  console.error(`Pipedrive API Error (${operation}):`, error);
  
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.response.statusText;
    
    if (status === 401) {
      throw new Error('Invalid Pipedrive API key');
    } else if (status === 403) {
      throw new Error('Insufficient permissions for Pipedrive API');
    } else if (status === 429) {
      throw new Error('Pipedrive API rate limit exceeded');
    } else {
      throw new Error(`Pipedrive API error: ${message} (${status})`);
    }
  } else if (error.request) {
    throw new Error('Unable to connect to Pipedrive API');
  } else {
    throw new Error(`Pipedrive API error: ${error.message}`);
  }
};

// GET: Test API connection
export const testPipedriveConnection = async () => {
  try {
    const client = createPipedriveClient();
    const response = await client.get('/users/me');
    
    console.log('✅ Pipedrive API connection successful:', response.data.data);
    
    return {
      success: true,
      user: response.data.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    handleApiError(error, 'connection test');
  }
};

// GET: Fetch all users (for mapping to inspectors)
export const fetchPipedriveUsers = async () => {
  try {
    const client = createPipedriveClient();
    const response = await client.get('/users', {
      params: {
        limit: 100
      }
    });
    
    console.log('📋 Fetched Pipedrive users:', response.data.data?.length || 0);
    
    return response.data.data || [];
  } catch (error) {
    handleApiError(error, 'fetch users');
  }
};

// GET: Fetch activities for a specific user
export const fetchUserActivities = async (userId, startDate = null, endDate = null) => {
  try {
    const client = createPipedriveClient();
    
    // Prepare date parameters
    const params = {
      user_id: userId,
      limit: 500, // Max allowed by Pipedrive
      sort: 'due_date ASC'
    };
    
    // Add date filters if provided
    if (startDate) {
      params.start_date = format(startOfDay(new Date(startDate)), 'yyyy-MM-dd');
    }
    
    if (endDate) {
      params.end_date = format(endOfDay(new Date(endDate)), 'yyyy-MM-dd');
    }
    
    console.log(`📅 Fetching activities for user ${userId}:`, params);
    
    const response = await client.get('/activities', { params });
    
    const activities = response.data.data || [];
    console.log(`✅ Fetched ${activities.length} activities for user ${userId}`);
    
    return activities;
  } catch (error) {
    handleApiError(error, `fetch activities for user ${userId}`);
  }
};

// GET: Fetch activities for a specific date range
export const fetchActivitiesByDateRange = async (startDate, endDate, userId = null) => {
  try {
    const client = createPipedriveClient();
    
    const params = {
      start_date: format(startOfDay(new Date(startDate)), 'yyyy-MM-dd'),
      end_date: format(endOfDay(new Date(endDate)), 'yyyy-MM-dd'),
      limit: 500,
      sort: 'due_date ASC'
    };
    
    // Filter by specific user if provided
    if (userId) {
      params.user_id = userId;
    }
    
    console.log('📅 Fetching activities by date range:', params);
    
    const response = await client.get('/activities', { params });
    
    const activities = response.data.data || [];
    console.log(`✅ Fetched ${activities.length} activities in date range`);
    
    return activities;
  } catch (error) {
    handleApiError(error, 'fetch activities by date range');
  }
};

// GET: Fetch single activity by ID
export const fetchActivityById = async (activityId) => {
  try {
    const client = createPipedriveClient();
    
    console.log(`📋 Fetching activity ${activityId}`);
    
    const response = await client.get(`/activities/${activityId}`);
    
    console.log(`✅ Fetched activity ${activityId}:`, response.data.data.subject);
    
    return response.data.data;
  } catch (error) {
    handleApiError(error, `fetch activity ${activityId}`);
  }
};

// Transform Pipedrive activity to app format
export const transformPipedriveActivity = (pipedriveActivity) => {
  if (!pipedriveActivity) return null;
  
  const user = getPipedriveUserById(pipedriveActivity.user_id);
  const isTest = isTestUser(pipedriveActivity.user_id);
  
  return {
    // Keep original Pipedrive structure
    id: pipedriveActivity.id,
    company_id: pipedriveActivity.company_id,
    owner_id: user?.appId || pipedriveActivity.user_id,
    creator_user_id: pipedriveActivity.user_id,
    is_deleted: pipedriveActivity.active_flag === false,
    done: pipedriveActivity.done,
    type: determineActivityType(pipedriveActivity.subject || ''),
    
    // Time and date
    due_date: pipedriveActivity.due_date,
    due_time: pipedriveActivity.due_time || '09:00:00',
    duration: '01:00:00', // Default 1 hour for inspections
    busy: true,
    
    // Timestamps
    add_time: pipedriveActivity.add_time,
    update_time: pipedriveActivity.update_time,
    marked_as_done_time: pipedriveActivity.marked_as_done_time,
    
    // Content
    subject: pipedriveActivity.subject || '',
    public_description: pipedriveActivity.public_description || '',
    note: pipedriveActivity.note || '',
    
    // Location handling
    location: transformLocationData(pipedriveActivity.location),
    location_lat: pipedriveActivity.location_lat || null,
    location_lng: pipedriveActivity.location_lng || null,
    
    // Related IDs
    org_id: pipedriveActivity.org_id,
    person_id: pipedriveActivity.person_id,
    deal_id: pipedriveActivity.deal_id,
    lead_id: pipedriveActivity.lead_id,
    project_id: pipedriveActivity.project_id,
    
    // Additional metadata
    source_timezone: 'Australia/Brisbane',
    isFromPipedrive: true,
    isTestData: isTest,
    originalData: pipedriveActivity // Keep original for debugging
  };
};

// Determine activity type based on subject
const determineActivityType = (subject) => {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes('property inspection')) {
    return 'roof_inspection';
  } else if (subjectLower.includes('day off')) {
    return 'day_off';
  } else if (subjectLower.includes('travelling')) {
    return 'travelling';
  } else if (subjectLower.includes('flying')) {
    return 'flying';
  }
  
  return 'other';
};

// Transform location data from Pipedrive format
const transformLocationData = (pipedriveLocation) => {
  if (!pipedriveLocation) {
    return {
      value: '',
      country: 'Australia',
      admin_area_level_1: 'Queensland',
      admin_area_level_2: null,
      locality: '',
      sublocality: null,
      route: '',
      street_number: '',
      subpremise: null,
      postal_code: ''
    };
  }
  
  // If location is a string
  if (typeof pipedriveLocation === 'string') {
    return {
      value: pipedriveLocation,
      country: 'Australia',
      admin_area_level_1: 'Queensland',
      admin_area_level_2: null,
      locality: extractSuburbFromAddress(pipedriveLocation),
      sublocality: null,
      route: '',
      street_number: '',
      subpremise: null,
      postal_code: extractPostcodeFromAddress(pipedriveLocation)
    };
  }
  
  // If location is already an object, return as-is
  return pipedriveLocation;
};

// Helper to extract suburb from address string
const extractSuburbFromAddress = (address) => {
  if (!address) return '';
  
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[1].trim();
  }
  
  return '';
};

// Helper to extract postcode from address string
const extractPostcodeFromAddress = (address) => {
  if (!address) return '';
  
  const match = address.match(/QLD (\d{4})/);
  return match ? match[1] : '';
};

// GET: Fetch and transform activities for app consumption
export const fetchTransformedActivities = async (userId, startDate = null, endDate = null) => {
  try {
    const rawActivities = await fetchUserActivities(userId, startDate, endDate);
    
    console.log('🔄 Transforming activities to app format...');
    
    const transformedActivities = rawActivities
      .map(transformPipedriveActivity)
      .filter(activity => activity !== null);
    
    console.log(`✅ Transformed ${transformedActivities.length} activities`);
    
    return transformedActivities;
  } catch (error) {
    console.error('Error fetching transformed activities:', error);
    throw error;
  }
};

// GET: Search deals by phone number
export const searchDealsByPhoneNumber = async (phoneNumber) => {
  try {
    if (!phoneNumber || phoneNumber.length < 2) {
      throw new Error('Phone number must be at least 2 characters');
    }

    console.log(`📞 Searching deals by phone number: ${phoneNumber}`);
    
    const client = createPipedriveClient(true); // Use v2 API
    
    const params = {
      term: phoneNumber,
      fields: 'custom_fields', // Search in custom fields (where phone numbers are typically stored)
      exact_match: true, // Only exact matches
      limit: 10 // Limit results
    };
    
    const response = await client.get('/deals/search', { params });
    
    const deals = response.data.data || [];
    console.log(`✅ Found ${deals.length} deals matching phone number`);
    
    // For each deal, also fetch person details if person_id exists
    const dealsWithPersons = await Promise.all(
      deals.map(async (deal) => {
        if (deal.person && deal.person.id) {
          try {
            const personResponse = await client.get(`/persons/${deal.person.id}`);
            return {
              ...deal,
              personDetails: personResponse.data.data
            };
          } catch (error) {
            console.warn(`Could not fetch person details for deal ${deal.id}:`, error.message);
            return deal;
          }
        }
        return deal;
      })
    );
    
    return dealsWithPersons;
  } catch (error) {
    handleApiError(error, `search deals by phone ${phoneNumber}`);
  }
};

// GET: Search persons by phone number (alternative approach)
export const searchPersonsByPhoneNumber = async (phoneNumber) => {
  try {
    if (!phoneNumber || phoneNumber.length < 2) {
      throw new Error('Phone number must be at least 2 characters');
    }

    console.log(`📞 Searching persons by phone number: ${phoneNumber}`);
    
    const client = createPipedriveClient(true); // Use v2 API
    
    const params = {
      term: phoneNumber,
      fields: 'phone', // Search specifically in phone fields
      exact_match: true,
      limit: 10
    };
    
    const response = await client.get('/persons/search', { params });
    
    const persons = response.data.data || [];
    console.log(`✅ Found ${persons.length} persons matching phone number`);
    
    return persons;
  } catch (error) {
    handleApiError(error, `search persons by phone ${phoneNumber}`);
  }
};

// GET: Search deals by email
export const searchDealsByEmail = async (email) => {
  try {
    if (!email || email.length < 3) {
      throw new Error('Email must be at least 3 characters');
    }

    console.log(`📧 Searching deals by email: ${email}`);
    
    const client = createPipedriveClient(true); // Use v2 API
    
    const params = {
      term: email,
      fields: 'custom_fields,notes', // Search in custom fields and notes where emails might be stored
      exact_match: true,
      limit: 10
    };
    
    const response = await client.get('/deals/search', { params });
    
    const deals = response.data.data || [];
    console.log(`✅ Found ${deals.length} deals matching email`);
    
    return deals;
  } catch (error) {
    handleApiError(error, `search deals by email ${email}`);
  }
};

// GET: Search persons by email
export const searchPersonsByEmail = async (email) => {
  try {
    if (!email || email.length < 3) {
      throw new Error('Email must be at least 3 characters');
    }

    console.log(`📧 Searching persons by email: ${email}`);
    
    const client = createPipedriveClient(true); // Use v2 API
    
    const params = {
      term: email,
      fields: 'email', // Search specifically in email fields
      exact_match: true,
      limit: 10
    };
    
    const response = await client.get('/persons/search', { params });
    
    const persons = response.data.data || [];
    console.log(`✅ Found ${persons.length} persons matching email`);
    
    return persons;
  } catch (error) {
    handleApiError(error, `search persons by email ${email}`);
  }
};

// GET: Get person and related deals by email
export const getPersonAndDealsByEmail = async (email) => {
  try {
    console.log(`🔍 Getting person and deals for email: ${email}`);
    
    // First try to find persons by email
    const persons = await searchPersonsByEmail(email);
    
    if (persons.length === 0) {
      console.log('📧 No persons found, trying deals search...');
      const deals = await searchDealsByEmail(email);
      return { persons: [], deals };
    }
    
    // If we found persons, get their related deals
    const person = persons[0]; // Take the first match
    const client = createPipedriveClient();
    
    console.log(`👤 Found person: ${person.name}, fetching related deals...`);
    
    const dealsResponse = await client.get('/deals', {
      params: {
        person_id: person.id,
        status: 'open',
        limit: 50
      }
    });
    
    const relatedDeals = dealsResponse.data.data || [];
    console.log(`💼 Found ${relatedDeals.length} related deals`);
    
    return {
      persons: [person],
      deals: relatedDeals,
      mainPerson: person
    };
  } catch (error) {
    console.error('Error getting person and deals by email:', error.message);
    return { persons: [], deals: [], error: error.message };
  }
};

// GET: Get person and related deals by phone number
export const getPersonAndDealsByPhoneNumber = async (phoneNumber) => {
  try {
    console.log(`🔍 Getting person and deals for phone: ${phoneNumber}`);
    
    // First try to find persons by phone number
    const persons = await searchPersonsByPhoneNumber(phoneNumber);
    
    if (persons.length === 0) {
      console.log('📞 No persons found, trying deals search...');
      const deals = await searchDealsByPhoneNumber(phoneNumber);
      return { persons: [], deals };
    }
    
    // If we found persons, get their related deals
    const person = persons[0]; // Take the first match
    const client = createPipedriveClient();
    
    console.log(`👤 Found person: ${person.name}, fetching related deals...`);
    
    const dealsResponse = await client.get('/deals', {
      params: {
        person_id: person.id,
        status: 'open', // Focus on open deals
        limit: 50
      }
    });
    
    const relatedDeals = dealsResponse.data.data || [];
    console.log(`💼 Found ${relatedDeals.length} related deals`);
    
    return {
      persons: [person],
      deals: relatedDeals,
      mainPerson: person
    };
  } catch (error) {
    console.error('Error getting person and deals by phone:', error.message);
    return { persons: [], deals: [], error: error.message };
  }
};

// GET: Health check that verifies API key and permissions
export const healthCheck = async () => {
  try {
    console.log('🔍 Starting Pipedrive API health check...');
    
    // Test basic connection
    const connectionTest = await testPipedriveConnection();
    
    // Test fetching users (requires appropriate permissions)
    const users = await fetchPipedriveUsers();
    
    // Test fetching activities (with minimal data)
    const today = new Date();
    const testActivities = await fetchActivitiesByDateRange(today, today);
    
    console.log('✅ Pipedrive API health check passed');
    
    return {
      success: true,
      connection: connectionTest,
      usersAccessible: users.length > 0,
      activitiesAccessible: Array.isArray(testActivities),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Pipedrive API health check failed:', error.message);
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};