import { test, expect } from '@playwright/test';

test('Debug what is actually rendering on the page', async ({ page }) => {
  // Set up console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.error(`❌ Browser error: ${text}`);
    } else {
      console.log(`📝 Browser: ${text}`);
    }
  });
  
  // Navigate to the estimator page
  await page.goto('http://localhost:5175/#estimator');
  
  // Wait for the page to load
  await page.waitForTimeout(8000); // Longer wait for Google Maps
  
  console.log('🧪 Debugging page content');
  
  // Take screenshot to see what's rendered
  await page.screenshot({ path: 'debug-full-page.png', fullPage: true });
  
  // Get the entire page HTML to see what's actually there
  const pageHTML = await page.content();
  console.log('📄 Page HTML length:', pageHTML.length);
  
  // Check for various possible elements
  console.log('🔍 Looking for various address input elements...');
  
  // Check for any input elements
  const allInputs = await page.locator('input').all();
  console.log(`Found ${allInputs.length} input elements total`);
  
  for (let i = 0; i < allInputs.length; i++) {
    const input = allInputs[i];
    const placeholder = await input.getAttribute('placeholder').catch(() => 'no placeholder');
    const className = await input.getAttribute('class').catch(() => 'no class');
    const visible = await input.isVisible().catch(() => false);
    console.log(`Input ${i + 1}: placeholder="${placeholder}", visible=${visible}, class="${className}"`);
  }
  
  // Check for Google Maps elements
  console.log('🗺️ Checking for Google Maps elements...');
  const googleElements = [
    'gmp-place-autocomplete-element',
    '[class*="google"]',
    '[class*="gm-"]',
    '[class*="pac-"]'
  ];
  
  for (const selector of googleElements) {
    const count = await page.locator(selector).count();
    console.log(`${selector}: ${count} elements found`);
  }
  
  // Check the specific container we're using
  console.log('📦 Checking AddressAutocompleteNew container...');
  const container = page.locator('[style*="gmp-color-primary"]').first();
  const containerVisible = await container.isVisible().catch(() => false);
  const containerHTML = await container.innerHTML().catch(() => 'not found');
  console.log('Container visible:', containerVisible);
  console.log('Container HTML:', containerHTML);
  
  // Check if Google Maps is loaded
  const googleMapsLoaded = await page.evaluate(() => {
    return !!(window.google && window.google.maps);
  });
  console.log('Google Maps loaded:', googleMapsLoaded);
  
  if (googleMapsLoaded) {
    const placesLoaded = await page.evaluate(() => {
      return !!(window.google.maps.places);
    });
    console.log('Google Places loaded:', placesLoaded);
    
    if (placesLoaded) {
      const placesServices = await page.evaluate(() => {
        return Object.keys(window.google.maps.places || {});
      });
      console.log('Places services available:', placesServices);
    }
  }
  
  // Check if our React component is even loading
  const componentLoaded = await page.evaluate(() => {
    return document.querySelector('[class*="area-damage"], [class*="estimator"]') !== null;
  });
  console.log('React component detected:', componentLoaded);
  
  // Look for our specific console logs
  console.log('⏳ Waiting for potential async loading...');
  await page.waitForTimeout(5000);
  
  console.log('🎯 Debug completed');
});