import { test, expect } from '@playwright/test';

test('Clear cache and test fresh data fetch', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Clear localStorage to remove cached data
  await page.evaluate(() => {
    // Clear all cache keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('staffLocationSort') || key.includes('activities'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cache keys:`, keysToRemove);
  });
  
  // Refresh the page to force fresh data fetch
  await page.reload();
  
  // Wait for data to load
  await page.waitForTimeout(5000);
  
  // Check console logs for fresh data fetching
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Fetching') || text.includes('Received') || text.includes('Activities:')) {
      consoleLogs.push(text);
      console.log(`FRESH FETCH: ${text}`);
    }
  });
  
  // Trigger refresh inspections button if it exists
  try {
    const refreshButton = page.locator('button:has-text("Refresh Inspections"), [data-testid="refresh-inspections"]');
    await refreshButton.waitFor({ timeout: 2000 });
    await refreshButton.click();
    console.log('Clicked refresh inspections button');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('No refresh button found, trying manual refresh...');
  }
  
  // Check if we now have activities
  const activitiesText = await page.textContent('body');
  const hasActivities = activitiesText.includes('Property Inspection') || activitiesText.includes('Scott');
  console.log(`Has activities after cache clear: ${hasActivities}`);
  
  console.log('\nFresh fetch logs:');
  consoleLogs.forEach(log => console.log(`  ${log}`));
});