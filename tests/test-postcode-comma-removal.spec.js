import { test, expect } from '@playwright/test';

test('Test Postcode Comma Removal', async ({ page }) => {
  console.log('🧪 Testing postcode comma removal');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  // Test CSV lookup to verify postcodes no longer have commas
  const testResults = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      
      // Test addresses that have commas in the CSV
      const testAddresses = [
        'Gwandalan NSW 2259',     // Should be "2,259" in CSV
        'Belmont NSW 2280',       // Should be "2,280" in CSV
        'Emerald QLD 4720'        // Should be "4,720" in CSV
      ];
      
      const results = [];
      
      for (const address of testAddresses) {
        console.log(`Testing: ${address}`);
        const data = await csvModule.default.lookupByAddress(address);
        
        if (data && data.length > 0) {
          const result = data[0];
          console.log(`  Suburb: ${result.suburb}`);
          console.log(`  Raw postcode: "${result.postcode}"`);
          console.log(`  Has comma: ${result.postcode.includes(',')}`);
          
          results.push({
            address,
            suburb: result.suburb,
            postcode: result.postcode,
            hasComma: result.postcode.includes(','),
            hasQuotes: result.postcode.includes('"')
          });
        } else {
          console.log(`  No results found`);
          results.push({
            address,
            error: 'No results found'
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Test failed:', error);
      return { error: error.message };
    }
  });
  
  console.log('Test results:', JSON.stringify(testResults, null, 2));
  
  // Check results
  let allGood = true;
  if (Array.isArray(testResults)) {
    testResults.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.address}: ${result.error}`);
        allGood = false;
      } else if (result.hasComma) {
        console.log(`❌ ${result.address}: Postcode still has comma: "${result.postcode}"`);
        allGood = false;
      } else if (result.hasQuotes) {
        console.log(`❌ ${result.address}: Postcode still has quotes: "${result.postcode}"`);
        allGood = false;
      } else {
        console.log(`✅ ${result.address}: Postcode clean: "${result.postcode}"`);
      }
    });
  } else {
    console.log('❌ Test failed with error:', testResults.error);
    allGood = false;
  }
  
  if (allGood) {
    console.log('🎉 SUCCESS: All postcodes are now clean (no commas or quotes)');
  } else {
    console.log('❌ FAILED: Some postcodes still have formatting issues');
  }
});