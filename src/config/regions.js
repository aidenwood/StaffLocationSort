// Regional Service Area Configuration
// Based on NEW LOS - Region Breakdown data

export const REGIONS = {
  R01: {
    code: 'R01',
    name: 'BGCI',
    fullName: 'R01 - BGCI',
    areas: ['Ipswich', 'Gold Coast', 'Logan', 'Brisbane', 'Beaudesert']
  },
  R02: {
    code: 'R02', 
    name: 'GM',
    fullName: 'R02 - GM',
    areas: ['Gympie', 'Maryborough', 'Tin Can Bay']
  },
  R03: {
    code: 'R03',
    name: 'SC', 
    fullName: 'R03 - SC',
    areas: ['Sunshine Coast', 'Moreton Region']
  },
  R04: {
    code: 'R04',
    name: 'GT',
    fullName: 'R04 - GT', 
    areas: ['Gatton', 'Toowoomba', 'Oakey']
  },
  R05: {
    code: 'R05',
    name: 'WST',
    fullName: 'R05 - WST',
    areas: ['Stanthorpe', 'Tara', 'Warwick', 'Texas']
  },
  R06: {
    code: 'R06',
    name: 'RER',
    fullName: 'R06 - RER',
    areas: ['Emerald', 'Rockhampton', 'Roma']
  },
  R07: {
    code: 'R07',
    name: 'GPM', 
    fullName: 'R07 - GPM',
    areas: ['Grafton', 'Port Macquarie', 'Coffs Harbour']
  },
  R08: {
    code: 'R08',
    name: 'GA',
    fullName: 'R08 - GA',
    areas: ['Tamworth', 'Armidale', 'Glen Innes']
  },
  R09: {
    code: 'R09',
    name: 'NR',
    fullName: 'R09 - NR', 
    areas: [
      'Aberglasslyn / Rutherford/ Maitland',
      'Newcastle / Mereweather / Gwandalan', 
      'Port Stephens',
      'Newcastle',
      'Maitland', 
      'Cessnock',
      'Lake Macquarie',
      'Central Coast'
    ]
  }
};

// Legacy region mappings (for backwards compatibility)
export const LEGACY_REGIONS = {
  R1: 'R01',
  R2: 'R02', 
  R3: 'R03',
  R4: 'R04',
  R5: 'R05'
};

// Helper functions
export const getRegionByCode = (code) => {
  // Handle legacy codes
  const normalizedCode = LEGACY_REGIONS[code] || code;
  return REGIONS[normalizedCode];
};

export const getRegionFullName = (code) => {
  const region = getRegionByCode(code);
  return region ? region.fullName : code;
};

export const getRegionAreas = (code) => {
  const region = getRegionByCode(code);
  return region ? region.areas : [];
};

export const getAllRegions = () => {
  return Object.values(REGIONS);
};

export const getRegionsForSelect = () => {
  return Object.values(REGIONS).map(region => ({
    value: region.code,
    label: region.fullName,
    areas: region.areas
  }));
};

// Find which region a location belongs to
export const findRegionForLocation = (location) => {
  const locationLower = location.toLowerCase();
  
  for (const region of Object.values(REGIONS)) {
    const matchingArea = region.areas.find(area => 
      area.toLowerCase().includes(locationLower) || 
      locationLower.includes(area.toLowerCase())
    );
    
    if (matchingArea) {
      return {
        region: region,
        area: matchingArea
      };
    }
  }
  
  return null;
};

// Normalize region codes (convert R1 -> R01, etc.)
export const normalizeRegionCode = (code) => {
  if (!code) return '';
  
  // Handle legacy single digit codes
  if (code.match(/^R\d$/)) {
    return code.replace('R', 'R0');
  }
  
  return code;
};