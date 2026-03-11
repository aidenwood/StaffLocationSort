import { test, expect } from '@playwright/test';

test('Debug Benjamin Wharton deals on March 10th', async ({ page }) => {
  // Go to the application
  await page.goto('http://localhost:5174');
  
  // Wait for the application to load
  await page.waitForTimeout(2000);
  
  console.log('=== Starting Debug Session ===');
  
  // Check current state
  const selectedInspector = await page.evaluate(() => {
    return window.appDebug?.selectedInspector || 'unknown';
  });
  console.log('Current inspector:', selectedInspector);
  
  // Try to select Benjamin Wharton
  const inspectorSelect = page.locator('select').first();
  
  // Get all options to find Benjamin Wharton
  const options = await inspectorSelect.locator('option').all();
  let benjaminOption = null;
  
  for (const option of options) {
    const text = await option.textContent();
    if (text && (text.includes('Benjamin') || text.includes('Ben') && text.includes('Wharton'))) {
      benjaminOption = await option.getAttribute('value');
      console.log('Found Benjamin Wharton option:', text, 'value:', benjaminOption);
      break;
    }
  }
  
  if (benjaminOption) {
    await inspectorSelect.selectOption(benjaminOption);
  } else {
    console.log('Benjamin Wharton not found, listing all options:');
    for (const option of options) {
      const text = await option.textContent();
      const value = await option.getAttribute('value');
      console.log(`- ${text} (value: ${value})`);
    }
  }
  
  await page.waitForTimeout(1000);
  
  // Set date to March 10th, 2026
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill('2026-03-10');
  await page.waitForTimeout(1000);
  
  console.log('Set inspector to Benjamin Wharton and date to March 10th, 2026');
  
  // Check for inspection activities
  const activitiesExist = await page.evaluate(() => {
    const activities = window.appDebug?.inspectionActivities || [];
    console.log('Inspection activities found:', activities.length);
    activities.forEach((activity, i) => {
      console.log(`Activity ${i + 1}:`, {
        id: activity.id,
        subject: activity.subject,
        address: activity.personAddress?.address || 'No address',
        coordinates: activity.coordinates || activity.personAddress?.coordinates || 'No coordinates'
      });
    });
    return activities.length > 0;
  });
  
  console.log('Activities exist:', activitiesExist);
  
  // Open Deals Debug Console
  const debugButton = page.locator('button:has-text("Debug Console")');
  await debugButton.click();
  await page.waitForTimeout(2000);
  
  // Check if the debug console opened
  const debugConsoleOpen = await page.locator('text=Deals Debug Console').isVisible();
  console.log('Debug console opened:', debugConsoleOpen);
  
  if (debugConsoleOpen) {
    // Check the current state in the debug console
    const dealCount = await page.textContent('[data-testid="deal-count"], .text-sm:has-text("deals found")');
    console.log('Deal count text:', dealCount);
    
    // Check if distance sorting is enabled
    const distanceSortCheckbox = page.locator('input[type="checkbox"]#sortByDistance');
    const isDistanceSortEnabled = await distanceSortCheckbox.isChecked();
    console.log('Distance sorting enabled:', isDistanceSortEnabled);
    
    // If not enabled, enable it
    if (!isDistanceSortEnabled) {
      await distanceSortCheckbox.check();
      await page.waitForTimeout(2000);
      console.log('Enabled distance sorting');
    }
    
    // Check the subheader values
    const subheaderVisible = await page.locator('text=Deals Near Today\'s Inspections').isVisible();
    console.log('Subheader visible:', subheaderVisible);
    
    if (subheaderVisible) {
      const within5km = await page.textContent('.text-2xl:near(:text("Within 5km"))');
      const within10km = await page.textContent('.text-2xl:near(:text("Within 10km"))');
      const within15km = await page.textContent('.text-2xl:near(:text("Within 15km"))');
      const totalMapped = await page.textContent('.text-2xl:near(:text("Total Mapped"))');
      
      console.log('Distance counts:', {
        within5km,
        within10km, 
        within15km,
        totalMapped
      });
    }
    
    // Check console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(`ERROR: ${msg.text()}`);
      } else if (msg.text().includes('📏') || msg.text().includes('🔍')) {
        logs.push(`LOG: ${msg.text()}`);
      }
    });
    
    // Force refresh the deals
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.click();
    await page.waitForTimeout(5000);
    
    // Print all captured logs
    console.log('=== Console Logs ===');
    logs.forEach(log => console.log(log));
    
    // Check API calls being made
    await page.evaluate(() => {
      console.log('=== API Debug ===');
      console.log('Current region:', window.appDebug?.selectedRegion);
      console.log('Inspector region mapping:', window.appDebug?.inspectorRegions);
    });
  }
  
  await page.waitForTimeout(3000);
  
  console.log('=== Debug Session Complete ===');
});