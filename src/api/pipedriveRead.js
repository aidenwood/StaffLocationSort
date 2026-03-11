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

// Helper function for flexible inspector name matching
const checkInspectorNameMatch = (subject, inspectorName, inspectorAliases = []) => {
  if (!subject || !inspectorName) return false;
  
  const normalizedSubject = subject.toLowerCase();
  const normalizedInspectorName = inspectorName.toLowerCase();
  
  // Extract the name part after "Property Inspection - "
  const propertyInspectionPrefix = 'property inspection - ';
  const prefixIndex = normalizedSubject.indexOf(propertyInspectionPrefix);
  
  if (prefixIndex === -1) return false;
  
  const nameInSubject = normalizedSubject.substring(prefixIndex + propertyInspectionPrefix.length).trim();
  
  // Helper function to check one name against the subject
  const checkNameMatch = (name) => {
    const normalizedName = name.toLowerCase();
    
    // 1. Exact match
    if (nameInSubject === normalizedName) return true;
    
    // 2. Full name contains the subject name (e.g., "Ben F" matches "Ben Frohloff")  
    if (normalizedName.includes(nameInSubject)) return true;
    
    // 3. Subject name contains the inspector name (e.g., "Benjamin Wharton" matches "Ben W")
    if (nameInSubject.includes(normalizedName)) return true;
    
    // 4. Check for first name + last initial match (Ben F -> Ben Frohloff)
    const nameParts = normalizedName.split(' ');
    const subjectParts = nameInSubject.split(' ');
    
    if (nameParts.length >= 2 && subjectParts.length >= 2) {
      const firstNameMatch = nameParts[0] === subjectParts[0];
      const lastInitialMatch = nameParts[1].charAt(0) === subjectParts[1].charAt(0);
      if (firstNameMatch && lastInitialMatch) return true;
    }
    
    // 5. Check for first name + partial last name (Ben W -> Benjamin Wharton)
    if (nameParts.length >= 2 && subjectParts.length >= 2) {
      const firstNameSimilar = nameParts[0].startsWith(subjectParts[0]) || subjectParts[0].startsWith(nameParts[0]);
      const lastNameInitial = nameParts[1].charAt(0) === subjectParts[1].charAt(0);
      if (firstNameSimilar && lastNameInitial) return true;
    }
    
    return false;
  };
  
  // Check main name
  if (checkNameMatch(inspectorName)) {
    console.log(`✅ Name match found: "${nameInSubject}" matches main name "${normalizedInspectorName}"`);
    return true;
  }
  
  // Check aliases
  for (const alias of inspectorAliases) {
    if (checkNameMatch(alias)) {
      console.log(`✅ Name match found: "${nameInSubject}" matches alias "${alias.toLowerCase()}"`);
      return true;
    }
  }
  
  console.log(`🔍 Name match attempt: "${nameInSubject}" vs "${normalizedInspectorName}" + ${inspectorAliases.length} aliases - No match`);
  return false;
};

// Base Pipedrive API configuration
const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';
const PIPEDRIVE_V2_BASE_URL = 'https://api.pipedrive.com/api/v2';

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

// Fetch activities using server-side filtering with filter_id (V5 approach)
export const fetchActivitiesWithFilter = async (filterId, startDate = null, endDate = null) => {
  try {
    const client = createPipedriveClient();
    
    console.log('🔍 V5 API: Fetching activities with server-side filter...');
    console.log('   filterId:', filterId);
    console.log('   startDate:', startDate);
    console.log('   endDate:', endDate);

    // Build query parameters
    const params = {
      filter_id: filterId, // This is the key - server-side filtering!
      limit: 500, // Higher limit since we're using server-side filtering
      start: 0
    };

    // Add date filters if provided
    if (startDate) {
      params.start_date = startDate;
    }
    if (endDate) {
      params.end_date = endDate;
    }

    console.log('📞 V5 API: Making filtered request to /activities with params:', params);

    const response = await client.get('/activities', { params });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch filtered activities');
    }

    const activities = response.data.data || [];
    
    console.log(`✅ V5 API: Server-side filter returned ${activities.length} activities`);
    console.log('   📊 Activity breakdown:');
    
    // Log activity types for debugging
    const typeBreakdown = {};
    activities.forEach(activity => {
      const subject = activity.subject || 'No subject';
      const type = activity.type || 'unknown';
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = [];
      }
      typeBreakdown[type].push(subject.substring(0, 50));
    });
    
    Object.keys(typeBreakdown).forEach(type => {
      console.log(`      ${type}: ${typeBreakdown[type].length} activities`);
      if (typeBreakdown[type].length <= 3) {
        typeBreakdown[type].forEach((subject, i) => {
          console.log(`         ${i+1}. "${subject}${subject.length >= 50 ? '...' : ''}"`);
        });
      }
    });

    return activities;

  } catch (error) {
    handleApiError(error, 'fetchActivitiesWithFilter');
    throw error;
  }
};

