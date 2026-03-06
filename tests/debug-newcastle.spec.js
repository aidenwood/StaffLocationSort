import { test, expect } from '@playwright/test';

test('Debug Newcastle address validation', async ({ page }) => {
  // Capture all console messages
  page.on('console', msg => {
    console.log('CONSOLE:', msg.text());
  });
  
  await page.goto('/#book');
  await page.waitForTimeout(5000);
  
  const addressInput = page.locator('input[placeholder*="address"]');
  await addressInput.fill('Newcastle NSW');
  
  await page.waitForTimeout(2000);
  
  // Select autocomplete
  const firstSuggestion = page.locator('.pac-item').first();
  if (await firstSuggestion.count() > 0) {
    await addressInput.press('ArrowDown');
    await addressInput.press('Enter');
    await page.waitForTimeout(1000);
  }
  
  const submitButton = page.locator('button:has-text("Find Available Times")');
  await submitButton.click();
  
  await page.waitForTimeout(5000);
  
  const content = await page.textContent('body');
  console.log('PAGE CONTENT INCLUDES:');
  console.log('- Service Area Confirmed:', content.includes('Service Area Confirmed'));
  console.log('- Out of Service Area:', content.includes('Address Out of Service Area'));
  console.log('- R09:', content.includes('R09'));
  console.log('- Newcastle:', content.includes('Newcastle'));
  
  expect(true).toBe(true);
});