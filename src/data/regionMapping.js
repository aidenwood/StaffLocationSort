/**
 * Pipedrive Label ID to Region Mapping
 * Generated from: label-number-codes.csv
 * 
 * This maps the 3-digit numeric label codes from Pipedrive
 * to standardized region names for the availability grid.
 */

export const PIPEDRIVE_LABEL_TO_REGION = {
  // Queensland Regions
  '54': 'Brisbane/Logan/Ipswich/Gold Coast',  // Brisbane / Logan / Ipswich / Gold Coast - QLD
  '68': 'Sunshine Coast',                      // SUNSHINE COAST - QLD  
  '89': 'Rockhampton',                         // Rockhampton, Yeppoon - QLD
  '99': 'Biloela',                             // Biloela - QLD
  '103': 'Gladstone',                          // GLADSTONE REGION - QLD
  '171': 'Maryborough',                        // Maryborough - QLD
  '218': 'Warwick',                            // WARWICK - QLD
  '224': 'Oakey',                              // Oakey / Crowsnest / Kilcoy - QLD
  '225': 'Toowoomba',                          // Toowoomba - QLD
  '288': 'Gympie',                             // Gympie - QLD
  '293': 'Beaudesert',                         // Beaudesert - QLD
  '320': 'Roma',                               // Roma - QLD
  '322': 'Moreton Region',                     // Moreton Region (Wamuran, Bracalba) - QLD
  '338': 'Gatton',                             // Gatton - QLD
  '341': 'Burpengary/Caboolture',             // Burpengary/ DayB / Narangba / Caboolture - QLD
  '343': 'Tara',                               // Tara - QLD
  '471': 'Stanthorpe',                         // Stanthorpe - QLD
  '475': 'Goondiwindi',                        // Goondiwindi - QLD
  '485': 'Bell',                               // Bell - QLD
  '513': 'Toobeah',                           // Toobeah - QLD
  '562': 'Emerald',                            // Emerald - QLD
  '568': 'Kingaroy',                           // KINGAROY - QLD
  '790': 'Texas',                              // TEXAS - QLD
  '968': 'Brisbane',                           // Brisbane - QLD
  '969': 'Ipswich',                            // Ipswich - QLD
  '970': 'Gold Coast/Logan',                   // Gold Coast / Logan - QLD

  // New South Wales Regions  
  '50': 'Northern NSW',                        // Northern NSW
  '94': 'Coffs Harbour',                       // Coffs Harbour - NSW
  '165': 'NSW Other',                          // NSW Other
  '172': 'Port Macquarie',                     // Port Macquarie - NSW
  '229': 'Newcastle',                          // Newcastle / Mereweather / Gwandalan - NSW
  '342': 'Aberglasslyn/Maitland',             // Aberglasslyn / Rutherford/ Maitland - NSW
  '390': 'Grenfell',                           // Grenfell - NSW
  '416': 'Cowra',                              // COWRA - NSW
  '486': 'Dubbo',                              // Dubbo - NSW
  '570': 'Glen Innes',                         // GLEN INNES - NSW ⭐ This is the one we've been seeing!
  '573': 'Grafton',                            // Grafton - NSW
  '578': 'Armidale',                           // ARMIDALE - NSW
  '636': 'Harden'                              // Harden - NSW
};

/**
 * Simplified region groupings for grid display
 * Maps detailed regions to broader categories for consistency
 */
export const REGION_GROUPINGS = {
  // Brisbane Metro
  'Brisbane/Logan/Ipswich/Gold Coast': 'Brisbane Metro',
  'Brisbane': 'Brisbane Metro',
  'Ipswich': 'Brisbane Metro', 
  'Gold Coast/Logan': 'Brisbane Metro',
  'Logan': 'Brisbane Metro',
  'Beaudesert': 'Brisbane Metro',
  'Gatton': 'Brisbane Metro',
  'Moreton Region': 'Brisbane Metro',
  'Burpengary/Caboolture': 'Brisbane Metro',

  // Regional QLD
  'Sunshine Coast': 'Sunshine Coast',
  'Toowoomba': 'Toowoomba',
  'Gympie': 'Regional QLD',
  'Maryborough': 'Regional QLD',
  'Warwick': 'Toowoomba',
  'Stanthorpe': 'Toowoomba',
  'Roma': 'Regional QLD',
  'Kingaroy': 'Regional QLD',
  'Emerald': 'Regional QLD',
  'Rockhampton': 'Regional QLD',
  'Gladstone': 'Regional QLD',
  'Biloela': 'Regional QLD',

  // NSW
  'Glen Innes': 'Regional East',
  'Armidale': 'Regional East', 
  'Grafton': 'Regional East',
  'Coffs Harbour': 'Regional East',
  'Newcastle': 'Newcastle Region',
  'Aberglasslyn/Maitland': 'Newcastle Region',
  'Port Macquarie': 'Regional East',
  'Northern NSW': 'Regional East',
  'NSW Other': 'Regional East',
  'Dubbo': 'Regional NSW',
  'Cowra': 'Regional NSW',
  'Grenfell': 'Regional NSW',
  'Harden': 'Regional NSW'
};

/**
 * Get region name from Pipedrive label ID
 * @param {string|number} labelId - The Pipedrive label ID
 * @returns {string} Region name or null if not found
 */
export function getRegionFromLabel(labelId) {
  const id = String(labelId);
  const region = PIPEDRIVE_LABEL_TO_REGION[id];
  
  if (region) {
    // Return the grouped region for consistency
    return REGION_GROUPINGS[region] || region;
  }
  
  return null;
}

/**
 * Get all possible region names (for validation/debugging)
 */
export function getAllRegions() {
  const allRegions = new Set();
  
  // Add direct mappings
  Object.values(PIPEDRIVE_LABEL_TO_REGION).forEach(region => {
    allRegions.add(region);
  });
  
  // Add grouped regions  
  Object.values(REGION_GROUPINGS).forEach(region => {
    allRegions.add(region);
  });
  
  return Array.from(allRegions).sort();
}

export default {
  PIPEDRIVE_LABEL_TO_REGION,
  REGION_GROUPINGS,
  getRegionFromLabel,
  getAllRegions
};