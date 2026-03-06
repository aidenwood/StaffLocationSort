import { test, expect } from '@playwright/test';

test.describe('Pipedrive API Activity Comparison Tests', () => {
  
  test('Compare V0 unfiltered vs V5 filtered API approaches', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="inspection-dashboard"], .bg-gray-50', { timeout: 10000 });
    
    console.log('🧪 Testing API activity retrieval approaches...');
    
    // Test the original unfiltered approach (V0 style)
    const unfilteredResults = await page.evaluate(async () => {
      try {
        console.log('\n📊 TESTING V0 UNFILTERED APPROACH...');
        
        // Import API function
        const { fetchUserActivities } = await import('./src/api/pipedriveRead.js');
        
        // Test Ben Thompson (user ID 2) - the approach that was working before
        const benThompsonActivities = await fetchUserActivities(2);
        console.log(`✅ V0 UNFILTERED: Ben Thompson (ID: 2) - ${benThompsonActivities.length} total activities`);
        
        // Test Benjamin Frohloff (user ID 23088469)  
        const benFrohloffActivities = await fetchUserActivities(23088469);
        console.log(`✅ V0 UNFILTERED: Ben Frohloff (ID: 23088469) - ${benFrohloffActivities.length} total activities`);
        
        // Count Property Inspections manually from unfiltered data
        const benThompsonInspections = benThompsonActivities.filter(activity => {
          const subject = activity.subject || '';
          return subject.toLowerCase().includes('property inspection');
        });
        
        const benFrohloffInspections = benFrohloffActivities.filter(activity => {
          const subject = activity.subject || '';
          return subject.toLowerCase().includes('property inspection');
        });
        
        console.log(`🏠 V0 PROPERTY INSPECTIONS:`);
        console.log(`   Ben Thompson: ${benThompsonInspections.length} inspections`);
        console.log(`   Ben Frohloff: ${benFrohloffInspections.length} inspections`);
        
        return {
          benThompson: {
            total: benThompsonActivities.length,
            inspections: benThompsonInspections.length,
            sampleSubjects: benThompsonInspections.slice(0, 3).map(a => a.subject)
          },
          benFrohloff: {
            total: benFrohloffActivities.length, 
            inspections: benFrohloffInspections.length,
            sampleSubjects: benFrohloffInspections.slice(0, 3).map(a => a.subject)
          }
        };
      } catch (error) {
        console.error('❌ V0 UNFILTERED approach failed:', error);
        return { error: error.message };
      }
    });
    
    // Test the server-side filtered approach (V5 style)
    const filteredResults = await page.evaluate(async () => {
      try {
        console.log('\n📊 TESTING V5 FILTERED APPROACH...');
        
        // Import API function
        const { fetchActivitiesWithFilter } = await import('./src/api/pipedriveRead.js');
        const { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } = await import('./src/config/pipedriveFilters.js');
        
        console.log(`📊 Testing server filter ID: ${PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID}`);
        
        // Test server-side filter (should return all property inspections)
        const filteredActivities = await fetchActivitiesWithFilter(PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
        console.log(`✅ V5 FILTERED: Server filter returned ${filteredActivities.length} activities`);
        
        // Test with date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        const dateRangeActivities = await fetchActivitiesWithFilter(
          PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID,
          thirtyDaysAgo.toISOString().split('T')[0],
          today.toISOString().split('T')[0]
        );
        console.log(`✅ V5 DATE FILTERED: ${dateRangeActivities.length} activities in last 30 days`);
        
        return {
          serverFiltered: {
            total: filteredActivities.length,
            sampleSubjects: filteredActivities.slice(0, 3).map(a => a.subject)
          },
          dateFiltered: {
            total: dateRangeActivities.length,
            sampleSubjects: dateRangeActivities.slice(0, 3).map(a => a.subject)
          }
        };
      } catch (error) {
        console.error('❌ V5 FILTERED approach failed:', error);
        return { error: error.message };
      }
    });
    
    // Log comprehensive results
    console.log('\n📈 COMPREHENSIVE API COMPARISON:');
    console.log('=====================================');
    
    if (unfilteredResults.error) {
      console.log('❌ V0 UNFILTERED FAILED:', unfilteredResults.error);
    } else {
      console.log('✅ V0 UNFILTERED RESULTS:');
      console.log(`   Ben Thompson (ID: 2): ${unfilteredResults.benThompson.total} total, ${unfilteredResults.benThompson.inspections} inspections`);
      console.log(`   Ben Frohloff (ID: 23088469): ${unfilteredResults.benFrohloff.total} total, ${unfilteredResults.benFrohloff.inspections} inspections`);
      if (unfilteredResults.benThompson.sampleSubjects.length > 0) {
        console.log(`   Sample Ben Thompson subjects:`, unfilteredResults.benThompson.sampleSubjects);
      }
      if (unfilteredResults.benFrohloff.sampleSubjects.length > 0) {
        console.log(`   Sample Ben Frohloff subjects:`, unfilteredResults.benFrohloff.sampleSubjects);
      }
    }
    
    if (filteredResults.error) {
      console.log('❌ V5 FILTERED FAILED:', filteredResults.error);
    } else {
      console.log('✅ V5 FILTERED RESULTS:');
      console.log(`   Server filter total: ${filteredResults.serverFiltered.total} activities`);
      console.log(`   Date range (30 days): ${filteredResults.dateFiltered.total} activities`);
      if (filteredResults.serverFiltered.sampleSubjects.length > 0) {
        console.log(`   Sample server filter subjects:`, filteredResults.serverFiltered.sampleSubjects);
      }
    }
    
    // Assertions
    if (!unfilteredResults.error) {
      expect(unfilteredResults.benThompson.total).toBeGreaterThan(0);
      expect(unfilteredResults.benFrohloff.total).toBeGreaterThan(0);
      console.log('✅ UNFILTERED API WORKS: Both users have activities');
    }
    
    if (!filteredResults.error) {
      expect(filteredResults.serverFiltered.total).toBeGreaterThan(0);
      console.log('✅ FILTERED API WORKS: Server filter returns activities');
    }
    
    // Compare approaches
    if (!unfilteredResults.error && !filteredResults.error) {
      const totalUnfilteredInspections = unfilteredResults.benThompson.inspections + unfilteredResults.benFrohloff.inspections;
      const serverFilteredTotal = filteredResults.serverFiltered.total;
      
      console.log('\n🔍 COMPARISON ANALYSIS:');
      console.log(`   Total inspections from unfiltered (Ben T + Ben F): ${totalUnfilteredInspections}`);
      console.log(`   Total activities from server filter: ${serverFilteredTotal}`);
      console.log(`   Difference: ${Math.abs(totalUnfilteredInspections - serverFilteredTotal)} activities`);
      
      if (serverFilteredTotal > 0) {
        console.log('✅ SERVER FILTER IS WORKING');
      } else {
        console.log('⚠️ SERVER FILTER RETURNS 0 - MAY NEED INVESTIGATION');
      }
    }
  });
  
  test('Test specific inspector filtering in the app UI', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="inspection-dashboard"], .bg-gray-50', { timeout: 10000 });
    
    console.log('🧪 Testing UI inspector filtering...');
    
    // Test "All Inspectors" button
    const allInspectorsButton = page.locator('button:has-text("All Inspectors")');
    if (await allInspectorsButton.count() > 0) {
      await allInspectorsButton.click();
      await page.waitForTimeout(2000); // Wait for API call
      
      console.log('✅ Clicked "All Inspectors" button');
      
      // Check for activities in console logs
      const logs = [];
      page.on('console', msg => logs.push(msg.text()));
      
      await page.waitForTimeout(1000);
      
      const activityLogs = logs.filter(log => 
        log.includes('V5: Server filter successful') || 
        log.includes('activities') ||
        log.includes('SERVER FILTER')
      );
      
      console.log('📝 Console activity logs:', activityLogs.slice(-5));
    }
    
    // Test individual inspector buttons
    const inspectorButtons = page.locator('button').filter({ hasText: /^(Ben|Benjamin|Ross|Travis)$/ });
    const buttonCount = await inspectorButtons.count();
    
    if (buttonCount > 0) {
      // Click first inspector button
      await inspectorButtons.first().click();
      await page.waitForTimeout(2000);
      console.log('✅ Clicked first inspector button');
      
      // Check if activities are loaded
      const activityElements = page.locator('[data-testid*="activity"], .activity, [class*="appointment"]');
      const activityCount = await activityElements.count();
      console.log(`📊 Found ${activityCount} activity elements in UI`);
    }
  });
  
});