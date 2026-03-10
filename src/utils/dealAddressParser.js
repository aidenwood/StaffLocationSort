// Deal Address Parser Utility
// Extracts addresses from Pipedrive deal titles for geocoding and distance calculations

/**
 * Parse address from deal title
 * Handles formats like:
 * - "Donna Lewis- 5-7 Penelope Drive, Cornubia QLD, Australia"
 * - "Dean Leibbrandt - 136-138 Carbrook Rd, Cornubia QLD, Australia"
 * - "John Smith - Unit 3/45 Main Street, Brisbane QLD 4000"
 * @param {string} title - Deal title containing name and address
 * @returns {Object|null} - { name, address } or null if parsing fails
 */
export const parseDealAddress = (title) => {
  if (!title || typeof title !== 'string') {
    return null;
  }

  // Clean up the title
  const cleanTitle = title.trim();
  
  // Look for pattern: "Name - Address" or "Name- Address"
  const dashMatch = cleanTitle.match(/^(.+?)\s*-\s*(.+)$/);
  
  if (!dashMatch) {
    return null;
  }

  const [, namepart, addressPart] = dashMatch;
  const name = namepart.trim();
  const rawAddress = addressPart.trim();

  // Validate that this looks like an address
  if (!isValidAddress(rawAddress)) {
    return null;
  }

  // Clean up the address
  const address = cleanAddress(rawAddress);
  
  return {
    name,
    address,
    original: title
  };
};

/**
 * Validate if a string looks like a valid address
 * @param {string} address - Address string to validate
 * @returns {boolean}
 */
const isValidAddress = (address) => {
  if (!address || address.length < 10) {
    return false;
  }

  // Must contain some address indicators
  const addressPatterns = [
    /\d+.*(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|way|crescent|cres|boulevard|blvd)/i,
    /(?:unit|apartment|apt|flat|shop|suite)\s*\d+/i,
    /\d+\/\d+/i, // Unit numbers like "3/45"
    /\d+\s*-\s*\d+/i, // Range numbers like "5-7"
  ];

  const hasAddressPattern = addressPatterns.some(pattern => pattern.test(address));
  
  // Must contain Australian state or postcode
  const hasAustralianLocation = /\b(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT|Queensland|New South Wales|Victoria|South Australia|Western Australia|Tasmania|Northern Territory|Australian Capital Territory)\b/i.test(address) ||
                               /\b\d{4}\b/.test(address); // 4-digit postcode

  return hasAddressPattern && hasAustralianLocation;
};

/**
 * Clean and standardize address format
 * @param {string} address - Raw address string
 * @returns {string} - Cleaned address
 */
const cleanAddress = (address) => {
  return address
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Ensure proper spacing around commas
    .replace(/\s*,\s*/g, ', ')
    // Remove trailing comma/punctuation
    .replace(/[,.]$/, '')
    .trim();
};

/**
 * Extract multiple addresses from an array of deal titles
 * @param {Array} deals - Array of deal objects with titles
 * @returns {Array} - Array of deals with parsed addresses
 */
export const parseMultipleDealAddresses = (deals) => {
  if (!Array.isArray(deals)) {
    return [];
  }

  return deals.map(deal => {
    if (!deal || !deal.title) {
      return { ...deal, parsedAddress: null };
    }

    const parsed = parseDealAddress(deal.title);
    return {
      ...deal,
      parsedAddress: parsed
    };
  });
};

/**
 * Get statistics about address parsing success
 * @param {Array} deals - Array of deals with parsed addresses
 * @returns {Object} - Statistics object
 */
export const getParsingStats = (deals) => {
  const total = deals.length;
  const successful = deals.filter(d => d.parsedAddress).length;
  const failed = total - successful;
  
  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0
  };
};

/**
 * Validate parsed address format for debugging
 * @param {string} title - Deal title to test
 * @returns {Object} - Debug information
 */
export const debugAddressParsing = (title) => {
  const result = {
    title,
    parsed: parseDealAddress(title),
    validations: {}
  };

  if (title) {
    const dashMatch = title.match(/^(.+?)\s*-\s*(.+)$/);
    result.validations.hasDash = !!dashMatch;
    
    if (dashMatch) {
      const [, , addressPart] = dashMatch;
      result.validations.addressPart = addressPart;
      result.validations.isValidAddress = isValidAddress(addressPart);
    }
  }

  return result;
};

export default {
  parseDealAddress,
  parseMultipleDealAddresses,
  getParsingStats,
  debugAddressParsing
};