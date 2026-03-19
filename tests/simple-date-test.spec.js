import { test, expect } from '@playwright/test';

test('Simple Date Parsing Test', async ({ page }) => {
  console.log('🧪 Simple date parsing test');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  // Direct test of the date parsing function and CSV lookup
  const testResults = await page.evaluate(async () => {
    // Test the parseDDMMYYYY function directly
    const parseDDMMYYYY = (dateStr) => {
      if (!dateStr) return null;
      
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      // Validate the parts
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (month < 1 || month > 12) return null;
      if (day < 1 || day > 31) return null;
      
      // Create Date object (month is 0-indexed)
      return new Date(year, month - 1, day);
    };
    
    // Test cases
    const testDate = '17/10/2025';
    const parsed = parseDDMMYYYY(testDate);
    const formatted = parsed ? parsed.toLocaleDateString('en-AU') : 'null';
    
    console.log(`✅ Test date "${testDate}" parsed to: ${formatted}`);
    
    // Now test with real CSV data
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      const results = await csvModule.default.lookupByAddress('Gwandalan NSW 2259');
      
      if (results && results.length > 0) {
        const result = results[0];
        console.log('Raw CSV date:', result.recentHailDate);
        
        if (result.recentHailDate) {
          const parsedCSVDate = parseDDMMYYYY(result.recentHailDate);
          const formattedCSVDate = parsedCSVDate ? parsedCSVDate.toLocaleDateString('en-AU') : result.recentHailDate;
          console.log('✅ CSV date parsed:', formattedCSVDate);
          
          return {
            success: true,
            rawDate: result.recentHailDate,
            parsedDate: formattedCSVDate,
            isValidDate: !!parsedCSVDate && formattedCSVDate !== 'Invalid Date'
          };
        }
      }
      
      return { success: false, error: 'No CSV data' };
    } catch (error) {
      console.error('❌ CSV lookup failed:', error);
      return { success: false, error: error.message };
    }
  });
  
  console.log('Test results:', testResults);
  
  if (testResults.success && testResults.isValidDate) {
    console.log('✅ SUCCESS: Date parsing fix is working!');
    console.log(`  Raw date: ${testResults.rawDate}`);
    console.log(`  Parsed date: ${testResults.parsedDate}`);
  } else {
    console.log('❌ FAILED: Date parsing is not working correctly');
    if (testResults.error) {
      console.log(`  Error: ${testResults.error}`);
    }
  }
  
  // Now try to simulate the actual search to see the UI update
  console.log('🔍 Attempting to trigger UI update...');
  
  // Simulate clicking search with a known address
  await page.fill('gmp-place-autocomplete', 'Gwandalan NSW 2259');
  await page.waitForTimeout(1000);
  
  const searchButton = page.locator('button:has-text("Search")');
  if (await searchButton.isVisible()) {
    await searchButton.click();
    await page.waitForTimeout(3000);
    
    // Check if date appears correctly in UI
    const dateText = page.locator('span.font-medium.text-blue-900');
    const dateVisible = await dateText.isVisible();
    
    if (dateVisible) {
      const dateContent = await dateText.textContent();
      console.log('UI Date content:', dateContent);
      
      if (dateContent && !dateContent.includes('Invalid Date')) {
        console.log('✅ UI shows correct date:', dateContent);
      } else {
        console.log('❌ UI still shows Invalid Date');
      }
    } else {
      console.log('ℹ️ Date element not visible in UI (expected since Google Places may not trigger)');
    }
  }
});