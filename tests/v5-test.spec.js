import { test, expect } from '@playwright/test';

test('V5 App loads and shows server-filtered content', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('V5')) {
      console.log('🔧 V5 Console:', msg.text());
    }
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  await page.goto('http://localhost:5173');
  
  // Wait for React to render
  await page.waitForTimeout(3000);
  
  // Should see main header
  await expect(page.locator('text=Inspection Scheduler')).toBeVisible();
  
  // Should see server-side filtering description
  await expect(page.locator('text=Server-Side Filtering')).toBeVisible();
  
  // Should see filter info
  const filterInfo = await page.locator('text=Filter:').count();
  if (filterInfo > 0) {
    console.log('✅ Filter information visible');
  } else {
    console.log('⚠️ No filter information displayed');
  }
  
  // Check if data is loading or loaded
  const loadingElement = await page.locator('text=Loading, text=loading').count();
  if (loadingElement > 0) {
    console.log('📡 Data is loading...');
    await page.waitForTimeout(5000); // Wait for loading to complete
  }
  
  // Check for activities count
  const activityCountElements = await page.locator('text=/\\d+ Filtered Activities/, text=/\\d+ Today\'s Bookings/').count();
  if (activityCountElements > 0) {
    const activityText = await page.locator('text=/\\d+ Filtered Activities/, text=/\\d+ Today\'s Bookings/').first().textContent();
    console.log('📊 Activity count:', activityText);
  }
  
  // Check if inspector selection is available
  const inspectorSelect = await page.locator('select').first();
  if (await inspectorSelect.count() > 0) {
    const options = await inspectorSelect.locator('option').allTextContents();
    console.log('👥 Inspector options:', options);
  }
  
  // Should see client booking button
  await expect(page.locator('button:has-text("Client Booking")')).toBeVisible();
  
  console.log('✅ V5 app loaded successfully');
});