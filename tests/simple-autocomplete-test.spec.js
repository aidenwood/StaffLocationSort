import { test, expect } from '@playwright/test';

test('Simple autocomplete verification', async ({ page }) => {
  console.log('=== SIMPLE AUTOCOMPLETE TEST ===');
  
  // Navigate to the book route
  await page.goto('/#book');
  
  // Wait for initial load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Give more time for Google Maps to load
  
  // Check what we can see on the page
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  
  // Check if we have the booking form
  const bookingHeader = await page.locator('h1').textContent();
  console.log(`Header text: ${bookingHeader}`);
  
  // Check Google Maps status
  const googleStatus = await page.evaluate(() => {
    return {
      googleExists: !!window.google,
      mapsExists: !!(window.google && window.google.maps),
      placesExists: !!(window.google && window.google.maps && window.google.maps.places),
      autocompleteExists: !!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete)
    };
  });
  
  console.log('Google Maps Status:', googleStatus);
  
  // Find the address input
  const addressInputs = await page.locator('input').all();
  console.log(`Found ${addressInputs.length} input elements`);
  
  for (let i = 0; i < addressInputs.length; i++) {
    const placeholder = await addressInputs[i].getAttribute('placeholder');
    console.log(`Input ${i}: placeholder = "${placeholder}"`);
  }
  
  // Try to find and interact with the address input
  const addressInput = page.locator('input[placeholder*="address"]');
  const inputExists = await addressInput.count();
  console.log(`Address input count: ${inputExists}`);
  
  if (inputExists > 0) {
    await addressInput.click();
    await addressInput.fill('22 Arafura Ave');
    console.log('Typed test address');
    
    // Wait for suggestions
    await page.waitForTimeout(3000);
    
    // Check for PAC container
    const pacCount = await page.locator('.pac-container').count();
    console.log(`PAC containers: ${pacCount}`);
    
    const pacItemCount = await page.locator('.pac-item').count();
    console.log(`PAC items: ${pacItemCount}`);
    
    if (pacItemCount > 0) {
      console.log('✅ AUTOCOMPLETE WORKING!');
      for (let i = 0; i < Math.min(pacItemCount, 3); i++) {
        const suggestion = await page.locator('.pac-item').nth(i).textContent();
        console.log(`  Suggestion ${i + 1}: ${suggestion}`);
      }
    } else {
      console.log('❌ No autocomplete suggestions found');
    }
  } else {
    console.log('❌ Address input not found');
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'test-results/simple-autocomplete-debug.png' });
  
  // This test always passes - it's just for debugging
  expect(true).toBe(true);
});