// Pipedrive Filters Configuration
// Pre-created filters in Pipedrive for server-side filtering

// Filter ID 215315: All inspections created by API owner (for debugging all inspectors)
// Filter URL: https://rebuildrelief.pipedrive.com/activities/list/filter/215315
export const PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID = 215315;

// This filter captures ALL Property Inspection activities from all inspectors
// Great for debugging and seeing total activity count
// Only uses GET requests (no POST required to create filters)

// Filter configuration for different inspectors
export const PIPEDRIVE_FILTERS = {
  // All inspectors filter for debugging
  ALL_PROPERTY_INSPECTIONS: PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID,
  
  // Regional deal filters for recommendations
  R1_DEALS_READY_TO_BOOK: 222491, // Brisbane, Ipswich, Logan, Gold Coast
  
  // Individual inspector filters (can be added when created in Pipedrive)
  // 'Ben F': 215319,
  // 'Ben W': 123456,
  // 'Ross Mitchell': 123457,
  // etc.
};

// Helper function to get the appropriate filter ID
export const getFilterForInspector = (inspectorId = null) => {
  // Use the all-inspectors filter for debugging - shows all activities from server
  // Then we filter by inspector client-side for specific inspector views
  return PIPEDRIVE_FILTERS.ALL_PROPERTY_INSPECTIONS;
};

// Cache for filter validation
let filterValidationCache = null;

// Validate that the filter exists and is accessible
export const validateFilter = async (filterId) => {
  if (filterValidationCache && filterValidationCache[filterId]) {
    return filterValidationCache[filterId];
  }
  
  try {
    const PIPEDRIVE_API_TOKEN = import.meta.env.VITE_PIPEDRIVE_API_KEY;
    const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';
    
    if (!PIPEDRIVE_API_TOKEN) {
      return { valid: false, error: 'No API token configured' };
    }
    
    const response = await fetch(
      `${PIPEDRIVE_BASE_URL}/filters/${filterId}?api_token=${PIPEDRIVE_API_TOKEN}`,
      { method: 'GET' }
    );
    
    const result = await response.json();
    
    if (!filterValidationCache) {
      filterValidationCache = {};
    }
    
    const validation = {
      valid: result.success === true,
      error: result.success ? null : result.error || 'Filter not found',
      filterName: result.data?.name || 'Unknown',
      filterType: result.data?.type || 'Unknown'
    };
    
    filterValidationCache[filterId] = validation;
    return validation;
    
  } catch (error) {
    const validation = {
      valid: false,
      error: `Failed to validate filter: ${error.message}`
    };
    
    if (!filterValidationCache) {
      filterValidationCache = {};
    }
    filterValidationCache[filterId] = validation;
    
    return validation;
  }
};

export default PIPEDRIVE_FILTERS;