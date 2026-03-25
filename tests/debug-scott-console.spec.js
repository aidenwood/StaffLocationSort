import { test, expect } from '@playwright/test';

test('Debug Scott console logs', async ({ page }) => {
  const consoleLogs = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Scott') || text.includes('SCOTT') || text.includes('🔍') || text.includes('🕘')) {
      consoleLogs.push(text);
      console.log(`CONSOLE: ${text}`);
    }
  });
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the app to load and data to be processed
  await page.waitForTimeout(5000);
  
  // Try to find the date input and set it to March 25
  try {
    const dateInput = page.locator('[data-testid="date-selector"], input[type="date"]').first();
    await dateInput.waitFor({ timeout: 5000 });
    await dateInput.fill('2026-03-25');
    await page.waitForTimeout(2000);
    console.log('Set date to March 25');
  } catch (e) {
    console.log('Could not find date input:', e.message);
  }
  
  // Try to navigate to March 26
  try {
    const dateInput = page.locator('[data-testid="date-selector"], input[type="date"]').first();
    await dateInput.fill('2026-03-26');
    await page.waitForTimeout(2000);
    console.log('Set date to March 26');
  } catch (e) {
    console.log('Could not change date to March 26:', e.message);
  }
  
  console.log(`\nCaptured ${consoleLogs.length} relevant console logs:`);
  consoleLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'debug-scott-screenshot.png', fullPage: true });
  console.log('Screenshot saved as debug-scott-screenshot.png');
});