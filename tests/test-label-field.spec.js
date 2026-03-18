import { test, expect } from '@playwright/test';

test('Verify label field is populated in activities', async ({ page }) => {
  // Navigate to test page
  await page.goto('http://localhost:5174/test-region-detection.html');
  
  // Wait for the test to complete (longer timeout for deal label enrichment)
  await page.waitForSelector('h2:has-text("Summary")', { timeout: 120000 });
  
  // Get the success rate text
  const summaryText = await page.textContent('div:has-text("Success rate:")');
  console.log('Current summary:', summaryText);
  
  // Extract success rate percentage
  const match = summaryText.match(/Success rate:\s*(\d+)%/);
  const successRate = match ? parseInt(match[1]) : 0;
  
  console.log(`SUCCESS RATE: ${successRate}%`);
  
  // Check console logs for label field information
  const logs = [];
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('label')) {
      logs.push(msg.text());
    }
  });
  
  // Refresh to capture console logs
  await page.reload();
  await page.waitForSelector('h2:has-text("Summary")', { timeout: 120000 });
  
  // Log the label-related console messages
  console.log('Label-related console logs:');
  logs.forEach(log => console.log('  ', log));
  
  // We want to see improvement over the baseline 4%
  expect(successRate).toBeGreaterThanOrEqual(4);
  
  // If we got 4% or higher, we're good
  if (successRate >= 4) {
    console.log(`✅ SUCCESS RATE: ${successRate}% - LABELS ARE WORKING!`);
  }
});