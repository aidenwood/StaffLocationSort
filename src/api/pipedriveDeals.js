// Pipedrive Deals READ-ONLY API Service  
// ⚠️ THIS FILE CONTAINS ONLY GET REQUESTS - NO WRITE OPERATIONS
// Safe for production use - only reads deal data from Pipedrive for recommendations

import axios from 'axios';
import { geocodeAddress } from '../services/geocoding.js';
import { parseDealAddress } from '../utils/dealAddressParser.js';
import { calculateDistance } from '../utils/regionValidation.js';

// Base Pipedrive API configuration
const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';

// Retry utility with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry for non-retriable errors
      if (error.response?.status && ![429, 502, 503, 504].includes(error.response.status)) {
        throw error;
      }
      
      // Don't wait on the last attempt
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`⏳ Rate limited (${error.response?.status || 'Network Error'}), retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Create axios instance for Pipedrive API
const createPipedriveClient = () => {
  const apiKey = import.meta.env.VITE_PIPEDRIVE_API_KEY;
  
  if (!apiKey || apiKey === 'your_pipedrive_api_key_here') {
    throw new Error('Pipedrive API key not configured');
  }

  const client = axios.create({
    baseURL: PIPEDRIVE_BASE_URL,
    timeout: 30000,
    params: {
      api_token: apiKey
    },
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // Add retry interceptor for rate limits
  const originalGet = client.get;
  client.get = async (...args) => {
    return retryWithBackoff(() => originalGet.apply(client, args));
  };

  return client;
};

// Regional deal filters mapping
export const REGIONAL_DEAL_FILTERS = {
  R1: {
    filterId: 222491, // R1 region filter - Brisbane, Ipswich, Logan, Gold Coast
    name: "R1 Ready to Book",
    regions: ["Brisbane", "Ipswich", "Logan", "Gold Coast", "Logan Central", "Loganholme", "Eagleby", "Beenleigh", "Southport", "Surfers Paradise", "Broadbeach"]
  },
  // Legacy individual region filters (to be replaced by R1)
  LOGAN: {
    filterId: 222491, // Use R1 filter for now
    name: "Logan Ready to Book",
    regions: ["Logan", "Logan Central", "Loganholme", "Eagleby", "Beenleigh"]
  },
  BRISBANE: {
    filterId: 222491, // Use R1 filter for now
    name: "Brisbane Ready to Book", 
    regions: ["Brisbane", "Brisbane City", "South Brisbane", "West End"]
  },
  GOLD_COAST: {
    filterId: 222491, // Use R1 filter for now
    name: "Gold Coast Ready to Book",
    regions: ["Gold Coast", "Southport", "Surfers Paradise", "Broadbeach"]
  },
  IPSWICH: {
    filterId: 222491, // Use R1 filter for now
    name: "Ipswich Ready to Book",
    regions: ["Ipswich", "Ipswich Central", "Springfield"]
  },
  DEFAULT: {
    filterId: 222491, // Use R1 filter as default
    name: "R1 Ready to Book",
    regions: []
  }
};

// Cache for deals to minimize API calls
const dealsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Transform Pipedrive deal data to standardized format
 * @param {Object} deal - Raw deal object from Pipedrive
 * @returns {Object} Transformed deal data
 */
export const transformPipedriveDeal = (deal) => {
  // Debug: Log address extraction for debugging (reduced frequency)
  if (Math.random() < 0.02) { // Log ~2% of deals
    const customAddress = deal['fc56b2671002827523bc3711b6a790f5ff00963f'];
    console.log('📋 Address debug for deal', deal.id, ':', {
      title: deal.title,
      customDealAddress: customAddress || 'Not found',
      personAddress: deal.person?.address || 'Not found',
      hasCustomField: !!customAddress
    });
  }

  // Extract address with priority order:
  // 1. Custom 'Deal Address' field
  // 2. Person address
  // 3. Organization address  
  // 4. Deal address field
  // 5. Parse from title as fallback
  
  let address = null;
  let addressSource = null;
  
  // Check for custom 'Deal Address' field first (using hash key)
  if (deal['fc56b2671002827523bc3711b6a790f5ff00963f'] && typeof deal['fc56b2671002827523bc3711b6a790f5ff00963f'] === 'string' && deal['fc56b2671002827523bc3711b6a790f5ff00963f'].trim()) {
    address = deal['fc56b2671002827523bc3711b6a790f5ff00963f'].trim();
    addressSource = 'deal_address_field';
  } else if (deal['Deal Address'] && typeof deal['Deal Address'] === 'string' && deal['Deal Address'].trim()) {
    address = deal['Deal Address'].trim();
    addressSource = 'deal_address_field';
  } else if (deal.deal_address && typeof deal.deal_address === 'string' && deal.deal_address.trim()) {
    address = deal.deal_address.trim();
    addressSource = 'deal_address_field';
  } else if (deal.person?.address) {
    address = deal.person.address;
    addressSource = 'person_address';
  } else if (deal.org?.address) {
    address = deal.org.address;
    addressSource = 'org_address';
  } else if (deal.address) {
    address = deal.address;
    addressSource = 'deal_address';
  }

  // Try to parse address from deal title if no address found
  let parsedFromTitle = null;
  if (!address && deal.title) {
    parsedFromTitle = parseDealAddress(deal.title);
    if (parsedFromTitle && parsedFromTitle.address) {
      address = parsedFromTitle.address;
      addressSource = 'parsed_from_title';
    }
  }

  // Extract phone number
  let phone = null;
  if (deal.person?.phone && deal.person.phone.length > 0) {
    phone = deal.person.phone[0].value;
  }

  // Calculate priority based on value and stage
  let priority = 'medium';
  const value = deal.value || 0;
  if (value > 800) priority = 'high';
  else if (value < 300) priority = 'low';

  return {
    id: deal.id,
    title: deal.title || `Property Inspection - ${deal.person?.name || 'Unknown'}`,
    value: value,
    priority: priority,
    stage: deal.stage_id,
    person: {
      id: deal.person?.id,
      name: deal.person?.name || (parsedFromTitle?.name) || 'Unknown Customer',
      phone: phone,
      email: deal.person?.email?.[0]?.value || null
    },
    organization: {
      id: deal.org?.id,
      name: deal.org?.name || null
    },
    address: address,
    addressSource: addressSource, // Track where the address came from
    coordinates: null, // Will be populated by geocoding
    parsedFromTitle: parsedFromTitle, // Keep track of parsing results
    createdAt: deal.add_time,
    updatedAt: deal.update_time,
    expectedCloseDate: deal.expected_close_date,
    notes: deal.notes_count > 0 ? 'Has notes' : null,
    source: 'pipedrive'
  };
};

/**
 * Fetch deals using a specific Pipedrive filter (READ-ONLY)
 * @param {number} filterId - Pipedrive filter ID
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of deals
 */
export const fetchDealsWithFilter = async (filterId, options = {}) => {
  const { 
    limit = 100,
    includeArchived = false,
    fetchAll = false // New option to fetch all deals with pagination
  } = options;

  try {
    console.log(`📋 Fetching deals with filter ${filterId}${fetchAll ? ' (all pages)' : ''}...`);
    
    const client = createPipedriveClient();
    let allDeals = [];
    let start = 0;
    let hasMore = true;
    
    while (hasMore) {
      // READ-ONLY: Only GET request to fetch deals
      const response = await client.get('/deals', {
        params: {
          filter_id: filterId,
          limit: Math.min(limit, 100), // Pipedrive max is 100 per request
          start: start,
          status: includeArchived ? 'all_not_deleted' : 'open',
          sort: 'value DESC' // Sort by value, highest first
        }
      });

      if (!response.data.success) {
        throw new Error(`Pipedrive API error: ${response.data.error || 'Unknown error'}`);
      }

      const deals = response.data.data || [];
      allDeals.push(...deals);
      
      const pagination = response.data.additional_data?.pagination;
      console.log(`✅ Fetched ${deals.length} deals (${allDeals.length} total) from filter ${filterId}`);
      
      // Check if we should continue fetching
      if (!fetchAll || !pagination || !pagination.more_items_in_collection) {
        hasMore = false;
      } else {
        start = pagination.next_start;
      }
      
      // Safety check to avoid infinite loops
      if (allDeals.length > 500) {
        console.warn('⚠️ Reached safety limit of 500 deals');
        hasMore = false;
      }
    }

    // Transform deals to standardized format
    const transformedDeals = allDeals.map(transformPipedriveDeal);
    
    return {
      deals: transformedDeals,
      pagination: { total: allDeals.length },
      success: true
    };

  } catch (error) {
    console.error(`❌ Error fetching deals with filter ${filterId}:`, error);
    
    return {
      deals: [],
      error: error.message,
      success: false
    };
  }
};

/**
 * Get the appropriate filter for an inspector's region
 * @param {string} region - Inspector's region
 * @returns {Object} Filter configuration
 */
export const getFilterForRegion = (region) => {
  if (!region) return REGIONAL_DEAL_FILTERS.DEFAULT;
  
  const regionKey = region.toUpperCase();
  return REGIONAL_DEAL_FILTERS[regionKey] || REGIONAL_DEAL_FILTERS.DEFAULT;
};

/**
 * Fetch deals for a specific region with caching (READ-ONLY)
 * @param {string} region - Inspector's region (e.g., 'Logan', 'Brisbane')
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of deals for the region
 */
export const getDealsForRegion = async (region, options = {}) => {
  const cacheKey = `deals_${region}_${JSON.stringify(options)}`;
  
  // Check cache first
  const cached = dealsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📋 Using cached deals for region: ${region}`);
    return cached.data;
  }

  try {
    const filter = getFilterForRegion(region);
    console.log(`📋 Fetching deals for region: ${region} using filter ${filter.filterId}`);
    
    const result = await fetchDealsWithFilter(filter.filterId, { 
      ...options, 
      fetchAll: true // Fetch all deals with pagination
    });
    
    if (result.success) {
      // Enrich deals with geocoded addresses
      const enrichedDeals = await enrichDealsWithAddresses(result.deals);
      
      // Cache the enriched result
      dealsCache.set(cacheKey, {
        data: enrichedDeals,
        timestamp: Date.now()
      });
      
      console.log(`✅ Cached ${enrichedDeals.length} enriched deals for region: ${region}`);
      return enrichedDeals;
    }
    
    return result.deals;

  } catch (error) {
    console.error(`❌ Error fetching deals for region ${region}:`, error);
    return [];
  }
};

