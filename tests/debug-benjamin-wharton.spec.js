import { test } from '@playwright/test';

test('Debug Benjamin Wharton (ID 4) deals', async ({ page }) => {
  console.log('=== Benjamin Wharton Debug Test ===');
  
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);
  
  // Set console listener first
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📏') || text.includes('🔍') || text.includes('deals') || text.includes('ERROR') || text.includes('distance')) {
      logs.push(text);
      console.log('BROWSER:', text);
    }
  });
  
  // Select Benjamin Wharton specifically
  console.log('1. Selecting Benjamin Wharton (should be ID 4)...');
  const inspectorSelect = page.locator('select').first();
  await inspectorSelect.selectOption('4');  // Benjamin Wharton's ID
  await page.waitForTimeout(1000);
  
  // Set date to March 10th
  console.log('2. Setting date to March 10th, 2026...');
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill('2026-03-10');
  await page.waitForTimeout(2000);
  
  // Verify selection
  const selectedInspector = await page.evaluate(() => {
    return window.appDebug?.selectedInspector || 'unknown';
  });
  console.log('Selected inspector ID:', selectedInspector);
  
  const inspectorName = await page.evaluate(() => {
    const inspectors = window.appDebug?.inspectors || [];
    const selected = inspectors.find(i => i.id == window.appDebug?.selectedInspector);
    return selected?.name || 'unknown';
  });
  console.log('Selected inspector name:', inspectorName);
  
  // Check inspection activities
  const activities = await page.evaluate(() => {
    const acts = window.appDebug?.inspectionActivities || [];
    console.log('Found', acts.length, 'inspection activities');
    acts.forEach((act, i) => {
      console.log(`Activity ${i+1}:`, {
        subject: act.subject,
        address: act.personAddress?.address || 'No address',
        hasCoords: !!(act.coordinates || act.personAddress?.coordinates)
      });
    });
    return acts.length;
  });
  console.log('Inspection activities found:', activities);
  
  // Open Deals Debug Console  
  console.log('3. Opening Deals Debug Console...');
  const debugButton = page.locator('button').filter({ hasText: /debug.*console/i });
  await debugButton.click();
  await page.waitForTimeout(2000);
  
  const isOpen = await page.locator('text=Deals Debug Console').isVisible();
  console.log('Debug console opened:', isOpen);
  
  if (isOpen) {
    // Check the subheader is visible
    const subheaderVisible = await page.locator('text=Deals Near Today\'s Inspections').isVisible();
    console.log('Subheader visible:', subheaderVisible);
    
    if (subheaderVisible) {
      // Get all distance counts
      const distanceCounts = await page.evaluate(() => {
        const counts = [];
        const countElements = document.querySelectorAll('.text-2xl');
        countElements.forEach(el => {
          counts.push(el.textContent);
        });
        return counts;
      });
      console.log('Distance counts:', distanceCounts);
    }
    
    // Check region
    const region = await page.locator('select').filter({ hasText: /Region/ }).first().inputValue();
    console.log('Current region:', region);
    
    // Check deal count
    const dealText = await page.locator('text*=deals found').textContent();
    console.log('Deal count text:', dealText);
    
    // Check if distance sorting is enabled
    const distanceCheckbox = page.locator('input[type="checkbox"]#sortByDistance');
    const isEnabled = await distanceCheckbox.isChecked();
    console.log('Distance sorting enabled:', isEnabled);
    
    if (!isEnabled) {
      console.log('4. Enabling distance sorting...');
      await distanceCheckbox.check();
      await page.waitForTimeout(2000);
    }
    
    // Force refresh deals
    console.log('5. Refreshing deals...');
    await page.locator('button:has-text("Refresh")').click();
    await page.waitForTimeout(5000);
    
    // Check results after refresh
    const newDealText = await page.locator('text*=deals found').textContent();
    console.log('Deal count after refresh:', newDealText);
    
    // Check distance counts again
    if (await page.locator('text=Deals Near Today\'s Inspections').isVisible()) {
      const newDistanceCounts = await page.evaluate(() => {
        const counts = [];
        const countElements = document.querySelectorAll('.text-2xl');
        countElements.forEach(el => {
          counts.push(el.textContent);
        });
        return counts;
      });
      console.log('Distance counts after refresh:', newDistanceCounts);
    }
    
    // Check for API errors
    console.log('6. Checking browser console logs...');
    logs.forEach(log => console.log('LOG:', log));
    
    // Force check API state
    await page.evaluate(() => {
      console.log('=== API State Debug ===');
      console.log('Selected region for deals:', window.appDebug?.selectedRegion);
      console.log('Benjamin Wharton region should be R03');
      console.log('Deal type:', window.appDebug?.dealType);
      console.log('Sort by distance:', window.appDebug?.sortByDistance);
    });
  }
  
  console.log('=== Test Complete ===');
});