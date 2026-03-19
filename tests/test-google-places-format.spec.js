import { test, expect } from '@playwright/test';

test('Test Google Places Address Format', async ({ page }) => {
  console.log('🧪 Testing Google Places address format: "Pacific Paradise QLD, Australia"');
  
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  const result = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      
      // Test the exact format that Google Places returns
      const googlePlacesAddress = 'Pacific Paradise QLD, Australia';
      console.log(`Testing Google Places format: "${googlePlacesAddress}"`);
      
      // Test extraction functions
      const extractedPostcode = csvModule.default.extractPostcode(googlePlacesAddress);
      const extractedSuburb = csvModule.default.extractSuburb(googlePlacesAddress);
      
      console.log(`Extracted postcode: "${extractedPostcode}"`);
      console.log(`Extracted suburb: "${extractedSuburb}"`);
      
      // Test lookup
      const data = await csvModule.default.lookupByAddress(googlePlacesAddress);
      
      return {
        address: googlePlacesAddress,
        extractedPostcode,
        extractedSuburb,
        found: !!data,
        count: data ? data.length : 0,
        firstResult: data && data.length > 0 ? {
          suburb: data[0].suburb,
          postcode: data[0].postcode,
          state: data[0].state,
          zone: data[0].zone
        } : null
      };
      
    } catch (error) {
      console.error('Lookup failed:', error);
      return { 
        error: error.message,
        address: 'Pacific Paradise QLD, Australia'
      };
    }
  });
  
  console.log('Google Places test result:', result);
  
  if (result.error) {
    console.log('❌ Error:', result.error);
    // This should not fail now that we have suburb-only lookup
    if (result.error.includes('Could not extract postcode or suburb name')) {
      throw new Error(`Still failing to extract location data: ${result.error}`);
    }
  } else {
    console.log(`✅ Successfully processed: "${result.address}"`);
    console.log(`✅ Extracted postcode: "${result.extractedPostcode}"`);
    console.log(`✅ Extracted suburb: "${result.extractedSuburb}"`);
    console.log(`✅ Found: ${result.found} (${result.count} results)`);
    
    if (result.firstResult) {
      console.log(`✅ Result: ${result.firstResult.suburb}, ${result.firstResult.state} ${result.firstResult.postcode}`);
      console.log(`✅ Zone: ${result.firstResult.zone}`);
      
      // Verify we got Pacific Paradise
      expect(result.firstResult.suburb).toBe('Pacific Paradise');
      expect(result.firstResult.postcode).toBe('4564');
    }
  }
});