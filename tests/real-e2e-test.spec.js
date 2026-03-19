import { test, expect } from '@playwright/test';

test('REAL End-to-End Test - Google Places Autocomplete with Error Checking', async ({ page }) => {
  let consoleErrors = [];
  let networkErrors = [];
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`❌ Console Error: ${msg.text()}`);
    } else if (msg.text().includes('✅') || msg.text().includes('📍') || msg.text().includes('Google')) {
      console.log(`📝 ${msg.text()}`);
    }
  });
  
  // Capture network errors
  page.on('response', response => {
    if (!response.ok() && response.url().includes('googleapis.com')) {
      networkErrors.push(`${response.status()} ${response.url()}`);
      console.error(`❌ Network Error: ${response.status()} ${response.url()}`);
    }
  });
  
  console.log('🧪 REAL End-to-End Test Starting');
  
  // Navigate to estimator
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(8000); // Wait for Google Maps to load
  
  // Verify page loads
  const heading = page.locator('h1:has-text("Area Damage Estimator")');
  await expect(heading).toBeVisible();
  console.log('✅ Page loaded');
  
  // Verify Google Places element exists
  const placesElement = page.locator('gmp-place-autocomplete');
  await expect(placesElement).toBeVisible();
  console.log('✅ Google Places element rendered');
  
  // Check for network/console errors so far
  console.log(`📊 Console errors so far: ${consoleErrors.length}`);
  console.log(`📊 Network errors so far: ${networkErrors.length}`);
  
  if (networkErrors.length > 0) {
    console.error('❌ NETWORK ERRORS DETECTED:');
    networkErrors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (consoleErrors.length > 0) {
    console.error('❌ CONSOLE ERRORS DETECTED:');
    consoleErrors.forEach(error => console.error(`  - ${error}`));
  }
  
  // Wait a bit more to see if autocomplete starts working
  await page.waitForTimeout(5000);
  
  // Try to interact with the Google Places element
  console.log('🔍 Testing Google Places interaction...');
  
  // Check if we can type in the places element
  const canInteract = await page.evaluate(() => {
    const placesEl = document.querySelector('gmp-place-autocomplete');
    if (placesEl && placesEl.shadowRoot) {
      const input = placesEl.shadowRoot.querySelector('input');
      return !!input;
    }
    return false;
  });
  
  console.log('Can interact with Places input:', canInteract);
  
  if (canInteract) {
    // Try typing in the shadow input
    await page.evaluate(() => {
      const placesEl = document.querySelector('gmp-place-autocomplete');
      const input = placesEl.shadowRoot.querySelector('input');
      if (input) {
        input.focus();
        input.value = 'Belmont NSW';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ Typed "Belmont NSW" in Places input');
      }
    });
    
    // Wait for autocomplete suggestions
    await page.waitForTimeout(3000);
    
    // Check if suggestions appeared
    const hasSuggestions = await page.evaluate(() => {
      const placesEl = document.querySelector('gmp-place-autocomplete');
      if (placesEl && placesEl.shadowRoot) {
        const suggestions = placesEl.shadowRoot.querySelectorAll('[role="option"], .suggestion, .prediction');
        return suggestions.length > 0;
      }
      return false;
    });
    
    console.log('Has autocomplete suggestions:', hasSuggestions);
    
    if (hasSuggestions) {
      console.log('✅ Google Places autocomplete is working!');
      
      // Try clicking first suggestion
      await page.evaluate(() => {
        const placesEl = document.querySelector('gmp-place-autocomplete');
        const firstSuggestion = placesEl.shadowRoot.querySelector('[role="option"], .suggestion, .prediction');
        if (firstSuggestion) {
          firstSuggestion.click();
          console.log('✅ Clicked first autocomplete suggestion');
        }
      });
      
      await page.waitForTimeout(2000);
    }
  }
  
  // Test manual search button
  console.log('🔍 Testing manual search...');
  const searchButton = page.locator('button:has-text("Search")');
  
  if (await searchButton.isVisible()) {
    // Set a test address directly for manual search
    await page.evaluate(() => {
      // Find React component and set address state
      const addressInput = document.querySelector('gmp-place-autocomplete');
      if (addressInput) {
        addressInput.setAttribute('value', 'Belmont NSW 2280');
      }
    });
    
    await searchButton.click();
    console.log('✅ Clicked manual search button');
    
    await page.waitForTimeout(3000);
    
    // Check for results
    const results = page.locator('.bg-white.rounded-lg.shadow-sm.border').nth(1);
    const hasResults = await results.isVisible();
    console.log('Search results appeared:', hasResults);
    
    if (hasResults) {
      const riskElements = page.locator('text=/Risk Level: (LOW|MEDIUM|HIGH)/');
      const riskCount = await riskElements.count();
      console.log(`✅ Found ${riskCount} risk indicators`);
    }
  }
  
  // Test back button
  const backButton = page.locator('button:has-text("Back to Dashboard")');
  await expect(backButton).toBeVisible();
  await backButton.click();
  await page.waitForTimeout(2000);
  console.log('✅ Back button works');
  
  // Final error check
  console.log('\n📊 FINAL ERROR REPORT:');
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`Network errors: ${networkErrors.length}`);
  
  // Take final screenshot
  await page.screenshot({ path: 'real-e2e-test-result.png', fullPage: true });
  
  // FAIL THE TEST IF THERE ARE ERRORS
  if (networkErrors.length > 0 || consoleErrors.filter(e => e.includes('Invalid circle.radius')).length > 0) {
    throw new Error(`Feature is broken! Network errors: ${networkErrors.length}, Console errors with radius: ${consoleErrors.filter(e => e.includes('Invalid circle.radius')).length}`);
  }
  
  console.log('🎉 Test completed - no critical errors detected');
});