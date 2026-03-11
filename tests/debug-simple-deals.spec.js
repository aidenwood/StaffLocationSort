import { test } from '@playwright/test';

test('Simple debug for deals issue', async ({ page }) => {
  console.log('=== Starting Simple Debug ===');
  
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);
  
  // Look for current state
  await page.evaluate(() => {
    console.log('=== App State ===');
    console.log('Available inspectors:', window.appDebug?.inspectors?.map(i => ({ id: i.id, name: i.name, region: i.region })) || 'None');
    console.log('Current selected inspector:', window.appDebug?.selectedInspector);
    console.log('Current date:', window.appDebug?.selectedDate);
    console.log('Current inspection activities:', window.appDebug?.inspectionActivities?.length || 0);
    
    // Try to find Benjamin Wharton
    const inspectors = window.appDebug?.inspectors || [];
    const benjamin = inspectors.find(i => i.name && i.name.toLowerCase().includes('benjamin') && i.name.toLowerCase().includes('wharton'));
    console.log('Found Benjamin Wharton:', benjamin);
  });
  
  // Open the debug console directly
  console.log('Looking for Debug Console button...');
  const debugButtons = page.locator('button').filter({ hasText: /debug/i });
  const debugButtonCount = await debugButtons.count();
  console.log('Found', debugButtonCount, 'debug buttons');
  
  if (debugButtonCount > 0) {
    await debugButtons.first().click();
    await page.waitForTimeout(2000);
    
    const isOpen = await page.locator('text=Deals Debug Console').isVisible();
    console.log('Debug console opened:', isOpen);
    
    if (isOpen) {
      // Check what region is selected
      const regionSelect = page.locator('select').filter({ hasText: /Region/ }).first();
      const currentRegion = await regionSelect.inputValue();
      console.log('Current region:', currentRegion);
      
      // Check deal count
      const dealCountText = await page.locator('text*=deals found').textContent();
      console.log('Deal count:', dealCountText);
      
      // Check distance sorting
      const distanceCheckbox = page.locator('input[type="checkbox"]#sortByDistance');
      const isDistanceEnabled = await distanceCheckbox.isChecked();
      console.log('Distance sorting enabled:', isDistanceEnabled);
      
      // Check subheader visibility
      const subheaderVisible = await page.locator('text=Deals Near Today\'s Inspections').isVisible();
      console.log('Subheader visible:', subheaderVisible);
      
      if (subheaderVisible) {
        const within5km = await page.locator('.text-2xl').first().textContent();
        console.log('First distance count (5km):', within5km);
      }
      
      // Force a refresh
      console.log('Clicking refresh...');
      await page.locator('button:has-text("Refresh")').click();
      await page.waitForTimeout(3000);
      
      // Check again after refresh
      const newDealCountText = await page.locator('text*=deals found').textContent();
      console.log('Deal count after refresh:', newDealCountText);
    }
  } else {
    console.log('No debug console button found');
  }
  
  console.log('=== Debug Complete ===');
});