/**
 * Enrich deals with geocoded addresses (READ-ONLY operation)
 * @param {Array} deals - Array of deal objects
 * @returns {Promise<Array>} Deals with coordinates added
 */
export const enrichDealsWithAddresses = async (deals) => {
  console.log(`📍 Enriching ${deals.length} deals with geocoding...`);
  
  const enriched = await Promise.all(deals.map(async (deal) => {
    if (!deal.address) {
      console.warn(`⚠️ No address for deal: ${deal.title}`);
      return deal;
    }

    try {
      const coordinates = await geocodeAddress(deal.address);
      return {
        ...deal,
        coordinates: coordinates
      };
    } catch (error) {
      console.warn(`⚠️ Geocoding failed for deal ${deal.id}:`, error);
      return deal;
    }
  }));

  const successCount = enriched.filter(deal => deal.coordinates).length;
  console.log(`✅ Geocoded ${successCount}/${deals.length} deals successfully`);
  
  return enriched;
};

/**
 * Clear deals cache (local operation only)
 * @param {string} region - Specific region to clear, or null for all
 */
export const clearDealsCache = (region = null) => {
  if (region) {
    const keys = Array.from(dealsCache.keys()).filter(key => key.includes(`deals_${region}_`));
    keys.forEach(key => dealsCache.delete(key));
    console.log(`🗑️ Cleared deals cache for region: ${region}`);
  } else {
    dealsCache.clear();
    console.log('🗑️ Cleared all deals cache');
  }
};

