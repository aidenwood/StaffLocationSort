import { test, expect } from '@playwright/test';

test.describe('Google Places Autocomplete Functionality', () => {
  test('should show autocomplete suggestions when typing address', async ({ page }) => {
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
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('=== PAGE LOADED ===');
    
    // Check if we're using the fallback version (no autocomplete)
    const hasFallbackWarning = await page.locator('text=Address autocomplete unavailable').isVisible();
    
    if (hasFallbackWarning) {
      console.log('❌ Using fallback version - Google Maps autocomplete not available');
      console.log('This means the Google Maps wrapper is failing to load properly');
      expect(true).toBe(false); // Fail the test to highlight this issue
      return;
    }
    
    // Check if the booking form is visible
    const bookingForm = page.locator('h1:has-text("Book Your Roof Inspection")');
    await expect(bookingForm).toBeVisible();
    
    // Find the address input
    const addressInput = page.locator('input[placeholder*="address"]');
    await expect(addressInput).toBeVisible();
    
    console.log('=== STARTING AUTOCOMPLETE TEST ===');
    
    // Click on the input to focus it
    await addressInput.click();
    
    // Type a partial address that should trigger autocomplete
    await addressInput.fill('22 Arafura Ave, Logan');
    
    // Wait a moment for autocomplete to potentially appear
    await page.waitForTimeout(2000);
    
    // Check if any autocomplete suggestions appeared
    const suggestionSelectors = [
      '.pac-container .pac-item',           // Standard Google autocomplete
      '[role="option"]',                    // ARIA autocomplete options
      '.pac-item',                          // Google Places autocomplete items
      '.autocomplete-suggestion',           // Custom autocomplete
      '[data-testid*="suggestion"]',        // Test ID based
      '.suggestion',                        // Generic suggestion class
    ];
    
    let suggestionsFound = false;
    let suggestionCount = 0;
    
    for (const selector of suggestionSelectors) {
      const suggestions = page.locator(selector);
      const count = await suggestions.count();
      if (count > 0) {
        suggestionsFound = true;
        suggestionCount = count;
        console.log(`✓ Found ${count} suggestions with selector: ${selector}`);
        
        // Log the suggestion text
        for (let i = 0; i < Math.min(count, 3); i++) {
          const suggestionText = await suggestions.nth(i).textContent();
          console.log(`  Suggestion ${i + 1}: ${suggestionText}`);
        }
        break;
      }
    }
    
    if (!suggestionsFound) {
      console.log('❌ No autocomplete suggestions found with any selector');
      
      // Check if Google Maps is actually loaded
      const googleMapsStatus = await page.evaluate(() => {
        return {
          googleExists: !!window.google,
          mapsExists: !!(window.google && window.google.maps),
          placesExists: !!(window.google && window.google.maps && window.google.maps.places),
          autocompleteExists: !!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete)
        };
      });
      
      console.log('Google Maps Status:', googleMapsStatus);
      
      // Check DOM for any pac-container elements
      const pacContainers = await page.locator('.pac-container').count();
      console.log(`PAC containers in DOM: ${pacContainers}`);
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/autocomplete-debug.png' });
    }
    
    console.log('\n=== CONSOLE ERRORS ===');
    consoleErrors.forEach((error, i) => {
      console.log(`ERROR ${i + 1}: ${error}`);
    });
    
    // The test should pass if suggestions are found
    expect(suggestionsFound).toBe(true);
    expect(suggestionCount).toBeGreaterThan(0);
  });

  test('should be able to select an autocomplete suggestion using keyboard', async ({ page }) => {
    await page.goto('/#book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const addressInput = page.locator('input[placeholder*="address"]');
    await expect(addressInput).toBeVisible();
    
    // Type a partial address
    await addressInput.click();
    await addressInput.fill('22 Arafura Ave, Logan');
    await page.waitForTimeout(2000);
    
    // Check if suggestions appeared
    const suggestions = page.locator('.pac-item');
    const suggestionCount = await suggestions.count();
    
    if (suggestionCount > 0) {
      console.log(`Found ${suggestionCount} suggestions, using keyboard to select`);
      
      // Use arrow down key to select the first suggestion, then Enter
      await addressInput.press('ArrowDown');
      await page.waitForTimeout(500);
      await addressInput.press('Enter');
      await page.waitForTimeout(1000);
      
      // Check that the input value was updated
      const inputValue = await addressInput.inputValue();
      console.log(`Selected address via keyboard: ${inputValue}`);
      
      expect(inputValue).toContain('Arafura');
      
      // Check for the green validation indicator
      const validationIndicator = page.locator('.bg-green-500');
      await expect(validationIndicator).toBeVisible();
      
      console.log('✓ Autocomplete keyboard selection working');
    } else {
      console.log('❌ No suggestions available to select');
      expect(true).toBe(false);
    }
  });
});