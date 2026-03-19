import { test, expect } from '@playwright/test';

test('Debug Pacific Paradise Search Issues', async ({ page }) => {
  console.log('🔍 Debugging Pacific Paradise search issues');
  
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  const debugResults = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      
      console.log('🔍 Testing various search terms for Pacific Paradise...');
      
      const testTerms = [
        'Pacific Paradise QLD 4564',
        'Pacific Paradise QLD',
        'Pacific Paradise 4564',
        'Pacific Paradise',
        '4564',
        'pacific paradise qld 4564',
        'PACIFIC PARADISE QLD 4564'
      ];
      
      const results = {};
      
      for (const term of testTerms) {
        console.log(`Testing: "${term}"`);
        try {
          const data = await csvModule.default.lookupByAddress(term);
          results[term] = {
            found: !!data,
            count: data ? data.length : 0,
            firstResult: data && data.length > 0 ? {
              suburb: data[0].suburb,
              postcode: data[0].postcode,
              state: data[0].state
            } : null
          };
          console.log(`  Result: ${results[term].found ? 'FOUND' : 'NOT FOUND'} (${results[term].count} results)`);
        } catch (error) {
          results[term] = {
            error: error.message
          };
          console.log(`  Error: ${error.message}`);
        }
      }
      
      // Test postcode extraction
      console.log('\\n🔍 Testing postcode extraction...');
      const postcodeTests = testTerms.map(term => ({
        term,
        extractedPostcode: csvModule.default.extractPostcode(term)
      }));
      
      // Test suburb extraction  
      console.log('\\n🔍 Testing suburb extraction...');
      const suburbTests = testTerms.map(term => ({
        term,
        extractedSuburb: csvModule.default.extractSuburb(term)
      }));
      
      // Test direct postcode lookup
      console.log('\\n🔍 Testing direct postcode lookup for 4564...');
      const postcodeResult = await csvModule.default.lookupByPostcode('4564');
      const postcodeInfo = {
        found: !!postcodeResult,
        count: postcodeResult ? postcodeResult.length : 0,
        suburbs: postcodeResult ? postcodeResult.map(r => r.suburb) : []
      };
      
      return {
        searchResults: results,
        postcodeTests,
        suburbTests,
        postcodeInfo
      };
      
    } catch (error) {
      console.error('❌ Debug test failed:', error);
      return { error: error.message };
    }
  });
  
  console.log('\\n📊 DEBUG RESULTS:');
  console.log('==================');
  
  if (debugResults.error) {
    console.log('❌ Error:', debugResults.error);
    return;
  }
  
  console.log('\\n🔍 Search Results:');
  Object.entries(debugResults.searchResults).forEach(([term, result]) => {
    if (result.error) {
      console.log(`❌ "${term}": ERROR - ${result.error}`);
    } else if (result.found) {
      console.log(`✅ "${term}": FOUND - ${result.count} result(s)`);
      if (result.firstResult) {
        console.log(`   → ${result.firstResult.suburb}, ${result.firstResult.state} ${result.firstResult.postcode}`);
      }
    } else {
      console.log(`❌ "${term}": NOT FOUND`);
    }
  });
  
  console.log('\\n🔍 Postcode Extraction:');
  debugResults.postcodeTests.forEach(test => {
    console.log(`"${test.term}" → "${test.extractedPostcode}"`);
  });
  
  console.log('\\n🔍 Suburb Extraction:');
  debugResults.suburbTests.forEach(test => {
    console.log(`"${test.term}" → "${test.extractedSuburb}"`);
  });
  
  console.log('\\n🔍 Direct Postcode 4564 Lookup:');
  if (debugResults.postcodeInfo.found) {
    console.log(`✅ Found ${debugResults.postcodeInfo.count} suburb(s) with postcode 4564:`);
    debugResults.postcodeInfo.suburbs.forEach(suburb => {
      console.log(`  • ${suburb}`);
    });
  } else {
    console.log('❌ No suburbs found with postcode 4564');
  }
});