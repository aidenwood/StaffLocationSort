// Google Geocoding Service
// Converts addresses to lat/lng coordinates for map display

const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

// Persistent cache for geocoded addresses to avoid redundant API calls
const GEOCODE_CACHE_KEY = 'staffLocationSort.geocodeCache';
const CIRCUIT_BREAKER_KEY = 'staffLocationSort.circuitBreaker';
const geocodeCache = new Map();

// Circuit breaker to prevent repeated API failures
let consecutiveFailures = 0;
const MAX_FAILURES = 3;
let circuitBreakerTripped = false;
let lastFailureTime = null;

// Load cache and circuit breaker state from localStorage
function loadCache() {
  try {
    const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      Object.entries(data).forEach(([address, coordinates]) => {
        geocodeCache.set(address, coordinates);
      });
      console.log(`📦 Loaded ${geocodeCache.size} geocoded addresses from cache`);
    }
  } catch (error) {
    console.warn('Error loading geocode cache:', error);
  }

  try {
    const breakerData = localStorage.getItem(CIRCUIT_BREAKER_KEY);
    if (breakerData) {
      const { failures, tripped, lastFailure } = JSON.parse(breakerData);
      consecutiveFailures = failures || 0;
      circuitBreakerTripped = tripped || false;
      lastFailureTime = lastFailure;
      
      if (circuitBreakerTripped) {
        console.warn(`⚠️ Circuit breaker was tripped. ${consecutiveFailures} consecutive failures.`);
      }
    }
  } catch (error) {
    console.warn('Error loading circuit breaker state:', error);
  }
}

// Save cache to localStorage
function saveCache() {
  try {
    const data = Object.fromEntries(geocodeCache);
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Error saving geocode cache:', error);
  }
}

// Save circuit breaker state
function saveBreakerState() {
  try {
    const data = {
      failures: consecutiveFailures,
      tripped: circuitBreakerTripped,
      lastFailure: lastFailureTime
    };
    localStorage.setItem(CIRCUIT_BREAKER_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Error saving circuit breaker state:', error);
  }
}

// Initialize cache on module load
loadCache();

/**
 * Geocode an address string to lat/lng coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export const geocodeAddress = async (address) => {
  if (!address || typeof address !== 'string') {
    console.warn('⚠️ Invalid address for geocoding:', address);
    return null;
  }

  // Clean up address string
  const cleanAddress = address.trim();
  if (!cleanAddress) {
    console.warn('⚠️ Empty address for geocoding');
    return null;
  }

  // Check cache first
  if (geocodeCache.has(cleanAddress)) {
    return geocodeCache.get(cleanAddress);
  }

  // Circuit breaker: Stop making requests if we've had too many failures
  if (circuitBreakerTripped) {
    const timeSinceFailure = Date.now() - lastFailureTime;
    if (timeSinceFailure < 300000) { // Wait 5 minutes before trying again
      console.warn(`🚫 Circuit breaker: Skipping geocoding due to recent API failures. Wait ${Math.ceil((300000 - timeSinceFailure) / 60000)} minutes.`);
      return null;
    } else {
      // Reset circuit breaker after 5 minutes
      circuitBreakerTripped = false;
      consecutiveFailures = 0;
    }
  }

  try {
    console.log(`🌍 Geocoding address: "${cleanAddress}"`);
    
    // Try Google Maps JavaScript API first (bypasses URL restrictions)
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      return new Promise((resolve) => {
        const geocoder = new window.google.maps.Geocoder();
        
        geocoder.geocode({ address: cleanAddress }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            const location = results[0].geometry.location;
            const coordinates = { 
              lat: location.lat(), 
              lng: location.lng() 
            };
            
            // Cache the result both in memory and localStorage
            geocodeCache.set(cleanAddress, coordinates);
            saveCache();
            
            // Reset circuit breaker on success
            consecutiveFailures = 0;
            if (circuitBreakerTripped) {
              circuitBreakerTripped = false;
              saveBreakerState();
              console.log(`✅ Circuit breaker reset after successful geocoding`);
            }
            
            console.log(`✅ Geocoded "${cleanAddress}" to: ${coordinates.lat}, ${coordinates.lng} (via JS API)`);
            resolve(coordinates);
          } else {
            console.warn(`❌ JS API Geocoding failed for "${cleanAddress}": ${status}`);
            
            // Track failures for circuit breaker
            consecutiveFailures++;
            lastFailureTime = Date.now();
            if (consecutiveFailures >= MAX_FAILURES) {
              circuitBreakerTripped = true;
              console.error(`🚫 CIRCUIT BREAKER TRIPPED: Too many JS API failures (${consecutiveFailures}). Stopping requests for 5 minutes.`);
            }
            saveBreakerState();
            
            // Cache null result to avoid retrying
            geocodeCache.set(cleanAddress, null);
            saveCache();
            resolve(null);
          }
        });
      });
    }

    // Fallback to REST API (will likely fail with URL restrictions but try anyway)
    console.log(`🔄 Google Maps JS API not available, trying REST API for "${cleanAddress}"`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coordinates = { lat: location.lat, lng: location.lng };
      
      // Cache the result both in memory and localStorage
      geocodeCache.set(cleanAddress, coordinates);
      saveCache();
      
      // Reset circuit breaker on success
      consecutiveFailures = 0;
      if (circuitBreakerTripped) {
        circuitBreakerTripped = false;
        saveBreakerState();
        console.log(`✅ Circuit breaker reset after successful geocoding`);
      }
      
      console.log(`✅ Geocoded "${cleanAddress}" to: ${coordinates.lat}, ${coordinates.lng}`);
      return coordinates;
    } else {
      console.warn(`❌ Geocoding failed for "${cleanAddress}": ${data.status}`, data);
      
      // Track failures for circuit breaker
      consecutiveFailures++;
      lastFailureTime = Date.now();
      if (consecutiveFailures >= MAX_FAILURES) {
        circuitBreakerTripped = true;
        console.error(`🚫 CIRCUIT BREAKER TRIPPED: Too many geocoding failures (${consecutiveFailures}). Stopping requests for 5 minutes to prevent API abuse.`);
      }
      saveBreakerState();
      
      // Cache null result to avoid retrying
      geocodeCache.set(cleanAddress, null);
      saveCache();
      return null;
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${cleanAddress}":`, error);
    
    // Track failures for circuit breaker
    consecutiveFailures++;
    lastFailureTime = Date.now();
    if (consecutiveFailures >= MAX_FAILURES) {
      circuitBreakerTripped = true;
      console.error(`🚫 CIRCUIT BREAKER TRIPPED: Too many geocoding errors (${consecutiveFailures}). Stopping requests for 5 minutes to prevent API abuse.`);
    }
    saveBreakerState();
    
    return null;
  }
};

/**
 * Geocode multiple addresses in parallel
 * @param {string[]} addresses - Array of addresses to geocode
 * @returns {Promise<Array<{address: string, coordinates: {lat: number, lng: number} | null}>>}
 */
export const geocodeAddresses = async (addresses) => {
  const promises = addresses.map(async (address) => {
    const coordinates = await geocodeAddress(address);
    return { address, coordinates };
  });

  return await Promise.all(promises);
};

/**
 * Get center point for multiple coordinates (for map centering)
 * @param {Array<{lat: number, lng: number}>} coordinates 
 * @returns {{lat: number, lng: number}}
 */
export const getCenterPoint = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    // Default to Logan Central
    return { lat: -27.6378, lng: 153.1094 };
  }

  if (coordinates.length === 1) {
    return coordinates[0];
  }

  // Calculate center point
  const totalLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0);
  const totalLng = coordinates.reduce((sum, coord) => sum + coord.lng, 0);

  return {
    lat: totalLat / coordinates.length,
    lng: totalLng / coordinates.length
  };
};

