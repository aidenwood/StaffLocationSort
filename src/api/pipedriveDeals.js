// Pipedrive Deals READ-ONLY API Service  
// ⚠️ THIS FILE CONTAINS ONLY GET REQUESTS - NO WRITE OPERATIONS
// Safe for production use - only reads deal data from Pipedrive for recommendations

import axios from 'axios';
import { geocodeAddress } from '../services/geocoding.js';
import { parseDealAddress } from '../utils/dealAddressParser.js';
import { calculateDistance } from '../utils/regionValidation.js';

// Deals cache configuration
const CACHE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours (deals addresses change infrequently)
const CACHE_KEY_PREFIX = 'staffLocationSort.dealsCache';
const STAGES_CACHE_KEY = 'staffLocationSort.stagesCache';
const STAGES_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours (stages rarely change)

// Cache utilities
const getCachedDeals = (region) => {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}.${region}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}.${region}`);
      return null;
    }
    
    console.log(`📦 Using cached deals for region ${region} (${data.length} deals, ${Math.round((now - timestamp) / 1000)}s old)`);
    return data;
  } catch (error) {
    console.warn('Error reading deals cache:', error);
    return null;
  }
};

const setCachedDeals = (region, deals) => {
  try {
    const cacheData = {
      data: deals,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}.${region}`, JSON.stringify(cacheData));
    console.log(`💾 Cached ${deals.length} deals for region ${region}`);
  } catch (error) {
    console.warn('Error writing deals cache:', error);
  }
};

const clearExpiredCache = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX));
    const now = Date.now();
    
    keys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (now - timestamp > CACHE_EXPIRY_MS) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error cleaning expired cache:', error);
  }
};

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

// Legacy cache removed - using localStorage cache instead

/**
 * Fetch and cache all pipeline stages from Pipedrive
 * @returns {Promise<Object>} Map of stage_id to stage data
 */
export const fetchAndCacheStages = async () => {
  try {
    // Check cache first
    const cached = localStorage.getItem(STAGES_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // Return cached data if not expired
      if (now - timestamp < STAGES_CACHE_EXPIRY) {
        console.log(`📦 Using cached stages (${Object.keys(data).length} stages, ${Math.round((now - timestamp) / 1000 / 60)} minutes old)`);
        return data;
      }
    }
    
    console.log('🔄 Fetching fresh pipeline stages from Pipedrive...');
    const client = createPipedriveClient();
    
    // Fetch all stages
    const response = await client.get('/stages', {
      params: {
        limit: 100 // Get all stages (most companies have <100 stages)
      }
    });
    
    if (!response.data.success) {
      throw new Error(`Failed to fetch stages: ${response.data.error || 'Unknown error'}`);
    }
    
    // Transform stages into a map for quick lookup
    const stagesMap = {};
    const stages = response.data.data || [];
    
    stages.forEach(stage => {
      stagesMap[stage.id] = {
        id: stage.id,
        name: stage.name,
        pipeline_id: stage.pipeline_id,
        pipeline_name: stage.pipeline_name,
        order_nr: stage.order_nr,
        active_flag: stage.active_flag,
        deal_probability: stage.deal_probability,
        rotten_flag: stage.rotten_flag,
        rotten_days: stage.rotten_days
      };
    });
    
    // Cache the stages
    const cacheData = {
      data: stagesMap,
      timestamp: Date.now()
    };
    localStorage.setItem(STAGES_CACHE_KEY, JSON.stringify(cacheData));
    
    console.log(`✅ Fetched and cached ${Object.keys(stagesMap).length} stages`);
    
    // Log stage names for debugging
    const stageNames = stages.map(s => s.name).slice(0, 10);
    console.log(`📋 Sample stages: ${stageNames.join(', ')}${stages.length > 10 ? '...' : ''}`);
    
    return stagesMap;
  } catch (error) {
    console.error('❌ Error fetching stages:', error);
    
    // Try to return cached data even if expired
    const cached = localStorage.getItem(STAGES_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      console.log('⚠️ Using expired cache due to error');
      return data;
    }
    
    // Return empty map if no cache available
    return {};
  }
};

/**
 * Get stage name by ID (using cache)
 * @param {number} stageId - Stage ID
 * @returns {Promise<string>} Stage name
 */
export const getStageName = async (stageId) => {
  const stages = await fetchAndCacheStages();
  return stages[stageId]?.name || `Stage ${stageId}`;
};

/**
 * Clear stages cache (useful for forcing refresh)
 */
export const clearStagesCache = () => {
  localStorage.removeItem(STAGES_CACHE_KEY);
  console.log('🗑️ Cleared stages cache');
};

