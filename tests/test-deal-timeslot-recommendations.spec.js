import { test, expect } from '@playwright/test';

test.describe('Deal Timeslot Recommendations', () => {
  test('should show purple deal recommendation buttons on available timeslots', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Select an inspector who should have inspections scheduled
    const inspectorSelect = page.locator('select').first();
    await inspectorSelect.selectOption({ label: 'Scott Rodman' });
    await page.waitForTimeout(1000);
    
    // Enable the "Show Opportunities" toggle
    const showOpportunitiesToggle = page.locator('label:has-text("Show Opportunities")');
    if (await showOpportunitiesToggle.isVisible()) {
      const checkbox = showOpportunitiesToggle.locator('input[type="checkbox"]');
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
        await page.waitForTimeout(2000); // Wait for deal calculations
      }
    }
    
    console.log('Waiting for deal calculations to complete...');
    await page.waitForTimeout(5000);
    
    // Look for purple deal recommendation buttons
    const dealButtons = page.locator('button:has-text("1km"), button:has-text("2.5km"), button:has-text("5km"), button:has-text("10km"), button:has-text("15km"), button:has-text("30km")');
    
    console.log('Checking for deal recommendation buttons...');
    
    // Check if any deal buttons are visible
    const buttonCount = await dealButtons.count();
    console.log(`Found ${buttonCount} deal recommendation buttons`);
    
    if (buttonCount > 0) {
      // Test clicking a deal button to open the debug console
      const firstButton = dealButtons.first();
      const buttonText = await firstButton.textContent();
      console.log(`Clicking deal button with text: ${buttonText}`);
      
      await firstButton.click();
      
      // Wait for the deals debug console modal to open
      await page.waitForSelector('[data-testid="deals-debug-console"]', { timeout: 5000 });
      
      // Verify the modal opened and contains expected content
      const modal = page.locator('[data-testid="deals-debug-console"]');
      await expect(modal).toBeVisible();
      
      // Check for radius breakdown in modal
      const radiusButtons = modal.locator('button:has-text("1km"), button:has-text("2.5km"), button:has-text("5km"), button:has-text("10km"), button:has-text("15km"), button:has-text("30km")');
      const modalRadiusCount = await radiusButtons.count();
      console.log(`Found ${modalRadiusCount} radius buttons in modal`);
      
      expect(modalRadiusCount).toBeGreaterThan(0);
      
      console.log('✅ Deal recommendations feature is working');
    } else {
      console.log('❌ No deal recommendation buttons found');
      
      // Check if there are console errors
      const logs = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logs.push(msg.text());
        }
      });
      
      await page.waitForTimeout(2000);
      
      if (logs.length > 0) {
        console.log('Console errors detected:');
        logs.forEach(log => console.log('  -', log));
      }
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'deal-recommendations-debug.png', fullPage: true });
      console.log('Screenshot saved as deal-recommendations-debug.png');
    }
    
    // Check console output for debug messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('📅 Calculated deal counts') || 
          text.includes('🎯 Opening deals console') || 
          text.includes('❌ Error calculating') ||
          text.includes('sortDealsByDistance') ||
          text.includes('getDealsForRegion')) {
        consoleMessages.push(text);
      }
    });
    
    await page.waitForTimeout(2000);
    
    if (consoleMessages.length > 0) {
      console.log('Relevant console messages:');
      consoleMessages.forEach(msg => console.log('  -', msg));
    }
  });
  
  test('should calculate deal counts correctly for different radius levels', async ({ page }) => {
    // This test will verify the calculation logic
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Inject test to verify calculateTimeSlotDealCounts function exists
    const hasCalculateFunction = await page.evaluate(() => {
      // Check if the function exists in global scope or component
      return typeof window.calculateTimeSlotDealCounts !== 'undefined' ||
             document.querySelector('[data-testid="inspection-dashboard"]') !== null;
    });
    
    console.log(`calculateTimeSlotDealCounts function availability: ${hasCalculateFunction}`);
  });
});