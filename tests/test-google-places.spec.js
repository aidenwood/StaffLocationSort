import { test, expect } from '@playwright/test';

test('Google Places PlaceAutocompleteElement functionality test', async ({ page }) => {
  // Navigate to the estimator page
  await page.goto('http://localhost:5175/#estimator');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  console.log('🧪 Testing Google Places PlaceAutocompleteElement (2026 implementation)');
  
  // Take initial screenshot
  await page.screenshot({ path: 'google-places-initial.png', fullPage: true });
  
  // Check if the main heading exists
  const heading = page.locator('h1:has-text("Area Damage Estimator")');
  await expect(heading).toBeVisible();
  console.log('✅ Main heading found');
  
  // Wait for Google Places to load (check for various possible input elements)
  await page.waitForTimeout(5000);
  
  // Check for Google Places element or fallback input
  const googlePlacesInput = page.locator('gmp-place-autocomplete-element input');
  const fallbackInput = page.locator('input[placeholder*="address"]');
  
  let inputFound = false;
  let inputType = '';
  
  // Check Google Places element first
  if (await googlePlacesInput.isVisible()) {
    inputFound = true;
    inputType = 'Google Places Element';
    console.log('✅ Google Places PlaceAutocompleteElement input found');
  } else if (await fallbackInput.isVisible()) {
    inputFound = true;
    inputType = 'Fallback Input';
    console.log('⚠️ Fallback input found (Google Places not loaded)');
  }
  
  console.log(`Input type found: ${inputType}`);
  console.log(`Input visible: ${inputFound}`);
  
  if (!inputFound) {
    console.error('❌ No address input found at all');
    await page.screenshot({ path: 'google-places-error.png', fullPage: true });
    throw new Error('No address input element found');
  }
  
  // Try to interact with the input
  const inputElement = inputFound && inputType === 'Google Places Element' ? googlePlacesInput : fallbackInput;
  
  // Type a test address
  const testAddress = "Belmont NSW 2280";
  await inputElement.fill(testAddress);
  console.log(`✅ Typed test address: ${testAddress}`);
  
  // Wait for potential autocomplete dropdown
  await page.waitForTimeout(2000);
  
  // Take screenshot after typing
  await page.screenshot({ path: 'google-places-after-typing.png', fullPage: true });
  
  // Check for autocomplete dropdown (Google Places specific)
  if (inputType === 'Google Places Element') {
    const dropdown = page.locator('gmp-place-autocomplete-element [role="listbox"], .pac-container');
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    console.log('Autocomplete dropdown visible:', dropdownVisible);
    
    if (dropdownVisible) {
      console.log('✅ Google Places autocomplete dropdown appeared');
      
      // Try to click on first suggestion
      const firstSuggestion = dropdown.locator('div[role="option"], .pac-item').first();
      const suggestionVisible = await firstSuggestion.isVisible().catch(() => false);
      
      if (suggestionVisible) {
        await firstSuggestion.click();
        console.log('✅ Clicked on first autocomplete suggestion');
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('⚠️ No autocomplete dropdown detected');
    }
  }
  
  // Check if search button is enabled
  const searchButton = page.locator('button:has-text("Search")');
  const searchButtonEnabled = await searchButton.isEnabled();
  console.log('Search button enabled:', searchButtonEnabled);
  
  if (searchButtonEnabled) {
    // Click search button
    await searchButton.click();
    console.log('✅ Clicked search button');
    
    // Wait for results
    await page.waitForTimeout(3000);
    
    // Check for results
    const results = page.locator('.bg-white.rounded-lg.shadow-sm.border').nth(1); // Skip search section
    const resultsVisible = await results.isVisible();
    console.log('Results visible:', resultsVisible);
    
    if (resultsVisible) {
      console.log('✅ Search results appeared');
      
      // Check for specific result elements
      const riskElements = page.locator('text=/Risk Level: (LOW|MEDIUM|HIGH)/');
      const riskCount = await riskElements.count();
      console.log(`Found ${riskCount} risk level indicators`);
      
      if (riskCount > 0) {
        console.log('✅ Risk level data displayed correctly');
      }
    }
  }
  
  // Test back button
  const backButton = page.locator('button:has-text("Back to Dashboard")');
  const backButtonVisible = await backButton.isVisible();
  console.log('Back button visible:', backButtonVisible);
  
  if (backButtonVisible) {
    await backButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Back button clicked');
    
    // Verify we're back at dashboard
    const dashboardElements = page.locator('h1, [class*="dashboard"], [class*="inspection"]');
    const dashboardVisible = await dashboardElements.first().isVisible().catch(() => false);
    console.log('Dashboard loaded after back button:', dashboardVisible);
  }
  
  // Final screenshot
  await page.screenshot({ path: 'google-places-final.png', fullPage: true });
  
  console.log('🎉 Google Places test completed');
  
  // Log console messages from the browser
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.error(`❌ Browser error: ${text}`);
    } else if (text.includes('Google') || text.includes('Places') || text.includes('🔥') || text.includes('✅')) {
      console.log(`📝 Browser: ${text}`);
    }
  });
});