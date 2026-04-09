// Region validation and inspector matching utilities

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

// Comprehensive region center coordinates for all service areas
export const regionCenters = {
  'R01': { 
    lat: -27.4698, 
    lng: 153.0251, 
    name: 'R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)',
    locations: ['Ipswich', 'Gold Coast', 'Logan', 'Brisbane', 'Beaudesert']
  },
  'R02': { 
    lat: -25.9500, 
    lng: 152.7000, 
    name: 'R02 - GM (Gympie/Maryborough)',
    locations: ['Gympie', 'Maryborough', 'Tin Can Bay']
  },
  'R03': { 
    lat: -26.6500, 
    lng: 153.0667, 
    name: 'R03 - SC (Sunshine Coast)',
    locations: ['Sunshine Coast', 'Moreton Region']
  },
  'R04': { 
    lat: -27.5598, 
    lng: 151.9507, 
    name: 'R04 - GT (Gatton/Toowoomba)',
    locations: ['Gatton', 'Toowoomba', 'Oakey']
  },
  'R05': { 
    lat: -28.5000, 
    lng: 151.5000, 
    name: 'R05 - WST (Warwick/Stanthorpe/Texas)',
    locations: ['Stanthorpe', 'Tara', 'Warwick', 'Texas']
  },
  'R06': { 
    lat: -23.8000, 
    lng: 148.5000, 
    name: 'R06 - RER (Emerald/Rockhampton/Roma)',
    locations: ['Emerald', 'Rockhampton', 'Roma']
  },
  'R07': { 
    lat: -29.6891, 
    lng: 152.9279, 
    name: 'R07 - GPM (Grafton/Port Macquarie)',
    locations: ['Grafton', 'Port Macquarie', 'Coffs Harbour']
  },
  'R08': { 
    lat: -30.5000, 
    lng: 151.6500, 
    name: 'R08 - GA (Greater Armidale)',
    locations: ['Tamworth', 'Armidale', 'Glen Innes']
  },
  'R09': { 
    lat: -32.9267, 
    lng: 151.7789, 
    name: 'R09 - NR (Newcastle Region)',
    locations: ['Aberglasslyn', 'Rutherford', 'Maitland', 'Newcastle', 'Mereweather', 'Gwandalan', 'Port Stephens', 'Cessnock', 'Lake Macquarie', 'Central Coast']
  },
  'R10': { 
    lat: -33.7488, 
    lng: 150.3120, 
    name: 'R10 - SYD (Sydney/Penrith)',
    locations: ['Penrith', 'Sydney', 'Parramatta', 'Liverpool', 'Campbelltown', 'Blacktown', 'Camden', 'Richmond', 'Windsor']
  }
};

// Check if an address is within service area (75km of any region)
export function validateAddressInServiceArea(addressLat, addressLng) {
  const maxDistance = 75; // kilometers
  
  for (const [regionCode, regionData] of Object.entries(regionCenters)) {
    const distance = calculateDistance(
      addressLat, 
      addressLng, 
      regionData.lat, 
      regionData.lng
    );
    
    if (distance <= maxDistance) {
      return {
        inServiceArea: true,
        closestRegion: {
          code: regionCode,
          name: regionData.name,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
          locations: regionData.locations
        }
      };
    }
  }
  
  // Find the closest region even if out of service area
  let closestRegion = null;
  let minDistance = Infinity;
  
  for (const [regionCode, regionData] of Object.entries(regionCenters)) {
    const distance = calculateDistance(
      addressLat, 
      addressLng, 
      regionData.lat, 
      regionData.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestRegion = {
        code: regionCode,
        name: regionData.name,
        distance: Math.round(distance * 10) / 10,
        locations: regionData.locations
      };
    }
  }
  
  return {
    inServiceArea: false,
    closestRegion
  };
}

// Find inspectors in a specific region
export function getInspectorsByRegion(inspectors, regionCode) {
  return inspectors.filter(inspector => 
    inspector.region === regionCode && inspector.active_flag
  );
}

// Calculate drive time estimates for inspectors to a new address
export async function calculateInspectorDriveTimes(inspectors, targetAddress) {
  const results = [];
  
  for (const inspector of inspectors) {
    // For now, use distance as a proxy for drive time
    // In production, this would use Google Maps Directions API
    
    // Approximate inspector location based on their region
    const regionData = regionCenters[inspector.region];
    if (!regionData) continue;
    
    const distance = calculateDistance(
      targetAddress.lat,
      targetAddress.lng,
      regionData.lat,
      regionData.lng
    );
    
    // Rough estimate: average 60km/h including traffic and stops
    const estimatedDriveTime = Math.round((distance / 60) * 60); // minutes
    
    results.push({
      inspector,
      distance: Math.round(distance * 10) / 10,
      estimatedDriveTime,
      driveTimeAddition: estimatedDriveTime // For now, assume this is the addition to their schedule
    });
  }
  
  return results;
}

// Find the 3 inspectors with smallest drive time additions
export function findBestInspectorMatches(inspectorDriveTimes) {
  return inspectorDriveTimes
    .sort((a, b) => a.driveTimeAddition - b.driveTimeAddition)
    .slice(0, 3);
}