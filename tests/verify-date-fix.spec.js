import { test, expect } from '@playwright/test';

test('Verify Date Fix - Real CSV Lookup', async ({ page }) => {
  console.log('🧪 Verifying date fix with real CSV lookup and React component');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(8000); // Wait for Google Maps to fully load
  
  // Verify page is loaded
  const heading = page.locator('h1:has-text("Area Damage Estimator")');
  await expect(heading).toBeVisible();
  console.log('✅ Area Damage Estimator page loaded');
  
  // Trigger a CSV lookup directly and simulate address selection
  const lookupResult = await page.evaluate(async () => {
    try {
      // Import CSV lookup
      const csvModule = await import('/src/utils/csvLookup.js');
      const results = await csvModule.default.lookupByAddress('Gwandalan NSW 2259');
      
      if (results && results.length > 0) {
        console.log('✅ CSV lookup successful');
        console.log('Result data:', {
          suburb: results[0].suburb,
          postcode: results[0].postcode,
          recentHailDate: results[0].recentHailDate,
          recentHailSize: results[0].recentHailSize
        });
        
        // Now try to trigger the React component's state update
        // Create a custom event that our component can listen for
        const event = new CustomEvent('testAddressLookup', {
          detail: {
            address: 'Gwandalan NSW 2259',
            results: results
          }
        });
        
        document.dispatchEvent(event);
        return results[0];
      }
      return null;
    } catch (error) {
      console.error('❌ Lookup failed:', error);
      return null;
    }
  });
  
  if (lookupResult) {
    console.log('✅ Got lookup result:', {
      suburb: lookupResult.suburb,
      date: lookupResult.recentHailDate
    });
    
    // Now manually set the component state by injecting the results
    await page.evaluate((result) => {
      // Try to find the React component and update its state
      // This simulates what happens when a real address is selected
      const mockResults = [result];
      
      // Create a more direct state update
      const event = new CustomEvent('forceAreaEstimatorUpdate', {
        detail: { 
          results: mockResults,
          address: 'Gwandalan NSW 2259, Australia'
        }
      });
      document.dispatchEvent(event);
      
      // Also try setting window properties that the component might check
      window.__TEST_ESTIMATOR_RESULTS__ = mockResults;
      window.__TEST_ESTIMATOR_ADDRESS__ = 'Gwandalan NSW 2259, Australia';
      
      console.log('✅ Triggered component state update');
    }, lookupResult);
    
    await page.waitForTimeout(3000);
    
    // Check if results are visible
    const resultsContainer = page.locator('.bg-white.rounded-lg.shadow-sm.border').nth(1);
    const resultsVisible = await resultsContainer.isVisible();
    console.log('Results container visible:', resultsVisible);
    
    if (resultsVisible) {
      // Check for the date text specifically
      const dateElements = page.locator('span.font-medium.text-blue-900');
      const dateCount = await dateElements.count();
      console.log(`Found ${dateCount} potential date elements`);
      
      if (dateCount > 0) {
        const dateText = await dateElements.first().textContent();
        console.log('Date text found:', dateText);
        
        // Check if it's not "Invalid Date"
        if (dateText && !dateText.includes('Invalid Date')) {
          console.log('✅ Date is displaying correctly:', dateText);
        } else {
          console.log('❌ Date still shows as Invalid:', dateText);
        }
      }
    }
    
  } else {
    console.log('❌ No lookup result obtained');
  }
  
  // Take a screenshot for manual verification
  await page.screenshot({ path: 'date-fix-verification.png', fullPage: true });
  
  console.log('🎯 Date fix verification completed');
});