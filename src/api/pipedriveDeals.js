// Pipedrive Deals READ-ONLY API Service  
// ⚠️ THIS FILE CONTAINS ONLY GET REQUESTS - NO WRITE OPERATIONS
// Safe for production use - only reads deal data from Pipedrive for recommendations

import axios from 'axios';
import { geocodeAddress } from '../services/geocoding.js';
import { parseDealAddress } from '../utils/dealAddressParser.js';
import { calculateDistance } from '../utils/regionValidation.js';

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
  // Debug: Log the first deal's structure to identify available fields
  if (Math.random() < 0.1) { // Log ~10% of deals to avoid spam
    console.log('📋 Sample deal structure:', {
      id: deal.id,
      title: deal.title,
      availableFields: Object.keys(deal).filter(key => 
        key.toLowerCase().includes('address') || 
        key.includes('Address') ||
        key.includes('address')
      ),
      person: deal.person ? {
        name: deal.person.name,
        hasAddress: !!deal.person.address,
        address: deal.person.address
      } : null
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
  
  // Check for custom 'Deal Address' field first
  if (deal['Deal Address'] && typeof deal['Deal Address'] === 'string' && deal['Deal Address'].trim()) {
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
    start = 0,
    includeArchived = false 
  } = options;

  try {
    console.log(`📋 Fetching deals with filter ${filterId}...`);
    
    const client = createPipedriveClient();
    
    // READ-ONLY: Only GET request to fetch deals
    const response = await client.get('/deals', {
      params: {
        filter_id: filterId,
        limit: limit,
        start: start,
        status: includeArchived ? 'all_not_deleted' : 'open',
        sort: 'value DESC' // Sort by value, highest first
      }
    });

    if (!response.data.success) {
      throw new Error(`Pipedrive API error: ${response.data.error || 'Unknown error'}`);
    }

    const deals = response.data.data || [];
    console.log(`✅ Fetched ${deals.length} deals from filter ${filterId}`);

    // Transform deals to standardized format
    const transformedDeals = deals.map(transformPipedriveDeal);
    
    return {
      deals: transformedDeals,
      pagination: response.data.additional_data?.pagination || null,
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
    
    const result = await fetchDealsWithFilter(filter.filterId, options);
    
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
    return { minDistance: null, closestActivity: null, allDistances: [] };
  }

  const distances = [];
  
  for (const activity of inspectionActivities) {
    // Try multiple coordinate sources
    let activityCoords = null;
    
    if (activity.coordinates) {
      activityCoords = activity.coordinates;
    } else if (activity.personAddress?.coordinates) {
      activityCoords = activity.personAddress.coordinates;
    } else if (activity.lat && activity.lng) {
      activityCoords = { lat: activity.lat, lng: activity.lng };
    }
    
    if (activityCoords && activityCoords.lat && activityCoords.lng) {
      const distance = calculateDistance(
        deal.coordinates.lat,
        deal.coordinates.lng,
        activityCoords.lat,
        activityCoords.lng
      );
      
      distances.push({
        activity,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        activityAddress: activity.personAddress?.formatted_address || 
                        activity.subject?.replace(/.*?(?=\d)/, '').trim() || 
                        'Unknown address'
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
  REGIONAL_DEAL_FILTERS
};