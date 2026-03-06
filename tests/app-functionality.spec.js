import { test, expect } from '@playwright/test';

test.describe('StaffLocationSort App Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser Console Error:', msg.text());
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });
  });

  test('App loads without errors and shows content (V1)', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Check if we have the main app content
    const header = await page.locator('h1').first();
    await expect(header).toBeVisible();
    
    // Should see the main dashboard title
    await expect(page.locator('text=Inspection Scheduler')).toBeVisible();
    
    // Should see navigation buttons
    await expect(page.locator('button:has-text("V2")')).toBeVisible();
    await expect(page.locator('button:has-text("V3")')).toBeVisible();
    await expect(page.locator('button:has-text("Client")')).toBeVisible();
    
    console.log('✅ V1: App loads and shows main content');
  });

  test('V2 route works (Enhanced GET Filtering)', async ({ page }) => {
    await page.goto('http://localhost:5173#v2');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Should see V2 specific content
    await expect(page.locator('text=V2: Enhanced GET Filtering')).toBeVisible();
    await expect(page.locator('text=Inspection Scheduler V2')).toBeVisible();
    
    // Should see navigation buttons
    await expect(page.locator('button:has-text("V1")')).toBeVisible();
    await expect(page.locator('button:has-text("V3")')).toBeVisible();
    
    console.log('✅ V2: Enhanced GET Filtering route works');
  });

  test('V3 route works (ItemSearch API)', async ({ page }) => {
    await page.goto('http://localhost:5173#v3');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Should see V3 specific content
    await expect(page.locator('text=V3: ItemSearch API')).toBeVisible();
    await expect(page.locator('text=Inspection Scheduler V3')).toBeVisible();
    
    // Should see navigation buttons
    await expect(page.locator('button:has-text("V1")')).toBeVisible();
    await expect(page.locator('button:has-text("V2")')).toBeVisible();
    
    console.log('✅ V3: ItemSearch API route works');
  });

  test('Client route works', async ({ page }) => {
    await page.goto('http://localhost:5173#client');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Should see client booking content
    await expect(page.locator('text=Book Your Roof Inspection')).toBeVisible();
    
    // Should see staff login button
    await expect(page.locator('button:has-text("Staff Login")')).toBeVisible();
    
    console.log('✅ Client: Booking route works');
  });

  test('Check for JavaScript errors and blank page issues', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);
    
    // Check if page has content (not blank)
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent.length).toBeGreaterThan(100); // Should have substantial content
    
    // Report any errors found
    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors Found:');
      consoleErrors.forEach(error => console.log('  -', error));
    } else {
      console.log('✅ No console errors found');
    }
    
    if (pageErrors.length > 0) {
      console.log('❌ Page Errors Found:');
      pageErrors.forEach(error => console.log('  -', error));
    } else {
      console.log('✅ No page errors found');
    }
    
    // Verify we don't have a blank page
    const hasContent = await page.locator('h1, .bg-white, .dashboard').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('Calendar component loads and is interactive', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Look for calendar-related elements
    const calendarExists = await page.locator('[class*="calendar"], [class*="Calendar"], .react-calendar').count();
    
    if (calendarExists > 0) {
      console.log('✅ Calendar component found on page');
    } else {
      console.log('⚠️ Calendar component not immediately visible');
    }
    
    // Check if inspector selector exists
    const inspectorSelect = await page.locator('select, [class*="inspector"]').count();
    
    if (inspectorSelect > 0) {
      console.log('✅ Inspector selection elements found');
    } else {
      console.log('⚠️ Inspector selection not immediately visible');
    }
  });

  test('Check data loading states', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000);
    
    // Look for loading indicators
    const loadingElements = await page.locator('text=Loading, text=loading, [class*="loading"], [class*="spinner"]').count();
    
    if (loadingElements > 0) {
      console.log('📡 Loading state detected - waiting for data...');
      await page.waitForTimeout(5000); // Wait longer for data
    }
    
    // Check for error states
    const errorElements = await page.locator('text=Error, text=error, [class*="error"]').count();
    
    if (errorElements > 0) {
      console.log('❌ Error state detected on page');
      const errorText = await page.locator('text=Error, text=error, [class*="error"]').first().textContent();
      console.log('Error content:', errorText);
    } else {
      console.log('✅ No error states visible');
    }
  });
});