/**
 * Determine appropriate zoom level based on coordinate spread
 * @param {Array<{lat: number, lng: number}>} coordinates 
 * @returns {number} - Zoom level (1-20)
 */
export const getZoomLevel = (coordinates) => {
  if (!coordinates || coordinates.length <= 1) {
    return 12; // Default zoom for single location
  }

  // Calculate bounding box
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  
  const maxSpread = Math.max(latSpread, lngSpread);
  
  // Determine zoom based on spread
  if (maxSpread > 2) return 6;   // Very wide area (multiple cities)
  if (maxSpread > 1) return 8;   // Wide area (city to city)
  if (maxSpread > 0.5) return 10; // Large city area
  if (maxSpread > 0.1) return 12; // City district
  if (maxSpread > 0.05) return 14; // Suburb
  return 16; // Close neighborhood
};

/**
 * Clear geocoding cache (useful for testing)
 */
export const clearGeocodeCache = () => {
  geocodeCache.clear();
  localStorage.removeItem(GEOCODE_CACHE_KEY);
  console.log('🧹 Geocoding cache cleared');
};

export const resetCircuitBreaker = () => {
  consecutiveFailures = 0;
  circuitBreakerTripped = false;
  lastFailureTime = null;
  localStorage.removeItem(CIRCUIT_BREAKER_KEY);
  console.log('🔄 Circuit breaker reset');
};

export const getGeocodeStats = () => {
  return {
    cacheSize: geocodeCache.size,
    consecutiveFailures,
    circuitBreakerTripped,
    lastFailureTime: lastFailureTime ? new Date(lastFailureTime).toISOString() : null
  };
};

export default { 
  geocodeAddress, 
  geocodeAddresses, 
  getCenterPoint, 
  getZoomLevel, 
  clearGeocodeCache,
  getGeocodeStats,
  resetCircuitBreaker
};