/**
 * Get deals suitable for appointment recommendations (READ-ONLY)
 * @param {string} region - Inspector's region
 * @param {Date} date - Target date for appointments
 * @returns {Promise<Array>} Filtered and enriched deals ready for recommendations
 */
export const getRecommendationDeals = async (region, date = new Date()) => {
  try {
    console.log(`🎯 Getting recommendation deals for ${region} on ${date.toDateString()}`);
    
    // Fetch deals for region (READ-ONLY) - already enriched with coordinates
    const deals = await getDealsForRegion(region);
    
    // Filter deals suitable for recommendations
    const suitableDeals = deals.filter(deal => {
      // Must have address for routing
      if (!deal.address) return false;
      
      // Must have contact information
      if (!deal.person?.name) return false;
      
      // Exclude deals that are too low value (configurable)
      if (deal.value < 200) return false;
      
      return true;
    });
    
    // Filter out deals that couldn't be geocoded
    const geoDeals = suitableDeals.filter(deal => deal.coordinates);
    
    console.log(`✅ Found ${geoDeals.length} suitable deals for recommendations`);
    return geoDeals;

  } catch (error) {
    console.error('❌ Error getting recommendation deals:', error);
    return [];
  }
};

/**
 * Calculate distance from deal to closest inspection address
 * @param {Object} deal - Deal with coordinates
 * @param {Array} inspectionActivities - Array of inspection activities with coordinates
 * @returns {Object} - { minDistance, closestActivity, allDistances }
 */
