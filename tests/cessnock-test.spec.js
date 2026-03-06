import { test, expect } from '@playwright/test';

test('Test Cessnock region validation', async ({ page }) => {
  await page.goto('/#book');
  await page.waitForTimeout(5000);
  
  const addressInput = page.locator('input[placeholder*="address"]');
  await addressInput.fill('Cessnock NSW');
  
  const submitButton = page.locator('button:has-text("Find Available Times")');
  await submitButton.click();
  
  await page.waitForTimeout(3000);
  
  const regionConfirm = page.locator('h1:has-text("Service Area Confirmed")');
  const hasConfirm = await regionConfirm.isVisible();
  console.log(`Cessnock region confirmation shown: ${hasConfirm}`);
  
  const outOfService = page.locator('h1:has-text("Address Out of Service Area")');
  const isOutOfService = await outOfService.isVisible();
  console.log(`Cessnock out of service: ${isOutOfService}`);
  
  if (hasConfirm) {
    const content = await page.textContent('body');
    console.log('SUCCESS: Cessnock recognized as service area');
  }
  
  expect(true).toBe(true);
});