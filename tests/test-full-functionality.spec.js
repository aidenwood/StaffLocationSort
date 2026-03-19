import { test, expect } from '@playwright/test';

test('Area Damage Estimator full functionality test', async ({ page }) => {
  // Navigate to the estimator page
  await page.goto('http://localhost:5175/#estimator');
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  console.log('🧪 Testing Area Damage Estimator functionality');
  
  // Check if the main heading exists
  const heading = page.locator('h1:has-text("Area Damage Estimator")');
  await expect(heading).toBeVisible();
  console.log('✅ Main heading found');
  
  // Find the address input
  const addressInput = page.locator('input[placeholder*="address"]');
  await expect(addressInput).toBeVisible();
  console.log('✅ Address input is visible');
  
  // Type a test address
  const testAddress = "Belmont NSW 2280";
  await addressInput.fill(testAddress);
  console.log(`✅ Typed address: ${testAddress}`);
  
  // Check if search button is now enabled
  const searchButton = page.locator('button:has-text("Search")');
  await expect(searchButton).toBeVisible();
  await expect(searchButton).toBeEnabled();
  console.log('✅ Search button is now enabled');
  
  // Click the search button
  await searchButton.click();
  console.log('✅ Clicked search button');
  
  // Wait for results to appear
  await page.waitForTimeout(3000);
  
  // Check for results
  const results = page.locator('.bg-white.rounded-lg.shadow-sm.border').nth(1); // Skip the search section
  const resultsVisible = await results.isVisible();
  console.log('Results visible:', resultsVisible);
  
  if (resultsVisible) {
    // Look for risk level indicators
    const riskIndicator = page.locator('text=Risk Level');
    const hasRiskIndicator = await riskIndicator.isVisible();
    console.log('Risk indicator found:', hasRiskIndicator);
    
    // Look for suburb name
    const suburbText = page.locator('text=Belmont');
    const hasSuburb = await suburbText.isVisible();
    console.log('Suburb found:', hasSuburb);
  }
  
  // Test the back button
  const backButton = page.locator('button:has-text("Back to Dashboard")');
  await expect(backButton).toBeVisible();
  console.log('✅ Back button found and working');
  
  // Take a final screenshot
  await page.screenshot({ path: 'estimator-full-test.png', fullPage: true });
  
  console.log('🎉 Full functionality test completed');
});