// Fetch activities using API v2 with filter_id (V2 supports filter natively)
// Uses cursor pagination; V2 returns owner_id (not user_id)
// Capped at 1 page (500 activities) for fast load; filters by startDate/endDate client-side
export const fetchActivitiesWithFilterV2 = async (filterId, startDate = null, endDate = null) => {
  try {
    const client = createPipedriveClient(true); // V2 client
    const maxPages = 5; // Increased to get more activities

    console.log('🔍 V2 API: Fetching UPCOMING activities from filter (target: 188 activities)...');
    console.log('   filterId:', filterId);
    console.log('   startDate:', startDate);
    console.log('   endDate:', endDate);

    const allActivities = [];
    let cursor = null;
    let pageCount = 0;

    // Use V2 API's updated_since parameter to filter by update_time (avoids 500 limit)
    // Remove updated_since for now to get all activities, then filter client-side
    
    console.log('📅 V2 API: Getting all activities (no date filter) then filtering client-side');

    do {
      const params = {
        filter_id: filterId,
        limit: 500, // Max limit to get more per page
        sort_by: 'due_date',
        sort_direction: 'desc' // ✅ FIX: Get newest first instead of 2020 activities
      };

      if (cursor) params.cursor = cursor;

      console.log('📞 V2 API: GET /activities', cursor ? `(page ${pageCount + 1})` : '(first page)', params);

      const response = await client.get('/activities', { params });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch filtered activities');
      }

      const activities = response.data.data || [];
      allActivities.push(...activities);
      pageCount++;

      cursor = response.data.additional_data?.next_cursor || null;

      console.log(`   ✅ Page ${pageCount}: ${activities.length} activities (total: ${allActivities.length})`);
      
      // Stop if we've gotten a reasonable number
      if (allActivities.length >= 200 || !cursor) {
        break;
      }
      
    } while (cursor && pageCount < maxPages);

    console.log(`🎯 FINAL RESULT: ${allActivities.length} total activities from filter ${filterId}`);

    // Filter by due_date range client-side (V2 updated_since filters by update_time, not due_date)
    let filtered = allActivities;
    if (startDate || endDate) {
      const start = startDate ? format(startOfDay(new Date(startDate)), 'yyyy-MM-dd') : null;
      const end = endDate ? format(endOfDay(new Date(endDate)), 'yyyy-MM-dd') : null;
      filtered = allActivities.filter(a => {
        const d = a.due_date || '';
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
      console.log(`✅ V2 API: ${filtered.length} activities in due_date range (from ${allActivities.length} fetched)`);
    } else {
      // Filter to only show upcoming activities (due_date >= today)
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      filtered = allActivities.filter(a => {
        const dueDate = a.due_date || '';
        return dueDate >= todayStr; // Only upcoming activities
      });
      console.log(`✅ V2 API: ${filtered.length} upcoming activities (from ${allActivities.length} total)`);
    }

    if (filtered.length > 0) {
      const typeBreakdown = {};
      filtered.slice(0, 50).forEach(activity => {
        const type = activity.type || 'unknown';
        if (!typeBreakdown[type]) typeBreakdown[type] = 0;
        typeBreakdown[type]++;
      });
      console.log('   📊 Activity breakdown:', typeBreakdown);
      
      // 🔍 DEBUG: Log sample activity to find address field
      const sampleActivity = filtered[0];
      console.log('🏠 ADDRESS DEBUG - Sample activity fields:');
      console.log('   location:', sampleActivity.location);
      console.log('   address:', sampleActivity.address);
      console.log('   location_address:', sampleActivity.location_address);
      console.log('   formatted_address:', sampleActivity.formatted_address);
      
      // Check for custom fields (40-char hashes that might contain address)
      const customFields = {};
      Object.keys(sampleActivity).forEach(key => {
        if (key.length === 40) {
          customFields[key] = sampleActivity[key];
        }
      });
      if (Object.keys(customFields).length > 0) {
        console.log('   🔧 Custom fields (potential address):', customFields);
      }
      
      // List all fields for investigation
      console.log('   📝 All available fields:', Object.keys(sampleActivity).join(', '));
    }

    return filtered;
  } catch (error) {
    handleApiError(error, 'fetchActivitiesWithFilterV2');
    throw error;
  }
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

// GET: Fetch person address for activity using the specific hash key for Person address
export const fetchPersonAddressForActivity = async (activity) => {
  try {
    const client = createPipedriveClient();
    
    // Hash key for Person address in Pipedrive
    const PERSON_ADDRESS_HASH = '6fa72064159f058167dcdab4ae78eb140eae6f05';
    
    // First try to get person directly from activity
    let personId = activity.person_id;
    
    // If no person_id but has deal_id, get person from deal
    if (!personId && activity.deal_id) {
      const dealResponse = await client.get(`/deals/${activity.deal_id}`);
      if (dealResponse.data.success && dealResponse.data.data.person_id) {
        personId = dealResponse.data.data.person_id;
      }
    }
    
    // If we have a person_id, fetch their address
    if (personId) {
      const personResponse = await client.get(`/persons/${personId}`);
      
      if (personResponse.data.success && personResponse.data.data) {
        const person = personResponse.data.data;
        
        // First check the specific hash key for Person address
        if (person[PERSON_ADDRESS_HASH] && typeof person[PERSON_ADDRESS_HASH] === 'string') {
          const address = String(person[PERSON_ADDRESS_HASH]).trim();
          if (address && !address.includes('Lead Gen') && !address.includes('Advertising') && !address.includes('Region:')) {
            console.log(`   ✅ Found person address in hash field '${PERSON_ADDRESS_HASH}':`, address);
            return address;
          }
        }
        
        // Fallback: Look for Address field - prioritize proper address fields
        const priorityAddressFields = [
          'postal_address_formatted_address',  // Most likely the full address
          'formatted_address',
          'address', 
          'Address',
          'full_address',
          'street_address'
        ];
        
        let address = null;
        
        // Try priority address fields
        for (const fieldName of priorityAddressFields) {
          if (person[fieldName] && typeof person[fieldName] === 'string' && person[fieldName].trim()) {
            const value = person[fieldName].trim();
            // Skip marketing text
            if (!value.includes('Lead Gen') && !value.includes('Advertising') && !value.includes('Region:')) {
              address = value;
              console.log(`   ✅ Found address in field '${fieldName}':`, address);
              break;
            }
          }
        }
        
        // If no standard field, check custom fields for formatted_address
        if (!address) {
          Object.keys(person).forEach(key => {
            if (key.includes('formatted_address') && person[key] && typeof person[key] === 'string') {
              const value = String(person[key]).trim();
              if (value && !value.includes('Lead Gen') && !value.includes('Advertising') && !value.includes('Region:')) {
                address = value;
                console.log(`   ✅ Found address in custom formatted field '${key}':`, address);
              }
            }
          });
        }
        
        // Last resort: look for proper street addresses in custom fields
        if (!address) {
          Object.keys(person).forEach(key => {
            if (key.length === 40 && key !== PERSON_ADDRESS_HASH && person[key] && typeof person[key] === 'string') {
              const value = String(person[key]).trim();
              // More specific check for actual street addresses (QLD and NSW)
              if (value && 
                  // Must contain street type
                  (value.includes('Street') || value.includes('St,') || value.includes('St ') || 
                   value.includes('Road') || value.includes('Avenue') || value.includes('Drive') || 
                   value.includes('Crescent') || value.includes('Place') || value.includes('Lane')) &&
                  // Must contain Australian state (both QLD and NSW)
                  (value.includes('QLD') || value.includes('NSW') || value.includes('Australia')) &&
                  // Must NOT contain marketing text
                  !value.includes('Lead Gen') && !value.includes('Advertising') && 
                  !value.includes('Region:') && !value.includes('Landing Page')) {
                address = value;
                console.log(`   ✅ Found street address in custom field '${key}':`, address);
              }
            }
          });
        }
        
        // If address is an object, get the value
        if (typeof address === 'object' && address) {
          return address.value || address.formatted_address || address;
        }
        
        return address || null;
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Could not fetch address for activity ${activity.id}:`, error.message);
    return null;
  }
};

// GET: Enrich activities with person addresses and geocoded coordinates
export const enrichActivitiesWithAddresses = async (activities) => {
  try {
    console.log(`🏠 Enriching ${activities.length} activities with person addresses and coordinates...`);
    
    const enrichedActivities = await Promise.all(
      activities.map(async (activity) => {
        const address = await fetchPersonAddressForActivity(activity);
        
        // If we found an address, geocode it
        if (address) {
          try {
            const { geocodeAddress } = await import('../services/geocoding.js');
            const coordinates = await geocodeAddress(address);
            
            if (coordinates) {
              console.log(`   📍 Geocoded activity "${activity.subject}": ${coordinates.lat}, ${coordinates.lng}`);
              return {
                ...activity,
                personAddress: address,
                coordinates, // Add coordinates for distance calculations
                lat: coordinates.lat, // Also add individual lat/lng for compatibility
                lng: coordinates.lng,
                addressSource: 'person_address_geocoded'
              };
            } else {
              console.warn(`   ⚠️ Failed to geocode address: "${address}"`);
            }
          } catch (geocodeError) {
            console.warn(`   ⚠️ Geocoding error for "${address}":`, geocodeError.message);
          }
        }
        
        return {
          ...activity,
          personAddress: address,
          addressSource: address ? 'person_address' : null
        };
      })
    );
    
    const withAddresses = enrichedActivities.filter(a => a.personAddress).length;
    const withCoordinates = enrichedActivities.filter(a => a.coordinates).length;
    
    console.log(`✅ Address enrichment results:`);
    console.log(`   Person addresses: ${withAddresses}/${activities.length}`);
    console.log(`   Geocoded coordinates: ${withCoordinates}/${activities.length}`);
    
    return enrichedActivities;
  } catch (error) {
    console.error('Error enriching activities with addresses:', error);
    return activities; // Return original activities if enrichment fails
  }
};

// Transform Pipedrive activity to app format
// Handles both V1 (user_id) and V2 (owner_id) activity shapes
export const transformPipedriveActivity = (pipedriveActivity) => {
  if (!pipedriveActivity) return null;

  const pipedriveUserId = pipedriveActivity.user_id ?? pipedriveActivity.owner_id;
  const user = getPipedriveUserById(pipedriveUserId);
  const isTest = isTestUser(pipedriveUserId);

  return {
    // Keep original Pipedrive structure
    id: pipedriveActivity.id,
    company_id: pipedriveActivity.company_id,
    owner_id: user?.appId ?? pipedriveUserId,
    creator_user_id: pipedriveUserId,
    is_deleted: pipedriveActivity.is_deleted ?? (pipedriveActivity.active_flag === false),
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
    
    // Enriched address (from enrichActivitiesWithAddresses)
    personAddress: pipedriveActivity.personAddress || null,

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

// GET: Create a filter for a specific inspector's Property Inspection activities
export const createInspectorFilter = async (inspectorName) => {
  try {
    const client = createPipedriveClient();
    
    console.log(`🔍 Creating filter for ${inspectorName} Property Inspection activities...`);
    
    const filterData = {
      name: `Property Inspections - ${inspectorName}`,
      type: 'activity',
      conditions: {
        glue: 'and',
        conditions: [
          {
            glue: 'and',
            conditions: [
              {
                object: 'activity',
                field_id: 'subject', // Subject field for activities
                operator: 'LIKE',
                value: [`Property Inspection - ${inspectorName}%`],
                extra_value: null
              }
            ]
          }
        ]
      }
    };
    
    const response = await client.post('/filters', filterData);
    
    console.log(`✅ Created filter for ${inspectorName}:`, response.data.data.id);
    
    return response.data.data;
  } catch (error) {
    handleApiError(error, `create filter for ${inspectorName}`);
  }
};


// GET: Search activities by subject text using ItemSearch API
export const searchActivitiesBySubject = async (searchTerm, startDate = null, endDate = null) => {
  try {
    const client = createPipedriveClient();
    
    if (!searchTerm || searchTerm.length < 2) {
      throw new Error('Search term must be at least 2 characters');
    }
    
    console.log(`🔍 Searching activities by subject: "${searchTerm}"`);
    
    const params = {
      item_types: 'activity',
      term: searchTerm,
      limit: 500,
      exact_match: false
    };
    
    // Note: ItemSearch doesn't support date filtering directly,
    // we'll need to filter results after fetching
    
    const response = await client.get('/itemSearch', { params });
    
    let activities = response.data.data?.items || [];
    console.log(`📋 ItemSearch returned ${activities.length} activities for "${searchTerm}"`);
    
    // Filter by date if provided
    if (startDate || endDate) {
      const startDateTime = startDate ? startOfDay(new Date(startDate)) : null;
      const endDateTime = endDate ? endOfDay(new Date(endDate)) : null;
      
      activities = activities.filter(activity => {
        if (!activity.item?.due_date) return false;
        
        const activityDate = new Date(activity.item.due_date);
        
        if (startDateTime && activityDate < startDateTime) return false;
        if (endDateTime && activityDate > endDateTime) return false;
        
        return true;
      });
      
      console.log(`📅 After date filtering: ${activities.length} activities`);
    }
    
    // Transform ItemSearch results to standard activity format
    const transformedActivities = activities.map(item => item.item).filter(Boolean);
    
    return transformedActivities;
  } catch (error) {
    handleApiError(error, `search activities by subject "${searchTerm}"`);
  }
};

// GET: Fetch activities for inspector using V2 approach (Client-side filtering of all activities)
export const fetchActivitiesForInspectorV2 = async (userId, inspectorName, startDate = null, endDate = null) => {
  try {
    console.log(`🧪 V2 (Enhanced): Fetching activities for ${inspectorName} (user ${userId})`);
    
    // V2: Get all activities for the user and filter client-side with pagination handling
    const rawActivities = await fetchUserActivities(userId, startDate, endDate);
    
    // Filter activities to only include "Property Inspection - [InspectorName]" 
    const filteredActivities = rawActivities.filter(activity => {
      const subject = activity.subject || '';
      return subject.includes(`Property Inspection - ${inspectorName}`);
    });
    
    console.log(`📋 V2: Filtered ${filteredActivities.length} activities from ${rawActivities.length} total for ${inspectorName}`);
    
    // Transform activities to app format
    const transformedActivities = filteredActivities
      .map(transformPipedriveActivity)
      .filter(activity => activity !== null);
    
    console.log(`✅ V2 (Enhanced): Transformed ${transformedActivities.length} activities for ${inspectorName}`);
    
    return transformedActivities;
  } catch (error) {
    console.error('❌ V2 (Enhanced) error:', error);
    throw error;
  }
};

// GET: Fetch activities for inspector using V3 approach (ItemSearch API)
export const fetchActivitiesForInspectorV3 = async (userId, inspectorName, startDate = null, endDate = null) => {
  try {
    console.log(`🧪 V3 (ItemSearch): Fetching activities for ${inspectorName} (user ${userId})`);
    
    // Search for activities with "Property Inspection - [InspectorName]" pattern
    const searchTerm = `Property Inspection - ${inspectorName}`;
    
    const rawActivities = await searchActivitiesBySubject(searchTerm, startDate, endDate);
    
    // Transform activities to app format
    const transformedActivities = rawActivities
      .map(transformPipedriveActivity)
      .filter(activity => activity !== null);
    
    console.log(`✅ V3 (ItemSearch): Transformed ${transformedActivities.length} activities for ${inspectorName}`);
    
    return transformedActivities;
  } catch (error) {
    console.error('❌ V3 (ItemSearch) error:', error);
    throw error;
  }
};

// GET: Fetch activities using server-side filtering for V5 (Optimal Performance)
export const fetchActivitiesForInspectorV5 = async (userId, inspectorName, filterId, startDate = null, endDate = null) => {
  try {
    console.log(`🧪 V5 (Server Filter): Fetching activities for ${inspectorName} using filter ${filterId}`);
    
    // Get inspector aliases from configuration  
    const inspectorConfig = getPipedriveUserById(userId);
    const inspectorAliases = inspectorConfig?.aliases || [];
    
    console.log(`🔍 V5: Inspector "${inspectorName}" has aliases:`, inspectorAliases);
    
    let rawActivities;
    
    if (!filterId) {
      // No server filter available for this inspector, use client-side filtering
      console.log(`📊 V5: No server filter available, using client-side filtering for ${inspectorName}...`);
      
      // Fetch all activities and filter client-side
      const allActivities = await fetchActivitiesByDateRange(startDate, endDate);
      rawActivities = allActivities.filter(activity => {
        const subject = activity.subject || '';
        return subject.toLowerCase().includes('property inspection');
      });
      
      console.log(`✅ V5: Client-side filter successful - ${rawActivities.length} Property Inspection activities from ${allActivities.length} total`);
    } else {
      try {
        // Try server-side filtering first
        console.log(`📊 V5: Attempting server-side filter ${filterId}...`);
        rawActivities = await fetchActivitiesWithFilter(filterId, startDate, endDate);
        console.log(`✅ V5: Server filter successful - ${rawActivities.length} activities`);
      } catch (filterError) {
        // If filter fails, fallback to basic fetch + client filtering
        console.log(`⚠️ V5: Server filter failed, falling back to client-side filtering`);
        console.log(`   Filter error: ${filterError.message}`);
        
        // Fetch all activities and filter client-side
        const allActivities = await fetchActivitiesByDateRange(startDate, endDate);
        rawActivities = allActivities.filter(activity => {
          const subject = activity.subject || '';
          return subject.toLowerCase().includes('property inspection');
        });
        
        console.log(`✅ V5: Client-side filter successful - ${rawActivities.length} Property Inspection activities from ${allActivities.length} total`);
      }
    }
    
    // Enhanced filtering for this specific inspector with flexible name matching
    const inspectorActivities = rawActivities.filter(activity => {
      const subject = activity.subject || '';
      
      // Check if assigned to this user ID
      const userMatch = activity.user_id === userId;
      
      // Enhanced name matching for subject line (with aliases)
      const inspectorMatch = checkInspectorNameMatch(subject, inspectorName, inspectorAliases);
      
      // Accept if either subject matches inspector name OR assigned to user
      return inspectorMatch || userMatch;
    });
    
    console.log(`🔍 V5 Filter Results:`);
    console.log(`   Server filter returned: ${rawActivities.length} total activities`);
    console.log(`   Inspector "${inspectorName}" activities: ${inspectorActivities.length}`);
    
    // Transform activities to app format
    const transformedActivities = inspectorActivities
      .map(transformPipedriveActivity)
      .filter(activity => activity !== null);
    
    console.log(`✅ V5 (Server Filter): Transformed ${transformedActivities.length} activities for ${inspectorName}`);
    
    // Add debug info to activities for troubleshooting
    transformedActivities.forEach((activity, index) => {
      if (index < 3) { // Log first 3 for debugging
        console.log(`   🔸 Activity ${index + 1}: "${activity.subject}" at ${activity.datetime}`);
      }
    });
    
    return transformedActivities;
  } catch (error) {
    console.error('❌ V5 (Server Filter) error:', error);
    throw error;
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