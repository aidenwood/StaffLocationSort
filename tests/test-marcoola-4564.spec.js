import { test, expect } from '@playwright/test';

test('Test Marcoola 4564 - Verify CSV comma fix', async ({ page }) => {
  console.log('🧪 Testing Marcoola QLD 4564 after CSV comma removal');
  
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  const result = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      const data = await csvModule.default.lookupByAddress('Marcoola QLD 4564');
      console.log('Marcoola 4564 lookup result:', data);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Lookup failed:', error);
      return { error: error.message };
    }
  });
  
  console.log('Marcoola result:', result);
  
  if (result && !result.error) {
    console.log(`✅ Found: ${result.suburb}, ${result.state} ${result.postcode}`);
    console.log(`✅ Postcode clean: "${result.postcode}" (no comma: ${!result.postcode.includes(',')})`);
    console.log(`✅ Zone: ${result.zone}`);
    console.log(`✅ Risk Level: ${result.riskLevel}`);
    
    // Verify no comma in postcode
    expect(result.postcode).not.toContain(',');
    expect(result.postcode).toBe('4564');
  } else if (result && result.error) {
    console.log('❌ Error:', result.error);
    throw new Error(`Lookup failed: ${result.error}`);
  } else {
    console.log('❌ No result found for Marcoola QLD 4564');
    throw new Error('No result found for Marcoola QLD 4564');
  }
});