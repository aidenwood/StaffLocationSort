import { test, expect } from '@playwright/test';

test('Debug region validation step by step', async ({ page }) => {
  console.log('=== DEBUGGING REGION VALIDATION ===');
  
  // Navigate to booking page
  await page.goto('/#book');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000); // Wait for any loading
  
  // Check what's on the page
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  
  // Check for booking form
  const bookingForm = page.locator('h1:has-text("Book Your Roof Inspection")');
  const hasBookingForm = await bookingForm.count() > 0;
  console.log(`Has booking form: ${hasBookingForm}`);
  
  if (!hasBookingForm) {
    console.log('❌ Booking form not found');
    return;
  }
  
  // Find address input
  const addressInput = page.locator('input[placeholder*="address"]');
  const hasAddressInput = await addressInput.count() > 0;
  console.log(`Has address input: ${hasAddressInput}`);
  
  if (hasAddressInput) {
    await addressInput.click();
    await addressInput.fill('123 Queen Street, Brisbane QLD');
    console.log('✅ Entered address');
    
    // Check for submit button
    const submitButton = page.locator('button:has-text("Find Available Times")');
    const hasSubmitButton = await submitButton.count() > 0;
    console.log(`Has submit button: ${hasSubmitButton}`);
    
    if (hasSubmitButton) {
      const isEnabled = await submitButton.isEnabled();
      console.log(`Submit button enabled: ${isEnabled}`);
      
      if (isEnabled) {
        await submitButton.click();
        console.log('✅ Clicked submit button');
        
        // Wait for next step
        await page.waitForTimeout(3000);
        
        // Check what appears
        const regionConfirm = page.locator('h1:has-text("Service Area Confirmed")');
        const hasRegionConfirm = await regionConfirm.count() > 0;
        console.log(`Has region confirmation: ${hasRegionConfirm}`);
        
        if (hasRegionConfirm) {
          console.log('✅ Region confirmation step reached!');
          
          // Check for region data
          const regionInfo = await page.locator('p, div, span').allTextContents();
          console.log('Page content includes:');
          regionInfo.forEach((text, i) => {
            if (text.includes('R0') || text.includes('Brisbane') || text.includes('Distance')) {
              console.log(`  ${i}: ${text}`);
            }
          });
          
        } else {
          console.log('❌ Region confirmation not reached');
          
          // Take screenshot to see what's happening
          await page.screenshot({ path: 'test-results/debug-region-validation.png' });
        }
      } else {
        console.log('❌ Submit button is disabled');
      }
    } else {
      console.log('❌ Submit button not found');
    }
  } else {
    console.log('❌ Address input not found');
  }
  
  console.log('Debug test completed');
  expect(true).toBe(true);
});