/**
 * Transform Pipedrive deal data to standardized format
 * @param {Object} deal - Raw deal object from Pipedrive
 * @param {Object} stagesMap - Optional pre-fetched stages map
 * @returns {Object} Transformed deal data
 */
export const transformPipedriveDeal = (deal, stagesMap = null) => {

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
  }
  
  // Check person custom fields for address if not found in deal
  if (!address && deal.person) {
    // First check the known person address hash
    if (deal.person['6fa72064159f058167dcdab4ae78eb140eae6f05'] && typeof deal.person['6fa72064159f058167dcdab4ae78eb140eae6f05'] === 'string') {
      address = deal.person['6fa72064159f058167dcdab4ae78eb140eae6f05'].trim();
      addressSource = 'person_address_hash';
    } 
    // Then check all person custom fields
    else {
      for (const key of Object.keys(deal.person)) {
        if (key.length === 40 && deal.person[key] && typeof deal.person[key] === 'string') {
          const value = String(deal.person[key]).trim();
          // Check if it looks like a real street address
          if (value && value.length > 10 && value.length < 200 &&
              /\d/.test(value) && // Has at least one number
              /[a-zA-Z]/.test(value) && // Has letters
              // Must look like an actual address
              (/\d+\s+[A-Za-z]/.test(value) || // Street number pattern OR
               /\b(unit|lot|suite|level)\s*\d+/i.test(value)) && // Unit/lot pattern
              !value.includes('[FBA]') && 
              !value.includes('[R') &&
              !value.includes('facebook') &&
              !value.includes('@') && 
              !value.startsWith('http')) {
            address = value;
            addressSource = 'person_custom_field';
            console.log(`✅ Found address in person custom field ${key}: ${value.substring(0, 50)}...`);
            break;
          }
        }
      }
    }
    // Fallback to standard person address field
    if (!address && deal.person.address) {
      address = deal.person.address;
      addressSource = 'person_address';
    }
  }
  
  // Check org address if still no address
  if (!address && deal.org?.address) {
    address = deal.org.address;
    addressSource = 'org_address';
  }
  
  // Check deal address field
  if (!address && deal.address) {
    address = deal.address;
    addressSource = 'deal_address';
  }
  
  // Check all deal custom fields (40-character hashes) for addresses
  if (!address) {
    for (const key of Object.keys(deal)) {
      if (key.length === 40 && key !== 'fc56b2671002827523bc3711b6a790f5ff00963f' && deal[key] && typeof deal[key] === 'string') {
        const value = String(deal[key]).trim();
        // More strict address validation - must be a real street address
        if (value && value.length > 10 && value.length < 200 && // Reasonable address length
            /\d/.test(value) && // Has at least one number
            /[a-zA-Z]/.test(value) && // Has letters
            (
              // Must have actual street type indicators (not just state/region)
              /\d+\s+[A-Za-z]/.test(value) && // Starts with street number pattern
              /\b(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Crescent|Cres|Place|Pl|Lane|Ln|Court|Ct|Way|Parade|Pde|Terrace|Tce|Circuit|Cct|Close|Cl|Boulevard|Blvd)\b/i.test(value)
            ) &&
            // Exclude metadata and non-address content
            !value.includes('[FBA]') && // Not metadata
            !value.includes('[R') && // Not region codes like [R8]
            !value.includes('facebook') && // Not social media references
            !value.includes('Lead Gen') && 
            !value.includes('Advertising') &&
            !value.includes('@') && // Not email
            !value.startsWith('http') && // Not URL
            !/^\d{8,}$/.test(value) && // Not just a phone number
            !/^[A-Z0-9\-]+$/.test(value)) { // Not just an ID
          address = value;
          addressSource = 'deal_custom_field';
          console.log(`✅ Found address in deal custom field ${key}: ${value.substring(0, 50)}...`);
          break;
        }
      }
    }
  }
  
  // Check organization custom fields if still no address  
  if (!address && deal.org) {
    for (const key of Object.keys(deal.org)) {
      if (key.length === 40 && deal.org[key] && typeof deal.org[key] === 'string') {
        const value = String(deal.org[key]).trim();
        // Check for valid address patterns
        if (value && value.length > 10 && value.length < 200 &&
            /\d/.test(value) && 
            /[a-zA-Z]/.test(value) && 
            (/\d+\s+[A-Za-z]/.test(value) || /\b(unit|lot|suite|level)\s*\d+/i.test(value)) &&
            !value.includes('[FBA]') &&
            !value.includes('[R') &&
            !value.includes('facebook') &&
            !value.includes('@') && 
            !value.startsWith('http')) {
          address = value;
          addressSource = 'org_custom_field';
          console.log(`✅ Found address in org custom field ${key}: ${value.substring(0, 50)}...`);
          break;
        }
      }
    }
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

  // Get stage name if stages map is provided
  const stageData = stagesMap ? stagesMap[deal.stage_id] : null;
  
  return {
    id: deal.id,
    title: deal.title || `Property Inspection - ${deal.person?.name || 'Unknown'}`,
    value: value,
    priority: priority,
    stage: deal.stage_id,
    stageName: stageData?.name || null,
    stageOrder: stageData?.order_nr || null,
    pipelineName: stageData?.pipeline_name || null,
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
    
    // Fetch stages first (will use cache if available)
    const stagesMap = await fetchAndCacheStages();
    
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

    // Transform deals to standardized format with stage names
    const transformedDeals = allDeals.map(deal => transformPipedriveDeal(deal, stagesMap));
    
    // Address analysis summary
    const addressStats = transformedDeals.reduce((stats, deal) => {
      if (deal.address) stats.withAddress++;
      else stats.withoutAddress++;
      return stats;
    }, { withAddress: 0, withoutAddress: 0 });
    
    if (addressStats.withoutAddress > 0) {
      console.log(`📋 Deal address analysis: ${addressStats.withAddress} with address, ${addressStats.withoutAddress} without`);
    }
    
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
  // Clean expired cache entries first
  clearExpiredCache();
  
  // Create cache key that includes options for unique caching
  const cacheKey = options && Object.keys(options).length > 0 
    ? `${region}_${JSON.stringify(options)}`
    : region;
  
  // Check localStorage cache first
  const cachedDeals = getCachedDeals(cacheKey);
  if (cachedDeals) {
    // Validate cached deals have coordinates
    const dealsWithCoordinates = cachedDeals.filter(deal => deal.coordinates && deal.coordinates.lat && deal.coordinates.lng);
    const dealsWithAddresses = cachedDeals.filter(deal => deal.address && deal.address.trim());
    
    console.log(`🔍 Cache validation: ${dealsWithCoordinates.length}/${cachedDeals.length} deals have coordinates, ${dealsWithAddresses.length} have addresses`);
    
    // If we have deals with addresses but no coordinates, cache is corrupted - re-fetch and re-geocode
    if (dealsWithAddresses.length > 0 && dealsWithCoordinates.length === 0) {
      console.warn('⚠️ Cache corrupted: Deals have addresses but no coordinates. Re-fetching...');
      // Clear the corrupted cache
      localStorage.removeItem(`${CACHE_KEY_PREFIX}.${cacheKey}`);
    } else if (cachedDeals.length > 0) {
      return cachedDeals;
    }
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
      
      // Cache the enriched result in localStorage
      setCachedDeals(cacheKey, enrichedDeals);
      
      console.log(`✅ Fetched and cached ${enrichedDeals.length} enriched deals for region: ${region}`);
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
  
  let noAddressCount = 0;
  let alreadyGeocodedCount = 0;
  let needGeocodingCount = 0;
  
  // Process deals with rate limiting (avoid overwhelming Google's API)
  const enriched = [];
  const BATCH_SIZE = 10; // Process 10 at a time to avoid rate limits
  const BATCH_DELAY = 100; // 100ms between batches
  
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = deals.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(batch.map(async (deal) => {
      if (!deal.address) {
        noAddressCount++;
        return deal;
      }

      // Skip geocoding if deal already has coordinates
      if (deal.coordinates && deal.coordinates.lat && deal.coordinates.lng) {
        alreadyGeocodedCount++;
        return deal;
      }

      needGeocodingCount++;
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
    
    enriched.push(...batchResults);
    
    // Add small delay between batches to respect rate limits
    if (i + BATCH_SIZE < deals.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  const successCount = enriched.filter(deal => deal.coordinates).length;
  console.log(`✅ Geocoding results: ${successCount}/${deals.length} deals have coordinates`);
  console.log(`📊 Breakdown: ${alreadyGeocodedCount} already cached, ${needGeocodingCount} newly geocoded, ${noAddressCount} no address`);
  
  if (alreadyGeocodedCount > 0) {
    console.log(`⚡ Cache hit: Skipped geocoding ${alreadyGeocodedCount} deals (${Math.round(alreadyGeocodedCount/deals.length*100)}% cached)`);
  }
  
  return enriched;
};

/**
 * Get cache status and statistics
 * @returns {Object} Cache status information
 */
export const getCacheStatus = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX));
    let totalDeals = 0;
    let cachedRegions = [];
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    
    keys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const region = key.replace(`${CACHE_KEY_PREFIX}.`, '').split('_')[0];
          cachedRegions.push({ 
            region, 
            dealCount: data.length, 
            age: Math.round((Date.now() - timestamp) / 1000),
            expires: Math.round((CACHE_EXPIRY_MS - (Date.now() - timestamp)) / 1000)
          });
          totalDeals += data.length;
          oldestTimestamp = Math.min(oldestTimestamp, timestamp);
          newestTimestamp = Math.max(newestTimestamp, timestamp);
        }
      } catch (error) {
        // Skip invalid cache entries
      }
    });
    
    return {
      totalCacheEntries: keys.length,
      totalCachedDeals: totalDeals,
      regions: cachedRegions,
      oldestCacheAge: cachedRegions.length > 0 ? Math.round((Date.now() - oldestTimestamp) / 1000) : 0,
      newestCacheAge: cachedRegions.length > 0 ? Math.round((Date.now() - newestTimestamp) / 1000) : 0,
      cacheExpiryMs: CACHE_EXPIRY_MS
    };
  } catch (error) {
    console.warn('Error getting cache status:', error);
    return { error: error.message };
  }
};

