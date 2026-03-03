// Phone number validation and normalization utilities

// Australian phone number patterns
const PHONE_PATTERNS = {
  // Mobile: 04xx xxx xxx
  mobile: /^(\+61\s?)?0?4\d{2}[\s\-]?\d{3}[\s\-]?\d{3}$/,
  // Landline: (0x) xxxx xxxx or 0x xxxx xxxx
  landline: /^(\+61\s?)?0?[2-8]\d{1}[\s\-]?\d{4}[\s\-]?\d{4}$/,
  // International format: +61 4xx xxx xxx
  international: /^\+61\s?4\d{2}[\s\-]?\d{3}[\s\-]?\d{3}$/
};

/**
 * Normalize phone number to consistent format for searching
 * @param {string} phoneNumber - Raw phone number input
 * @returns {string} Normalized phone number
 */
export function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Handle international format
  if (cleaned.startsWith('+61')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  // Handle cases where leading 0 is missing for mobile
  if (cleaned.length === 9 && cleaned.startsWith('4')) {
    cleaned = '0' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format phone number for display
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Mobile format: 0XXX XXX XXX
  if (normalized.length === 10 && normalized.startsWith('04')) {
    return `${normalized.substring(0, 4)} ${normalized.substring(4, 7)} ${normalized.substring(7)}`;
  }
  
  // Landline format: (0X) XXXX XXXX
  if (normalized.length === 10 && !normalized.startsWith('04')) {
    return `(${normalized.substring(0, 2)}) ${normalized.substring(2, 6)} ${normalized.substring(6)}`;
  }
  
  return normalized;
}

/**
 * Validate Australian phone number
 * @param {string} phoneNumber - Phone number to validate
 * @returns {object} Validation result
 */
export function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      type: null,
      message: 'Phone number is required'
    };
  }
  
  const trimmed = phoneNumber.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      type: null,
      message: 'Phone number cannot be empty'
    };
  }
  
  // Check mobile pattern
  if (PHONE_PATTERNS.mobile.test(trimmed)) {
    return {
      isValid: true,
      type: 'mobile',
      message: 'Valid mobile number',
      normalized: normalizePhoneNumber(trimmed),
      formatted: formatPhoneNumber(trimmed)
    };
  }
  
  // Check landline pattern
  if (PHONE_PATTERNS.landline.test(trimmed)) {
    return {
      isValid: true,
      type: 'landline', 
      message: 'Valid landline number',
      normalized: normalizePhoneNumber(trimmed),
      formatted: formatPhoneNumber(trimmed)
    };
  }
  
  // Check international pattern
  if (PHONE_PATTERNS.international.test(trimmed)) {
    return {
      isValid: true,
      type: 'international',
      message: 'Valid international number',
      normalized: normalizePhoneNumber(trimmed),
      formatted: formatPhoneNumber(trimmed)
    };
  }
  
  return {
    isValid: false,
    type: null,
    message: 'Invalid Australian phone number format. Please use formats like: 0400 000 000, (02) 0000 0000, or +61 400 000 000'
  };
}

/**
 * Get multiple search variations of a phone number for Pipedrive search
 * @param {string} phoneNumber - Phone number to get variations for
 * @returns {string[]} Array of phone number variations to search
 */
export function getPhoneSearchVariations(phoneNumber) {
  if (!phoneNumber) return [];
  
  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.isValid) return [];
  
  const normalized = validation.normalized;
  const variations = new Set();
  
  // Add normalized version
  variations.add(normalized);
  
  // Add formatted version
  variations.add(validation.formatted);
  
  // Add version without spaces
  variations.add(normalized.replace(/\s/g, ''));
  
  // Add international format for mobile numbers
  if (validation.type === 'mobile' && normalized.startsWith('04')) {
    const international = '+61 ' + normalized.substring(1);
    variations.add(international);
    variations.add(international.replace(/\s/g, ''));
  }
  
  // Add format with dashes
  if (normalized.length === 10 && normalized.startsWith('04')) {
    variations.add(`${normalized.substring(0, 4)}-${normalized.substring(4, 7)}-${normalized.substring(7)}`);
  }
  
  // Add bracketed format for landlines
  if (validation.type === 'landline') {
    variations.add(`(${normalized.substring(0, 2)}) ${normalized.substring(2, 6)} ${normalized.substring(6)}`);
  }
  
  return Array.from(variations);
}