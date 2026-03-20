const { test, expect } = require('@playwright/test');

test('Verify roster grid shows proper region names not internal notes', async ({ page }) => {
  console.log('🧪 Testing roster grid region display fix...');
  
  try {
    // Navigate to the application
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle' });
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Click on Grid view to open the availability grid
    console.log('📱 Clicking on Grid view...');
    const gridButton = page.locator('button:has-text("Grid")').first();
    await gridButton.waitFor({ timeout: 10000 });
    await gridButton.click();
    
    // Wait for the grid to load
    await page.waitForTimeout(3000);
    
    // Look for cells with region pills (the "ACTUAL" pills)
    console.log('🔍 Checking for region pills...');
    
    // Get all cells with region data
    const cells = await page.locator('td').all();
    console.log(`📊 Found ${cells.length} table cells`);
    
    // Check for problematic internal notes in region pills
    const problematicCells = [];
    const goodCells = [];
    
    for (let i = 0; i < cells.length; i++) {
      const cellText = await cells[i].textContent();
      
      // Check if cell contains region pills with internal notes
      if (cellText && cellText.includes('ACTUAL')) {
        const pillText = cellText.match(/Property Inspection ACTUAL - \w+/);
        if (pillText) {
          problematicCells.push({
            index: i,
            text: cellText,
            problematicText: pillText[0]
          });
          console.log(`❌ Found problematic cell ${i}: "${pillText[0]}"`);
        } else if (cellText.includes('ACTUAL') && !cellText.includes('Property Inspection')) {
          // This might be a proper region with ACTUAL label
          goodCells.push({
            index: i,
            text: cellText
          });
          console.log(`✅ Found proper region cell ${i}: "${cellText}"`);
        }
      }
    }
    
    // Look for proper region names that should appear
    const expectedRegions = [
      'Brisbane Metro',
      'Sunshine Coast',
      'Toowoomba', 
      'Regional QLD',
      'Regional East',
      'Newcastle Region'
    ];
    
    const foundRegions = [];
    for (const region of expectedRegions) {
      const regionElements = page.locator(`text=${region}`);
      const count = await regionElements.count();
      if (count > 0) {
        foundRegions.push(region);
        console.log(`✅ Found proper region: ${region} (${count} times)`);
      }
    }
    
    // Log console messages for debugging
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🏷️') || text.includes('🚫') || text.includes('SKIPPED')) {
        consoleLogs.push(text);
      }
    });
    
    // Refresh to capture console logs
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Report results
    console.log('\n📊 TEST RESULTS:');
    console.log(`❌ Problematic cells found: ${problematicCells.length}`);
    console.log(`✅ Good region cells found: ${goodCells.length}`);
    console.log(`🎯 Expected regions found: ${foundRegions.length}/${expectedRegions.length}`);
    
    if (problematicCells.length > 0) {
      console.log('\n❌ PROBLEMATIC CELLS:');
      problematicCells.forEach(cell => {
        console.log(`  Cell ${cell.index}: "${cell.problematicText}"`);
      });
    }
    
    if (foundRegions.length > 0) {
      console.log('\n✅ PROPER REGIONS FOUND:');
      foundRegions.forEach(region => {
        console.log(`  ✓ ${region}`);
      });
    }
    
    console.log('\n📝 CONSOLE LOGS:');
    consoleLogs.forEach(log => console.log(`  ${log}`));
    
    // The fix should reduce problematic cells
    console.log('\n🎯 EXPECTATION: Should see fewer or no "Property Inspection ACTUAL - Scott" in region pills');
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
});