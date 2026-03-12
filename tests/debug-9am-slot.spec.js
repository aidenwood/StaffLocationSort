import { test, expect } from '@playwright/test';

test('Debug 9am slot deal calculation for Ben Wharton on March 13th', async ({ page }) => {
  // Set up console logging first
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('🔍') || text.includes('⚠️') || text.includes('2026-03-13') || text.includes('09:00')) {
      console.log('CONSOLE:', text);
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:5174');
  console.log('Page loaded, waiting for initial load...');
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Check if we need to select inspector (Ben Thompson should be pre-selected with ID 2)
  const inspectorSelect = page.locator('select').first();
  const currentValue = await inspectorSelect.inputValue();
  console.log('Current inspector ID:', currentValue);
  
  if (currentValue !== '2') {
    console.log('Selecting Ben Thompson (ID: 2)');
    await inspectorSelect.selectOption('2');
    await page.waitForTimeout(1000);
  }
  
  // Wait for opportunities toggle to become available
  console.log('Waiting for opportunities toggle...');
  await page.waitForSelector('button:has-text("Opportunities")', { timeout: 15000 });
  
  // Check if opportunities are already loading or loaded
  const opportunitiesButton = page.locator('button:has-text("Opportunities"), button:has-text("Loading")');
  let waitTime = 0;
  const maxWaitTime = 15000; // 15 seconds max
  
  while (waitTime < maxWaitTime) {
    const buttonText = await opportunitiesButton.first().textContent();
    console.log(`Opportunities button status: "${buttonText}" (waited ${waitTime}ms)`);
    
    if (buttonText.includes('Loading')) {
      console.log('Still loading, waiting 1 second...');
      await page.waitForTimeout(1000);
      waitTime += 1000;
    } else if (buttonText.includes('Opportunities')) {
      // Check if it's enabled (green background)
      const isEnabled = await opportunitiesButton.first().evaluate(btn => 
        btn.classList.contains('bg-green-100')
      );
      
      if (!isEnabled) {
        console.log('Enabling opportunities...');
        await opportunitiesButton.first().click();
        await page.waitForTimeout(3000); // Wait for calculations
      }
      break;
    } else {
      await page.waitForTimeout(500);
      waitTime += 500;
    }
  }
  
  // Wait for deal calculations to complete
  console.log('Waiting for deal calculations to complete...');
  await page.waitForTimeout(5000);
  
  // Look for 9am deals button specifically
  const dealsButtons = page.locator('button:has-text("Deal")');
  const buttonCount = await dealsButtons.count();
  console.log(`Found ${buttonCount} deals buttons on page`);
  
  // Check all deals buttons and their context
  for (let i = 0; i < buttonCount; i++) {
    const button = dealsButtons.nth(i);
    const text = await button.textContent();
    const parentTimeSlot = await button.locator('xpath=ancestor::*[contains(@class, "")]//*[contains(text(), ":")]').first().textContent().catch(() => 'unknown');
    console.log(`Button ${i + 1}: "${text}" - Near time: ${parentTimeSlot}`);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'debug-9am-slot-final.png', fullPage: true });
  
  // Print all relevant console messages
  console.log('\n=== ALL RELEVANT CONSOLE MESSAGES ===');
  consoleMessages.forEach(msg => {
    if (msg.includes('🔍') || msg.includes('⚠️') || msg.includes('deal counts') || msg.includes('2026-03-13')) {
      console.log(msg);
    }
  });
});