/**
 * Clear deals cache (local operation only)
 * @param {string} region - Specific region to clear, or null for all
 */
export const clearDealsCache = (region = null) => {
  try {
    if (region) {
      // Clear specific region cache
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(CACHE_KEY_PREFIX) && key.includes(region)
      );
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ Cleared deals cache for region: ${region} (${keys.length} entries)`);
      return keys.length;
    } else {
      // Clear all deals cache
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(CACHE_KEY_PREFIX)
      );
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ Cleared all deals cache (${keys.length} entries)`);
      return keys.length;
    }
  } catch (error) {
    console.warn('Error clearing deals cache:', error);
    return 0;
  }
};

/**
 * Force refresh deals for a region - clears cache and re-fetches with geocoding
 * @param {string} region - Region to refresh
 * @returns {Promise<{newDeals: number, totalDeals: number}>}
 */
export const forceRefreshDeals = async (region) => {
  console.log(`🔄 Force refreshing deals for region: ${region}`);
  
  // Get current cached deals count for comparison
  const currentCacheKey = region;
  const currentCachedDeals = getCachedDeals(currentCacheKey);
  const previousCount = currentCachedDeals ? currentCachedDeals.length : 0;
  
  // Clear the cache for this region
  clearDealsCache(region);
  
  // Re-fetch deals (will trigger geocoding since cache is empty)
  const refreshedDeals = await getDealsForRegion(region, { limit: 200 });
  
  return {
    newDeals: refreshedDeals.length - previousCount,
    totalDeals: refreshedDeals.length,
    previousCount
  };
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
  if (!deal.coordinates) {
    // Skip logging for deals without coordinates - handled in summary
    return { minDistance: null, closestActivity: null, allDistances: [] };
  }

  const distances = [];
  
  // Check if we have a grid region center for distance sorting
  if (window.gridRegionCenter) {
    const regionCenter = window.gridRegionCenter;
    console.log(`📍 Using grid region center for distance sorting: ${regionCenter.name}`);
    
    const distance = calculateDistance(
      deal.coordinates.lat,
      deal.coordinates.lng,
      regionCenter.lat,
      regionCenter.lng
    );
    
    // Skip if distance is exactly 0.0 (indicates geocoding error)
    if (distance >= 0.01) {
      distances.push({
        activity: {
          id: 'grid-region-center',
          subject: `${regionCenter.name} Center`,
          personAddress: regionCenter.name
        },
        distance: Math.round(distance * 100) / 100,
        activityAddress: regionCenter.name,
        coordSource: 'grid-region-center'
      });
      
      // Return early with just the region center distance
      return {
        minDistance: Math.round(distance * 100) / 100,
        closestActivity: distances[0].activity,
        allDistances: distances
      };
    } else {
      // Distance is 0.0, likely geocoding error
      console.warn(`⚠️ Skipping deal ${deal.id} - 0.0km from region center (likely geocoding error)`);
      return { minDistance: null, closestActivity: null, allDistances: [] };
    }
  }

  // Original logic for inspection activities
  if (!Array.isArray(inspectionActivities)) {
    return { minDistance: null, closestActivity: null, allDistances: [] };
  }
  
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
      
      // Skip if distance is exactly 0.0 (indicates geocoding error - same location)
      if (distance >= 0.01) {
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
      } else {
        console.warn(`⚠️ Skipping deal ${deal.id} - 0.0km from inspection (likely geocoding error)`);
      }
      
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
  getCacheStatus,
  clearDealsCache,
  forceRefreshDeals,
  healthCheckDeals,
  transformPipedriveDeal,
  getFilterForRegion,
  calculateDealDistances,
  sortDealsByDistance,
  findDealsNearLocation,
  groupDealsByProximity,
  REGIONAL_DEAL_FILTERS
};