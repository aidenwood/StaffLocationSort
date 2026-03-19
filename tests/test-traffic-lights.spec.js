import { test, expect } from '@playwright/test';

test('Test Traffic Light Colors for Different Zones', async ({ page }) => {
  console.log('🚦 Testing traffic light colors for different zones');
  
  await page.goto('http://localhost:5175/#estimator');
  await page.waitForTimeout(5000);
  
  const testZones = await page.evaluate(async () => {
    try {
      const csvModule = await import('/src/utils/csvLookup.js');
      
      // Test addresses with different zone types
      const testAddresses = [
        'Pacific Paradise QLD 4564', // Should be GO (Green)
        'Marcoola QLD 4564',         // Should be ON THE FENCE (Yellow) 
        '4564'                       // Multiple results - various zones
      ];
      
      const results = [];
      
      for (const address of testAddresses) {
        console.log(`Testing: ${address}`);
        const data = await csvModule.default.lookupByAddress(address);
        
        if (data && data.length > 0) {
          data.forEach((result, i) => {
            console.log(`  ${i + 1}. ${result.suburb} - Zone: ${result.zone} - Risk: ${result.riskLevel}`);
            results.push({
              address,
              suburb: result.suburb,
              zone: result.zone,
              riskLevel: result.riskLevel,
              recommendation: result.recommendation
            });
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Test failed:', error);
      return { error: error.message };
    }
  });
  
  console.log('\\n🚦 TRAFFIC LIGHT ZONES:');
  console.log('======================');
  
  if (testZones.error) {
    console.log('❌ Error:', testZones.error);
    return;
  }
  
  // Group by zone type
  const zoneGroups = {};
  testZones.forEach(result => {
    if (!zoneGroups[result.zone]) {
      zoneGroups[result.zone] = [];
    }
    zoneGroups[result.zone].push(result);
  });
  
  Object.entries(zoneGroups).forEach(([zone, locations]) => {
    const lightColor = zone === 'GO' || zone === 'WORTH IT' ? '🟢 GREEN' :
                      zone === 'ON THE FENCE' ? '🟡 YELLOW' :
                      zone === 'KEEP AWAY' ? '🔴 RED' : '⚫ GRAY';
    
    console.log(`\\n${lightColor} - Zone: "${zone}"`);
    locations.forEach(loc => {
      console.log(`  • ${loc.suburb} - ${loc.recommendation}`);
    });
  });
});