import { test, expect } from '@playwright/test';

test('CSV Lookup Diagnosis - Test Emerald and Exact Matching', async ({ page }) => {
  // Set up console logging to see our debug messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🔍') || text.includes('⚠️') || text.includes('✅') || text.includes('❌')) {
      console.log(`📝 ${text}`);
    }
  });

  console.log('🧪 Testing CSV lookup fixes for Emerald and exact matching');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  // Test 1: Emerald QLD (should find exact match)
  console.log('\n🔍 TEST 1: Emerald QLD 4720 (exact match test)');
  
  await page.evaluate(async () => {
    try {
      const csvLookup = (await import('/src/utils/csvLookup.js')).default;
      const results = await csvLookup.lookupByAddress('Emerald QLD 4720');
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} result(s) for Emerald QLD`);
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.suburb}, ${result.state} ${result.postcode} - ${result.zone}`);
        });
      } else {
        console.log('❌ No results found for Emerald QLD 4720');
      }
    } catch (error) {
      console.error('❌ Emerald QLD lookup failed:', error.message);
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Test 2: Emerald Beach NSW (should find exact match)
  console.log('\n🔍 TEST 2: Emerald Beach NSW 2456 (exact match test)');
  
  await page.evaluate(async () => {
    try {
      const csvLookup = (await import('/src/utils/csvLookup.js')).default;
      const results = await csvLookup.lookupByAddress('Emerald Beach NSW 2456');
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} result(s) for Emerald Beach NSW`);
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.suburb}, ${result.state} ${result.postcode} - ${result.zone}`);
        });
      } else {
        console.log('❌ No results found for Emerald Beach NSW 2456');
      }
    } catch (error) {
      console.error('❌ Emerald Beach NSW lookup failed:', error.message);
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Test 3: Test postcode with multiple suburbs (should show exact match only when suburb specified)
  console.log('\n🔍 TEST 3: Belmont NSW 2280 (exact match vs postcode match)');
  
  await page.evaluate(async () => {
    try {
      const csvLookup = (await import('/src/utils/csvLookup.js')).default;
      
      // Test exact suburb match
      console.log('Testing exact suburb match: Belmont NSW 2280');
      const exactResults = await csvLookup.lookupByAddress('Belmont NSW 2280');
      if (exactResults) {
        console.log(`✅ Exact match found ${exactResults.length} result(s):`);
        exactResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.suburb}, ${result.state} ${result.postcode}`);
        });
      }
      
      // Test postcode-only match
      console.log('Testing postcode-only match: 2280');
      const postcodeResults = await csvLookup.lookupByPostcode('2280');
      if (postcodeResults) {
        console.log(`✅ Postcode match found ${postcodeResults.length} result(s):`);
        postcodeResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.suburb}, ${result.state} ${result.postcode}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Belmont/2280 lookup failed:', error.message);
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Test 4: Test suburb extraction
  console.log('\n🔍 TEST 4: Suburb extraction testing');
  
  await page.evaluate(async () => {
    try {
      const csvLookup = (await import('/src/utils/csvLookup.js')).default;
      
      const testAddresses = [
        'Emerald QLD 4720',
        'Emerald Beach NSW 2456',
        '123 Main St, Belmont NSW 2280',
        'Belmont, NSW 2280',
        'Toukley NSW 2263'
      ];
      
      testAddresses.forEach(address => {
        const suburb = csvLookup.extractSuburb(address);
        const postcode = csvLookup.extractPostcode(address);
        console.log(`Address: "${address}" → Suburb: "${suburb}", Postcode: "${postcode}"`);
      });
      
    } catch (error) {
      console.error('❌ Suburb extraction test failed:', error.message);
    }
  });
  
  console.log('\n🎯 CSV Lookup Diagnosis Complete');
});