export const calculateDealDistances = (deal, inspectionActivities) => {
  if (!deal.coordinates || !Array.isArray(inspectionActivities)) {
    // Skip logging for deals without coordinates - handled in summary
    return { minDistance: null, closestActivity: null, allDistances: [] };
  }

  const distances = [];
  
  for (const activity of inspectionActivities) {
    // Try multiple coordinate sources with enhanced debugging
    let activityCoords = null;
    let coordSource = null;
    
    // Check for coordinates in multiple formats
    if (activity.coordinates && activity.coordinates.lat && activity.coordinates.lng) {
      activityCoords = activity.coordinates;
      coordSource = 'activity.coordinates';
    } else if (activity.personAddress?.coordinates && activity.personAddress.coordinates.lat && activity.personAddress.coordinates.lng) {
      activityCoords = activity.personAddress.coordinates;
      coordSource = 'activity.personAddress.coordinates';
    } else if (activity.lat && activity.lng) {
      activityCoords = { lat: parseFloat(activity.lat), lng: parseFloat(activity.lng) };
      coordSource = 'activity.lat/lng';
    } else if (activity.location_lat && activity.location_lng) {
      activityCoords = { lat: parseFloat(activity.location_lat), lng: parseFloat(activity.location_lng) };
      coordSource = 'activity.location_lat/lng';
    } else if (activity.enrichedCoordinates) {
      activityCoords = activity.enrichedCoordinates;
      coordSource = 'activity.enrichedCoordinates';
    }
    
    if (activityCoords && activityCoords.lat && activityCoords.lng) {
      // Validate coordinates are numbers
      const lat = parseFloat(activityCoords.lat);
      const lng = parseFloat(activityCoords.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Invalid coordinates found:', { activityCoords, coordSource, activityId: activity.id });
        continue;
      }
      
      const distance = calculateDistance(
        deal.coordinates.lat,
        deal.coordinates.lng,
        lat,
        lng
      );
      
      distances.push({
        activity,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        activityAddress: activity.personAddress?.formatted_address || 
                        activity.personAddress?.address ||
                        activity.personAddress ||
                        activity.subject?.replace(/.*?(?=\d)/, '').trim() || 
                        'Unknown address',
        coordSource
      });
      
      // Reduced logging - only log first calculation for verification
      if (distances.length === 0) {
        console.log('📏 First distance calculated:', {
          dealTitle: deal.title,
          activitySubject: activity.subject,
          distance: Math.round(distance * 100) / 100,
          coordSource
        });
      }
    } else {
      console.warn('⚠️ No valid coordinates found for activity:', {
        activityId: activity.id,
        subject: activity.subject,
        hasCoordinates: !!activity.coordinates,
        hasPersonAddress: !!activity.personAddress,
        hasLatLng: !!(activity.lat && activity.lng),
        hasLocationLatLng: !!(activity.location_lat && activity.location_lng),
        debugCoords: {
          coordinates: activity.coordinates,
          personAddress: activity.personAddress,
          lat: activity.lat,
          lng: activity.lng,
          location_lat: activity.location_lat,
          location_lng: activity.location_lng
        }
      });
    }
  }

  if (distances.length === 0) {
    return { minDistance: null, closestActivity: null, allDistances: [] };
  }

  // Sort by distance and get closest
  distances.sort((a, b) => a.distance - b.distance);
  const closest = distances[0];

  return {
    minDistance: closest.distance,
    closestActivity: closest.activity,
    closestAddress: closest.activityAddress,
    allDistances: distances
  };
};

/**
 * Sort deals by distance to inspection addresses
 * @param {Array} deals - Array of deals with coordinates
 * @param {Array} inspectionActivities - Array of inspection activities
 * @returns {Array} - Sorted deals with distance information
 */
