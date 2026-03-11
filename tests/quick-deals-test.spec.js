import { test } from '@playwright/test';

test('Quick deals test - no date setting', async ({ page }) => {
  console.log('=== Quick Deals Test ===');
  
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);
  
  // Console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📏') || text.includes('🔍') || text.includes('deals') || text.includes('Error') || text.includes('distance')) {
      console.log('BROWSER:', text);
    }
  });
  
  // Check current state
  console.log('1. Checking current app state...');
  await page.evaluate(() => {
    const state = window.appDebug || {};
    console.log('App state:', {
      selectedInspector: state.selectedInspector,
      inspectors: state.inspectors?.map(i => ({ id: i.id, name: i.name, region: i.region })) || [],
      activities: state.inspectionActivities?.length || 0,
      selectedDate: state.selectedDate
    });
  });
  
  // Select Benjamin Wharton (ID 4)
  console.log('2. Selecting Benjamin Wharton...');
  const inspectorSelect = page.locator('select').first();
  await inspectorSelect.selectOption('4');
  await page.waitForTimeout(2000);
  
  // Open debug console immediately
  console.log('3. Opening debug console...');
  const debugButton = page.locator('button').filter({ hasText: /debug.*console/i });
  await debugButton.click();
  await page.waitForTimeout(2000);
  
  const isOpen = await page.locator('text=Deals Debug Console').isVisible();
  console.log('Debug console opened:', isOpen);
  
  if (isOpen) {
    // Check everything in the debug console
    console.log('4. Checking debug console state...');
    
    // Region check
    const regionSelect = page.locator('select').filter({ hasText: /Region/ }).first();
    const currentRegion = await regionSelect.inputValue();
    console.log('Current region:', currentRegion);
    
    // Deal count
    const dealCountEl = page.locator('text*=deals found');
    const dealCount = await dealCountEl.textContent();
    console.log('Deal count:', dealCount);
    
    // Distance sorting
    const distanceCheckbox = page.locator('input[type="checkbox"]#sortByDistance');
    const distanceEnabled = await distanceCheckbox.isChecked();
    console.log('Distance sorting enabled:', distanceEnabled);
    
    // Subheader visibility
    const subheaderVisible = await page.locator('text=Deals Near Today\'s Inspections').isVisible();
    console.log('Subheader visible:', subheaderVisible);
    
    // Force enable distance sorting if not enabled
    if (!distanceEnabled) {
      console.log('5. Enabling distance sorting...');
      await distanceCheckbox.check();
      await page.waitForTimeout(2000);
    }
    
    // Force refresh
    console.log('6. Refreshing deals...');
    await page.locator('button:has-text("Refresh")').click();
    await page.waitForTimeout(5000);
    
    // Check results
    const newDealCount = await page.locator('text*=deals found').textContent();
    console.log('Deal count after refresh:', newDealCount);
    
    // Check API calls and errors
    await page.evaluate(() => {
      console.log('=== Final Debug Check ===');
      console.log('Benjamin Wharton should be in region R03');
      console.log('Current inspector:', window.appDebug?.selectedInspector);
      console.log('Current region selection:', window.appDebug?.selectedRegion);
      console.log('Distance stats:', window.appDebug?.distanceStats);
    });
  }
  
  console.log('=== Test Complete ===');
});