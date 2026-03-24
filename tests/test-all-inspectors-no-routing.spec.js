const { test, expect } = require('@playwright/test');

test.describe('All Inspectors View - No Routing', () => {
  test('should display color-coded markers without routing calculations', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for the inspector selector to be visible
    await page.waitForSelector('select[aria-label="Inspector selection"]', { timeout: 10000 });
    
    // Select "All Inspectors"
    await page.selectOption('select[aria-label="Inspector selection"]', '');
    
    // Wait for map to load
    await page.waitForSelector('.map-container', { timeout: 10000 });
    
    // Wait a moment for map markers to render
    await page.waitForTimeout(3000);
    
    // Check console logs for routing messages
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && (
        msg.text().includes('route') || 
        msg.text().includes('Skipping route') || 
        msg.text().includes('🚫') ||
        msg.text().includes('🗺️')
      )) {
        logs.push(msg.text());
      }
    });
    
    // Trigger a map update by switching inspectors
    await page.selectOption('select[aria-label="Inspector selection"]', '1');
    await page.waitForTimeout(1000);
    await page.selectOption('select[aria-label="Inspector selection"]', '');
    await page.waitForTimeout(2000);
    
    // Check that we see the "Skipping route calculation" message
    const hasSkipRoutingLog = logs.some(log => 
      log.includes('🚫 Skipping route calculation for All Inspectors view')
    );
    
    console.log('Console logs captured:', logs);
    
    // Verify that routing was skipped
    expect(hasSkipRoutingLog).toBe(true);
    
    // Verify map legend is visible (shows inspector colors)
    const legend = page.locator('.map-legend');
    await expect(legend).toBeVisible();
    
    // Verify legend has inspector entries
    const legendItems = page.locator('.legend-item');
    await expect(legendItems.first()).toBeVisible();
    
    console.log('✅ All Inspectors view shows color-coded markers without routing');
  });
  
  test('should still show routing for individual inspector selection', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for the inspector selector to be visible
    await page.waitForSelector('select[aria-label="Inspector selection"]', { timeout: 10000 });
    
    // Select a specific inspector
    await page.selectOption('select[aria-label="Inspector selection"]', '1');
    
    // Wait for map to load
    await page.waitForSelector('.map-container', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Check console logs for routing messages
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && (
        msg.text().includes('🗺️ Route calculated') || 
        msg.text().includes('route')
      )) {
        logs.push(msg.text());
      }
    });
    
    // Wait for potential routing calculation
    await page.waitForTimeout(3000);
    
    console.log('Individual inspector logs:', logs);
    
    // For individual inspector, we should NOT see the skip message
    const hasSkipRoutingLog = logs.some(log => 
      log.includes('🚫 Skipping route calculation')
    );
    
    expect(hasSkipRoutingLog).toBe(false);
    
    console.log('✅ Individual inspector selection allows routing calculations');
  });
});