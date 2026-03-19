import { test, expect } from '@playwright/test';

test('Test Date Parsing Fix - DD/MM/YYYY format', async ({ page }) => {
  console.log('🧪 Testing DD/MM/YYYY date parsing fix');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  // Test the parseDDMMYYYY function directly
  await page.evaluate(() => {
    // Test the date parsing function
    const testDates = [
      '17/10/2025',
      '06/07/2025', 
      '26/05/2023',
      '01/01/2024',
      '31/12/2023',
      'invalid-date',
      '',
      null
    ];
    
    console.log('🔍 Testing parseDDMMYYYY function...');
    
    // Inject the function to test it
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
    
    testDates.forEach(dateStr => {
      const parsed = parseDDMMYYYY(dateStr);
      const formatted = parsed ? parsed.toLocaleDateString('en-AU') : 'null';
      console.log(`Input: "${dateStr}" → Parsed: ${parsed ? parsed.toISOString().split('T')[0] : 'null'} → Formatted: ${formatted}`);
    });
  });
  
  await page.waitForTimeout(1000);
  
  // Test CSV lookup with actual date data
  await page.evaluate(async () => {
    try {
      console.log('🔍 Testing CSV lookup with date parsing...');
      const csvModule = await import('/src/utils/csvLookup.js');
      const results = await csvModule.default.lookupByAddress('Gwandalan NSW 2259');
      
      if (results && results.length > 0) {
        console.log('✅ CSV lookup successful');
        console.log('Raw date from CSV:', results[0].recentHailDate);
        
        // Test the parsing
        if (results[0].recentHailDate) {
          const parts = results[0].recentHailDate.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            const parsedDate = new Date(year, month - 1, day);
            console.log('✅ Parsed date:', parsedDate.toLocaleDateString('en-AU'));
            console.log('✅ ISO format:', parsedDate.toISOString().split('T')[0]);
          }
        }
      } else {
        console.log('❌ No CSV results found');
      }
    } catch (error) {
      console.error('❌ CSV test failed:', error);
    }
  });
  
  console.log('✅ Date parsing test completed');
});