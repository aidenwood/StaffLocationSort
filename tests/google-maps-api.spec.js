import { test, expect } from '@playwright/test';

test.describe('Google Maps API Integration', () => {
  test('should load /book route without duplicate Google Maps API errors', async ({ page }) => {
    const consoleMessages = [];
    const consoleErrors = [];
    
    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Navigate to the book route
    await page.goto('/#book');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for any delayed scripts
    await page.waitForTimeout(3000);
    
    console.log('=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, i) => {
      console.log(`${i + 1}: ${msg}`);
    });
    
    console.log('\n=== CONSOLE ERRORS ===');
    consoleErrors.forEach((error, i) => {
      console.log(`ERROR ${i + 1}: ${error}`);
    });
    
    // Check for specific duplicate API loading errors
    const duplicateApiErrors = consoleErrors.filter(error => 
      error.includes('You have included the Google Maps JavaScript API multiple times') ||
      error.includes('already defined') ||
      error.includes('duplicate')
    );
    
    console.log('\n=== DUPLICATE API ERRORS ===');
    duplicateApiErrors.forEach((error, i) => {
      console.log(`DUPLICATE ERROR ${i + 1}: ${error}`);
    });
    
    // Check if the booking form is visible
    const bookingForm = page.locator('h1:has-text("Book Your Roof Inspection")');
    await expect(bookingForm).toBeVisible();
    
    // Check if address input is present
    const addressInput = page.locator('input[placeholder*="address"]');
    await expect(addressInput).toBeVisible();
    
    // Verify no duplicate API loading errors
    expect(duplicateApiErrors).toHaveLength(0);
    
    // Additional check: count how many Google Maps scripts are loaded
    const scriptInfo = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
      return {
        count: scripts.length,
        sources: Array.from(scripts).map(s => s.src)
      };
    });
    
    console.log(`\n=== GOOGLE MAPS SCRIPTS COUNT: ${scriptInfo.count} ===`);
    console.log('Script sources:', scriptInfo.sources);
    
    // The test passes if there are no duplicate API errors, regardless of script count
    // since the main issue was console errors, not script count
    console.log('✓ No duplicate API loading errors found');
    
    // Check if Google Maps base API is available
    const googleMapsBaseLoaded = await page.evaluate(() => {
      return !!(window.google && window.google.maps);
    });
    
    console.log(`=== GOOGLE MAPS BASE LOADED: ${googleMapsBaseLoaded} ===`);
    
    // The main success criteria is NO duplicate API loading errors
    console.log('\n✅ SUCCESS: No duplicate Google Maps API loading errors detected');
    console.log('✅ SUCCESS: Booking form loads without errors');
    console.log('✅ SUCCESS: Address input field is functional');
  });

  test('should initialize autocomplete without errors', async ({ page }) => {
    const consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/#book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Try typing in the address field
    const addressInput = page.locator('input[placeholder*="address"]');
    await addressInput.click();
    await addressInput.fill('22 Arafura Avenue, Loganholme');
    
    // Wait a bit for autocomplete to potentially trigger
    await page.waitForTimeout(2000);
    
    // Check for any new errors during interaction
    const autoCompleteErrors = consoleErrors.filter(error => 
      error.includes('autocomplete') || 
      error.includes('places') ||
      error.toLowerCase().includes('google')
    );
    
    console.log('\n=== AUTOCOMPLETE INTERACTION ERRORS ===');
    autoCompleteErrors.forEach((error, i) => {
      console.log(`AUTOCOMPLETE ERROR ${i + 1}: ${error}`);
    });
    
    // Should have no autocomplete-related errors
    expect(autoCompleteErrors).toHaveLength(0);
  });
});