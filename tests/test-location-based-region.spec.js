import { test } from '@playwright/test';

test('Test location-based region detection for Ben W', async ({ page }) => {
  console.log('=== Testing Location-Based Region Detection ===');
  
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);
  
  // Console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🌍') || text.includes('📍') || text.includes('🔍') || text.includes('deals')) {
      console.log('BROWSER:', text);
    }
  });
  
  console.log('1. Selecting Benjamin Wharton (ID 2)...');
  const inspectorSelect = page.locator('select').first();
  await inspectorSelect.selectOption('2');
  await page.waitForTimeout(2000);
  
  console.log('2. Opening Deals Debug Console...');
  const debugButton = page.locator('button').filter({ hasText: /debug.*console/i });
  await debugButton.click();
  await page.waitForTimeout(2000);
  
  const isOpen = await page.locator('text=Deals Debug Console').isVisible();
  console.log('Debug console opened:', isOpen);
  
  if (isOpen) {
    // Check the region that was auto-detected
    const regionSelect = page.locator('select').filter({ hasText: /Region/ }).first();
    const detectedRegion = await regionSelect.inputValue();
    console.log('Auto-detected region:', detectedRegion);
    
    // Check if it's R01 (should be for Logan inspections)
    if (detectedRegion === 'R01') {
      console.log('✅ Correctly detected Logan inspections -> R01 region');
    } else {
      console.log('❌ Expected R01 but got:', detectedRegion);
    }
    
    // Check deal count 
    const dealText = await page.locator('text*=deals found').textContent();
    console.log('Deal count:', dealText);
    
    // Force refresh to see if deals load
    console.log('3. Refreshing deals...');
    await page.locator('button:has-text("Refresh")').click();
    await page.waitForTimeout(5000);
    
    const newDealText = await page.locator('text*=deals found').textContent();
    console.log('Deal count after refresh:', newDealText);
    
    // Check distance stats
    const subheaderVisible = await page.locator('text=Deals Near Today\'s Inspections').isVisible();
    if (subheaderVisible) {
      const distanceCounts = await page.evaluate(() => {
        const counts = [];
        document.querySelectorAll('.text-2xl').forEach(el => {
          counts.push(el.textContent);
        });
        return counts;
      });
      console.log('Distance counts:', distanceCounts);
      
      const totalDeals = distanceCounts[3] || '0'; // Total mapped deals
      if (parseInt(totalDeals) > 0) {
        console.log('✅ Found deals with distance calculations!');
      } else {
        console.log('❌ Still no deals found');
      }
    }
  }
  
  console.log('=== Test Complete ===');
});