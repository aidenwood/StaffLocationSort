// Google Geocoding Service
// Converts addresses to lat/lng coordinates for map display

const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

// Cache for geocoded addresses to avoid redundant API calls
const geocodeCache = new Map();

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
    console.log(`📍 Using cached coordinates for: ${cleanAddress}`);
    return geocodeCache.get(cleanAddress);
  }

  try {
    console.log(`📍 Geocoding: ${cleanAddress}`);
    
    // Use Google Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coordinates = { lat: location.lat, lng: location.lng };
      
      // Cache the result
      geocodeCache.set(cleanAddress, coordinates);
      
      console.log(`✅ Geocoded to: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
      return coordinates;
    } else {
      console.warn(`⚠️ No results: ${cleanAddress} (${data.status})`);
      
      // Cache null result to avoid retrying
      geocodeCache.set(cleanAddress, null);
      return null;
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${cleanAddress}":`, error);
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
  console.log('🧹 Geocoding cache cleared');
};

export default { 
  geocodeAddress, 
  geocodeAddresses, 
  getCenterPoint, 
  getZoomLevel, 
  clearGeocodeCache 
};