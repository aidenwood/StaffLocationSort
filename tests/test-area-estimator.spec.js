import { test, expect } from '@playwright/test';

test('Area Damage Estimator page functionality', async ({ page }) => {
  // Navigate to the estimator page
  await page.goto('http://localhost:5175/#estimator');
  
  // Wait a bit for the page to load
  await page.waitForTimeout(2000);
  
  // Take a screenshot to see what's actually rendered
  await page.screenshot({ path: 'estimator-page.png', fullPage: true });
  
  // Check if the main heading exists
  const heading = page.locator('h1:has-text("Area Damage Estimator")');
  await expect(heading).toBeVisible();
  console.log('✅ Main heading found');
  
  // Check for address input
  const addressInput = page.locator('input[placeholder*="address"]');
  const addressInputVisible = await addressInput.isVisible();
  console.log('Address input visible:', addressInputVisible);
  
  // Check for search button
  const searchButton = page.locator('button:has-text("Search")');
  const searchButtonVisible = await searchButton.isVisible();
  const searchButtonEnabled = await searchButton.isEnabled();
  console.log('Search button visible:', searchButtonVisible, 'enabled:', searchButtonEnabled);
  
  // Check for back button
  const backButton = page.locator('button:has-text("Back to Dashboard")');
  const backButtonVisible = await backButton.isVisible();
  console.log('Back button visible:', backButtonVisible);
  
  // Try clicking the back button if it exists
  if (backButtonVisible) {
    await backButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Back button clicked');
  }
  
  // Check console logs for errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('❌ Browser console error:', msg.text());
    } else {
      console.log('📝 Browser console:', msg.text());
    }
  });
  
  console.log('Test completed');
});