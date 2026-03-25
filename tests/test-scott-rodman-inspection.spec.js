import { test, expect } from '@playwright/test';

test('Scott Rodman 9am inspection date verification', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the app to load
  await page.waitForTimeout(3000);
  
  // Look for any Scott Rodman inspections
  const scottInspections = page.locator('text=/.*scott.*rodman.*/i');
  
  // Log all inspections found
  const count = await scottInspections.count();
  console.log(`Found ${count} Scott Rodman inspections`);
  
  for (let i = 0; i < count; i++) {
    const inspection = scottInspections.nth(i);
    const text = await inspection.textContent();
    console.log(`Inspection ${i + 1}: ${text}`);
  }
  
  // Check for the specific Landsborough Maleny Road inspection
  const landsboroughInspection = page.locator('text=/.*1049.*landsborough.*maleny.*road.*/i');
  const landsboroughCount = await landsboroughInspection.count();
  console.log(`Found ${landsboroughCount} Landsborough Maleny Road inspections`);
  
  if (landsboroughCount > 0) {
    const inspectionText = await landsboroughInspection.first().textContent();
    console.log(`Landsborough inspection text: ${inspectionText}`);
    
    // Get the parent element to see more context about the date
    const parentElement = await landsboroughInspection.first().locator('xpath=../..').textContent();
    console.log(`Parent context: ${parentElement}`);
  }
  
  // Check what day is currently selected
  const dateInput = page.locator('input[type="date"]');
  const selectedDate = await dateInput.inputValue();
  console.log(`Currently selected date: ${selectedDate}`);
  
  // Navigate to March 25th specifically
  await dateInput.fill('2026-03-25');
  await page.waitForTimeout(2000);
  
  // Check if Scott's inspection appears on March 25th
  const scottOnMar25 = await page.locator('text=/.*scott.*rodman.*/i').count();
  console.log(`Scott inspections on Mar 25: ${scottOnMar25}`);
  
  // Navigate to March 26th
  await dateInput.fill('2026-03-26');
  await page.waitForTimeout(2000);
  
  // Check if Scott's inspection appears on March 26th  
  const scottOnMar26 = await page.locator('text=/.*scott.*rodman.*/i').count();
  console.log(`Scott inspections on Mar 26: ${scottOnMar26}`);
  
  // Look in browser console for debug logs about 9am appointments
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.text().includes('9am') || msg.text().includes('Scott')) {
      consoleLogs.push(msg.text());
    }
  });
  
  // Trigger a refresh to see debug logs
  await page.reload();
  await page.waitForTimeout(3000);
  
  console.log('Console logs about 9am/Scott:');
  consoleLogs.forEach(log => console.log(`  ${log}`));
});