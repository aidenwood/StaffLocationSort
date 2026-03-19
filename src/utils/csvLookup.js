import { parse } from 'papaparse';

// CSV data loader - only loads when needed, not exposed to frontend
class CSVLookup {
  constructor() {
    this.data = null;
    this.isLoading = false;
  }

  async loadCSVData() {
    if (this.data || this.isLoading) return this.data;
    
    this.isLoading = true;
    try {
      // In production, this would be a server endpoint
      // For now, we'll load from the public folder
      const response = await fetch('/SuburbZoneAnalysis-V2.csv');
      const csvText = await response.text();
      
      const result = parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      this.data = result.data;
      return this.data;
    } catch (error) {
      console.error('Failed to load CSV data:', error);
      throw new Error('Area damage data unavailable');
    } finally {
      this.isLoading = false;
    }
  }

  // Extract postcode from various address formats
  extractPostcode(address) {
    if (!address) return null;
    
    // Australian postcode patterns
    const patterns = [
      /\b(\d{4})\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i,
      /\b(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})\b/i,
      /\b(\d{4})\s*$/,
      /,\s*(\d{4})(?:\s|$)/
    ];

    for (const pattern of patterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  // Lookup area data by postcode
  async lookupByPostcode(postcode) {
    const data = await this.loadCSVData();
    if (!data) return null;

    const postcodeStr = postcode.toString();
    
    // Find all rows matching the postcode
    const matches = data.filter(row => {
      const rowPostcode = row.Postcode?.toString();
      return rowPostcode === postcodeStr;
    });

    if (matches.length === 0) {
      return null;
    }

    // Return sanitized data - only safe fields for frontend
    return matches.map(row => ({
      suburb: row.Suburb,
      postcode: row.Postcode,
      state: row.State,
      zone: row.Zone,
      odds: row.Odds,
      dataConfidence: row['Data Confidence'],
      // Include all hail storm data
      storms: this.processStormData(row),
      // Risk indicators without revealing sensitive business data
      riskLevel: this.calculateRiskLevel(row),
      recommendation: this.getRecommendation(row.Zone),
      // Area data for progress bars
      claimsLodged: parseInt(row['Claims Lodged']) || 0,
      minorDamage: parseInt(row['Minor Dmg']) || 0,
      noDamage: parseInt(row['No Dmg']) || 0,
      totalVolume: parseInt(row['Total Volume']) || 0,
      claimsPercent: parseFloat(row['Lodge %']?.replace('%', '')) || 0,
      minorPercent: parseFloat(row['Minor Dmg %']?.replace('%', '')) || 0,
      noDamagePercent: parseFloat(row['No Dmg %']?.replace('%', '')) || 0
    }));
  }

  // Extract suburb name from address
  extractSuburb(address) {
    if (!address) return null;
    
    // Try to extract suburb name from various formats
    // e.g. "Emerald QLD 4720" -> "Emerald"
    // e.g. "123 Main St, Emerald QLD 4720" -> "Emerald"
    const patterns = [
      /([A-Za-z\s]+),?\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}/i, // "Suburb, STATE 1234"
      /,\s*([A-Za-z\s]+)\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)/i,        // ", Suburb STATE"
      /([A-Za-z\s]+)\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)/i,            // "Suburb STATE"
      /([A-Za-z\s]+)\s+\d{4}/i,                                       // "Suburb 1234" (no state)
      /^([A-Za-z\s]+)$/                                               // "Suburb" (just suburb name)
    ];
    
    for (const pattern of patterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  // Lookup by suburb and postcode (exact match)
  async lookupBySuburbAndPostcode(suburb, postcode) {
    const data = await this.loadCSVData();
    if (!data) return null;

    const postcodeStr = postcode.toString();
    const suburbLower = suburb.toLowerCase().trim();
    
    // Find exact suburb and postcode matches
    const matches = data.filter(row => {
      const rowPostcode = row.Postcode?.toString();
      const rowSuburb = row.Suburb?.toLowerCase().trim();
      return rowPostcode === postcodeStr && rowSuburb === suburbLower;
    });

    if (matches.length === 0) {
      return null;
    }

    // Return sanitized data - only safe fields for frontend
    return matches.map(row => ({
      suburb: row.Suburb,
      postcode: row.Postcode,
      state: row.State,
      zone: row.Zone,
      odds: row.Odds,
      dataConfidence: row['Data Confidence'],
      // Include all hail storm data
      storms: this.processStormData(row),
      // Risk indicators without revealing sensitive business data
      riskLevel: this.calculateRiskLevel(row),
      recommendation: this.getRecommendation(row.Zone),
      // Area data for progress bars
      claimsLodged: parseInt(row['Claims Lodged']) || 0,
      minorDamage: parseInt(row['Minor Dmg']) || 0,
      noDamage: parseInt(row['No Dmg']) || 0,
      totalVolume: parseInt(row['Total Volume']) || 0,
      claimsPercent: parseFloat(row['Lodge %']?.replace('%', '')) || 0,
      minorPercent: parseFloat(row['Minor Dmg %']?.replace('%', '')) || 0,
      noDamagePercent: parseFloat(row['No Dmg %']?.replace('%', '')) || 0
    }));
  }

  // Lookup by address (extracts suburb and postcode for exact match)
  async lookupByAddress(address) {
    const postcode = this.extractPostcode(address);
    const suburb = this.extractSuburb(address);
    
    // Case 1: We have both suburb and postcode - try exact match first
    if (postcode && suburb) {
      console.log(`🔍 Looking up exact match: ${suburb} ${postcode}`);
      const exactMatch = await this.lookupBySuburbAndPostcode(suburb, postcode);
      if (exactMatch && exactMatch.length > 0) {
        return exactMatch;
      }
      console.log(`⚠️ No exact match found for ${suburb} ${postcode}, trying postcode only`);
      
      // Fallback to postcode-only lookup
      console.log(`🔍 Looking up by postcode only: ${postcode}`);
      return await this.lookupByPostcode(postcode);
    }
    
    // Case 2: We only have postcode - lookup by postcode
    if (postcode) {
      console.log(`🔍 Looking up by postcode only: ${postcode}`);
      return await this.lookupByPostcode(postcode);
    }
    
    // Case 3: We only have suburb name - try fuzzy search
    if (suburb) {
      console.log(`🔍 Looking up by suburb name only: ${suburb}`);
      return await this.lookupBySuburbName(suburb);
    }
    
    // Case 4: No identifiable location information
    throw new Error('Could not extract postcode or suburb name from address');
  }

  // Lookup by suburb name only (fuzzy search)
  async lookupBySuburbName(suburbName) {
    const data = await this.loadCSVData();
    if (!data) return null;

    const suburbLower = suburbName.toLowerCase().trim();
    
    // Find suburbs that match the name (case-insensitive)
    const matches = data.filter(row => {
      const rowSuburb = row.Suburb?.toLowerCase().trim();
      return rowSuburb === suburbLower;
    });

    if (matches.length === 0) {
      // Try partial match if exact match fails
      const partialMatches = data.filter(row => {
        const rowSuburb = row.Suburb?.toLowerCase().trim();
        return rowSuburb && (rowSuburb.includes(suburbLower) || suburbLower.includes(rowSuburb));
      });
      
      if (partialMatches.length === 0) {
        return null;
      }
      
      console.log(`🔍 Found ${partialMatches.length} partial matches for "${suburbName}"`);
      return partialMatches.map(row => ({
        suburb: row.Suburb,
        postcode: row.Postcode,
        state: row.State,
        zone: row.Zone,
        odds: row.Odds,
        dataConfidence: row['Data Confidence'],
        // Include all hail storm data
        storms: this.processStormData(row),
        // Risk indicators without revealing sensitive business data
        riskLevel: this.calculateRiskLevel(row),
        recommendation: this.getRecommendation(row.Zone)
      }));
    }

    console.log(`🔍 Found ${matches.length} exact matches for "${suburbName}"`);
    
    // Return sanitized data - only safe fields for frontend
    return matches.map(row => ({
      suburb: row.Suburb,
      postcode: row.Postcode,
      state: row.State,
      zone: row.Zone,
      odds: row.Odds,
      dataConfidence: row['Data Confidence'],
      // Include all hail storm data
      storms: this.processStormData(row),
      // Risk indicators without revealing sensitive business data
      riskLevel: this.calculateRiskLevel(row),
      recommendation: this.getRecommendation(row.Zone),
      // Area data for progress bars
      claimsLodged: parseInt(row['Claims Lodged']) || 0,
      minorDamage: parseInt(row['Minor Dmg']) || 0,
      noDamage: parseInt(row['No Dmg']) || 0,
      totalVolume: parseInt(row['Total Volume']) || 0,
      claimsPercent: parseFloat(row['Lodge %']?.replace('%', '')) || 0,
      minorPercent: parseFloat(row['Minor Dmg %']?.replace('%', '')) || 0,
      noDamagePercent: parseFloat(row['No Dmg %']?.replace('%', '')) || 0
    }));
  }

  // Calculate risk level based on various factors
  calculateRiskLevel(row) {
    const zone = row.Zone?.toUpperCase();
    const odds = row.Odds;
    
    if (zone === 'KEEP AWAY') return 'HIGH';
    if (zone === 'ON THE FENCE') return 'MEDIUM';
    if (zone === 'GO' || zone === 'WORTH IT') return 'LOW';
    
    // Fallback to odds-based assessment
    if (odds?.includes('1 in 3') || odds?.includes('1 in 4')) return 'LOW';
    if (odds?.includes('1 in 5') || odds?.includes('1 in 6')) return 'MEDIUM';
    return 'HIGH';
  }

  // Get recommendation text
  getRecommendation(zone) {
    switch (zone?.toUpperCase()) {
      case 'GO':
        return 'Recommended for assessment';
      case 'WORTH IT':
        return 'Good opportunity area';
      case 'ON THE FENCE':
        return 'Proceed with caution';
      case 'KEEP AWAY':
        return 'High risk area - avoid';
      default:
        return 'Assessment required';
    }
  }

  // Process all storm data and sort by date (newest first)
  processStormData(row) {
    const storms = [];
    
    // Process each storm (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      const date = row[`Date - Hail Storm ${i}`];
      const size = row[`Hail Size - Hail Storm ${i}`];
      const coverage = row[`% of Suburb Hit - Hail Storm ${i}`];
      
      if (date && date.trim()) {
        storms.push({
          date: date.trim(),
          size: size?.trim() || 'Unknown',
          coverage: coverage?.trim() || 'Unknown'
        });
      }
    }
    
    // Sort by date (newest first)
    storms.sort((a, b) => {
      // Parse DD/MM/YYYY dates for sorting
      const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(0);
      };
      
      return parseDate(b.date) - parseDate(a.date);
    });
    
    return storms;
  }
}

// Singleton instance
const csvLookup = new CSVLookup();

export default csvLookup;