export const sortDealsByDistance = (deals, inspectionActivities) => {
  if (!Array.isArray(deals) || !Array.isArray(inspectionActivities)) {
    return deals;
  }

  // Calculate distances for each deal
  const dealsWithDistances = deals.map(deal => {
    const distanceInfo = calculateDealDistances(deal, inspectionActivities);
    return {
      ...deal,
      distanceInfo
    };
  });

  // Sort by distance (deals without coordinates go to end)
  return dealsWithDistances.sort((a, b) => {
    const aDistance = a.distanceInfo.minDistance;
    const bDistance = b.distanceInfo.minDistance;
    
    // Both have distances
    if (aDistance !== null && bDistance !== null) {
      return aDistance - bDistance;
    }
    
    // Only a has distance
    if (aDistance !== null && bDistance === null) {
      return -1;
    }
    
    // Only b has distance
    if (aDistance === null && bDistance !== null) {
      return 1;
    }
    
    // Neither has distance - sort by priority/value
    const aPriority = a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1;
    const bPriority = b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    return (b.value || 0) - (a.value || 0);
  });
};

/**
 * Health check for deals API (READ-ONLY)
 * @returns {Promise<Object>} Health status
 */
export const healthCheckDeals = async () => {
  try {
    const client = createPipedriveClient();
    // READ-ONLY: Simple GET request to test API access
    await client.get('/deals', {
      params: { limit: 1 }
    });
    
    return {
      success: true,
      message: 'Deals API accessible',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      message: `Deals API error: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Find deals within a specified distance of a location
 * @param {Array} deals - Array of deals with coordinates
 * @param {Object} location - { lat, lng }
 * @param {number} threshold - Distance threshold in km
 * @returns {Array} Deals within threshold distance, sorted by distance
 */
export const findDealsNearLocation = (deals, location, threshold = 1) => {
  if (!location || !location.lat || !location.lng) {
    console.warn('⚠️ Invalid location provided to findDealsNearLocation');
    return [];
  }

  console.log(`🔍 Finding deals within ${threshold}km of location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);

  const nearbyDeals = deals
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

  console.log(`📍 Found ${nearbyDeals.length} deals within ${threshold}km`);
  return nearbyDeals;
};

/**
 * Group deals by their proximity to inspection activities
 * @param {Array} deals - Array of deals with coordinates
 * @param {Array} activities - Array of activities with coordinates
 * @param {number} threshold - Distance threshold in km
 * @returns {Object} Deals grouped by which activities they're near
 */
export const groupDealsByProximity = (deals, activities, threshold = 1) => {
  console.log(`🗂️ Grouping ${deals.length} deals by proximity to ${activities.length} activities (${threshold}km threshold)`);

  const grouped = {
    dealsByActivity: new Map(),
    activitiesWithNearbyDeals: [],
    dealsWithNoNearbyActivities: [],
    summary: {
      totalDeals: deals.length,
      totalActivities: activities.length,
      activitiesWithDeals: 0,
      totalNearbyConnections: 0
    }
  };

  // Filter activities with valid coordinates
  const validActivities = activities.filter(activity => 
    activity.coordinates && activity.coordinates.lat && activity.coordinates.lng
  );

  // For each activity, find nearby deals
  validActivities.forEach(activity => {
    const nearbyDeals = findDealsNearLocation(deals, activity.coordinates, threshold);
    
    if (nearbyDeals.length > 0) {
      grouped.dealsByActivity.set(activity.id, {
        activity,
        nearbyDeals,
        count: nearbyDeals.length
      });
      
      grouped.activitiesWithNearbyDeals.push({
        ...activity,
        nearbyDealsCount: nearbyDeals.length,
        closestDeal: nearbyDeals[0]
      });
      
      grouped.summary.activitiesWithDeals++;
      grouped.summary.totalNearbyConnections += nearbyDeals.length;
    }
  });

  // Find deals that aren't near any activities
  const dealsNearActivities = new Set();
  grouped.dealsByActivity.forEach(group => {
    group.nearbyDeals.forEach(deal => dealsNearActivities.add(deal.id));
  });

  grouped.dealsWithNoNearbyActivities = deals.filter(deal => 
    deal.coordinates && !dealsNearActivities.has(deal.id)
  );

  console.log(`✅ Proximity grouping complete:`, {
    activitiesWithDeals: grouped.summary.activitiesWithDeals,
    totalConnections: grouped.summary.totalNearbyConnections,
    isolatedDeals: grouped.dealsWithNoNearbyActivities.length
  });

  return grouped;
};

export default {
  fetchDealsWithFilter,
  getDealsForRegion,
  getRecommendationDeals,
  enrichDealsWithAddresses,
  clearDealsCache,
  healthCheckDeals,
  transformPipedriveDeal,
  getFilterForRegion,
  calculateDealDistances,
  sortDealsByDistance,
  findDealsNearLocation,
  groupDealsByProximity,
  REGIONAL_DEAL_FILTERS
};