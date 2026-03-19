import { test, expect } from '@playwright/test';

test('Test Pacific Paradise 4564 - Verify V2 CSV', async ({ page }) => {
  console.log('🧪 Testing Pacific Paradise QLD 4564 with V2 CSV');
  
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  const result = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      const data = await csvModule.default.lookupByAddress('Pacific Paradise QLD 4564');
      console.log('Pacific Paradise 4564 lookup result:', data);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Lookup failed:', error);
      return { error: error.message };
    }
  });
  
  console.log('Pacific Paradise result:', result);
  
  if (result && !result.error) {
    console.log(`✅ Found: ${result.suburb}, ${result.state} ${result.postcode}`);
    console.log(`✅ Zone: ${result.zone}`);
    console.log(`✅ Risk Level: ${result.riskLevel}`);
    console.log(`✅ Storms: ${result.storms.length}`);
    
    // Verify postcode is clean
    expect(result.postcode).toBe('4564');
    expect(result.postcode).not.toContain(',');
    
    // Verify zone
    expect(result.zone).toBe('GO');
    
    // Should have storm data
    expect(result.storms).toBeDefined();
    expect(result.storms.length).toBeGreaterThan(0);
  } else if (result && result.error) {
    console.log('❌ Error:', result.error);
    throw new Error(`Lookup failed: ${result.error}`);
  } else {
    console.log('❌ No result found for Pacific Paradise QLD 4564');
    throw new Error('No result found for Pacific Paradise QLD 4564');
  }
});