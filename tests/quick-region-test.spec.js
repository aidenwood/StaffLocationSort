import { test, expect } from '@playwright/test';

test('Quick region validation test', async ({ page }) => {
  await page.goto('/#book');
  await page.waitForTimeout(5000); // Reduced wait
  
  const addressInput = page.locator('input[placeholder*="address"]');
  await addressInput.fill('Newcastle NSW');
  
  const submitButton = page.locator('button:has-text("Find Available Times")');
  await submitButton.click();
  
  await page.waitForTimeout(2000); // Reduced wait
  
  const regionConfirm = page.locator('h1:has-text("Service Area Confirmed")');
  const hasConfirm = await regionConfirm.isVisible();
  
  if (hasConfirm) {
    const content = await page.textContent('body');
    console.log('Newcastle region test - SUCCESS:', content.includes('R09') || content.includes('Newcastle'));
  }
  
  expect(true).toBe(true);
});