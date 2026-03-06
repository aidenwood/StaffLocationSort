import { test, expect } from '@playwright/test';

test('Debug Benjamin Wharton activities specifically', async ({ page }) => {
  await page.goto('http://localhost:5173');
  console.log('📱 Navigated to app');
  
  // Wait for any select elements to load
  await page.waitForSelector('select', { timeout: 8000 });
  console.log('🔍 Select elements found');
  
  // Find all selects and pick the one with inspectors
  const selects = await page.$$('select');
  console.log(`Found ${selects.length} select elements`);
  
  // Try to select Benjamin Wharton (ID 2) by trying different approaches
  try {
    await page.selectOption('select:has(option[value="2"])', '2');
    console.log('✅ Selected Benjamin Wharton via value match');
  } catch (e1) {
    try {
      // Try selecting the second select (inspector dropdown)
      if (selects.length >= 2) {
        await selects[1].selectOption('2');
        console.log('✅ Selected Benjamin Wharton via second select element');
      }
    } catch (e2) {
      console.log('⚠️ Could not select Benjamin Wharton, proceeding with current state');
    }
  }
  
  // Wait for any API calls
  await page.waitForTimeout(4000);
  
  // Get activities from window
  const debugInfo = await page.evaluate(() => {
    const activities = window.debugActivities || [];
    const whartonActivities = activities.filter(a => a.owner_id === 2);
    
    return {
      totalActivities: activities.length,
      whartonTotal: whartonActivities.length,
      whartonActivities: whartonActivities.map(a => ({
        id: a.id,
        subject: a.subject,
        due_date: a.due_date,
        due_time: a.due_time,
        done: a.done,
        owner_id: a.owner_id
      }))
    };
  });
  
  console.log('\n=== BENJAMIN WHARTON DEBUG ===');
  console.log('Total activities in system:', debugInfo.totalActivities);
  console.log('Wharton\'s activities:', debugInfo.whartonTotal);
  
  // Search for the specific Golden Beach activity user mentioned
  const goldenBeachActivity = debugInfo.whartonActivities.find(a => 
    a.subject && a.subject.includes('Golden Beach')
  );
  if (goldenBeachActivity) {
    console.log('\n🏖️ FOUND GOLDEN BEACH ACTIVITY:');
    console.log('Date:', goldenBeachActivity.due_date);
    console.log('Time:', goldenBeachActivity.due_time);
    console.log('Subject:', goldenBeachActivity.subject);
  } else {
    console.log('\n❌ Golden Beach activity not found for Wharton');
    
    // Search all activities for Golden Beach
    const debugAllActivities = await page.evaluate(() => {
      return (window.debugActivities || [])
        .filter(a => a.subject && a.subject.includes('Golden Beach'))
        .map(a => ({
          owner_id: a.owner_id,
          due_date: a.due_date,
          due_time: a.due_time,
          subject: a.subject
        }));
    });
    
    if (debugAllActivities.length > 0) {
      console.log('🔍 Found Golden Beach in other inspectors:');
      debugAllActivities.forEach(activity => {
        console.log(`- Owner ${activity.owner_id}: ${activity.due_date} ${activity.due_time} - ${activity.subject}`);
      });
    } else {
      console.log('🔍 No Golden Beach activities found at all');
    }
  }
  
  if (debugInfo.whartonActivities.length > 0) {
    console.log('\nWharton\'s activities by date:');
    const byDate = {};
    
    debugInfo.whartonActivities.forEach(activity => {
      if (!byDate[activity.due_date]) {
        byDate[activity.due_date] = [];
      }
      byDate[activity.due_date].push(activity);
    });
    
    Object.keys(byDate).sort().forEach(date => {
      console.log(`\n📅 ${date} (${byDate[date].length} activities):`);
      byDate[date].forEach((activity, i) => {
        console.log(`  ${i+1}. ${activity.due_time || 'NO TIME'} - ${activity.subject} (done: ${activity.done})`);
      });
    });
    
    // Check for specific dates user mentioned for Wharton
    const march2 = byDate['2026-03-02'] || [];
    const march3 = byDate['2026-03-03'] || [];
    const march4 = byDate['2026-03-04'] || [];
    const march5 = byDate['2026-03-05'] || [];
    const march6 = byDate['2026-03-06'] || [];
    
    console.log('\n=== USER EXPECTED RESULTS FOR WHARTON ===');
    console.log('March 2nd (expected 2 inspections):', march2.length, 'activities found');
    console.log('March 3rd (expected 3 inspections):', march3.length, 'activities found'); 
    console.log('March 4th (expected 3 inspections):', march4.length, 'activities found');
    console.log('March 5th (expected 4 inspections):', march5.length, 'activities found');
    console.log('March 6th (expected 1 inspection):', march6.length, 'activities found');
    
    // Look for inspection patterns
    const inspectionKeywords = ['inspection', 'property', 'wharton'];
    
    console.log('\n=== PATTERN ANALYSIS ===');
    debugInfo.whartonActivities.forEach(activity => {
      const subject = activity.subject?.toLowerCase() || '';
      const hasInspection = inspectionKeywords.some(keyword => subject.includes(keyword));
      
      if (hasInspection) {
        console.log(`🎯 MATCH: ${activity.due_date} ${activity.due_time} - ${activity.subject}`);
      }
    });
  } else {
    console.log('❌ No activities found for Benjamin Wharton');
  }
});