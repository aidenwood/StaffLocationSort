import { test, expect } from '@playwright/test';

test('Debug real Pipedrive data structure and dates', async ({ page }) => {
  // Go to the app (use 5174 as 5173 is in use)
  await page.goto('http://localhost:5174');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Get console logs to see the data structure
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });
  
  // Debug: Check what selects are available
  const selects = await page.$$('select');
  console.log('Found selects:', selects.length);
  
  // Check both selects to understand which is which
  for (let i = 0; i < selects.length; i++) {
    const options = await selects[i].$$eval('option', options => 
      options.map(option => ({ value: option.value, text: option.textContent }))
    );
    console.log(`Select ${i + 1} options:`, options);
  }
  
  // The second select should be the inspector selector
  if (selects.length >= 2) {
    console.log('Using second select for inspector selection...');
    
    // Select Benjamin Frohloff - first try with value 1 (app ID), then 23088469 (Pipedrive ID)
    try {
      await page.selectOption('select:nth-of-type(2)', '1');
      console.log('Successfully selected inspector with ID 1');
    } catch (e) {
      try {
        await page.selectOption('select:nth-of-type(2)', '23088469');
        console.log('Successfully selected inspector with Pipedrive ID 23088469');
      } catch (e2) {
        console.log('Failed to select inspector with both IDs, trying first available...');
        await page.selectOption('select:nth-of-type(2)', { index: 1 }); // Select first non-empty option
      }
    }
  } else {
    console.log('Less than 2 selects found');
  }
  
  // Wait for API call to complete
  await page.waitForTimeout(3000);
  
  // Get activities data from the page
  const activities = await page.evaluate(() => {
    // Try to access the activities from the global scope or window
    return window.debugActivities || [];
  });
  
  console.log('\n=== PIPEDRIVE DEBUG ANALYSIS ===');
  console.log('Total activities found:', activities.length);
  
  if (activities.length > 0) {
    const firstActivity = activities[0];
    console.log('\nFirst activity structure:');
    console.log('- ID:', firstActivity.id);
    console.log('- owner_id:', firstActivity.owner_id);
    console.log('- due_date:', firstActivity.due_date);
    console.log('- due_time:', firstActivity.due_time);
    console.log('- subject:', firstActivity.subject);
    console.log('- done:', firstActivity.done);
    
    // Check all unique dates
    const uniqueDates = [...new Set(activities.map(a => a.due_date))].sort();
    console.log('\nAll activity dates in Pipedrive:');
    uniqueDates.forEach(date => {
      const count = activities.filter(a => a.due_date === date).length;
      console.log(`- ${date}: ${count} activities`);
    });
    
    // Check today and tomorrow specifically
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 48*60*60*1000).toISOString().split('T')[0];
    
    console.log('\nSpecific date checks:');
    console.log(`Today (${today}):`, activities.filter(a => a.due_date === today).length);
    console.log(`Tomorrow (${tomorrow}):`, activities.filter(a => a.due_date === tomorrow).length);
    console.log(`Day after (${dayAfter}):`, activities.filter(a => a.due_date === dayAfter).length);
    
    // Check Ben F specifically
    const benActivities = activities.filter(a => a.owner_id === 1);
    console.log(`\nBenjamin Frohloff (owner_id: 1) activities:`, benActivities.length);
    
    // Look for van service and Newcastle activities
    const vanActivities = activities.filter(a => 
      a.subject && a.subject.toLowerCase().includes('van')
    );
    console.log('Van service activities:', vanActivities.length);
    
    const newcastleActivities = activities.filter(a => 
      a.subject && (a.subject.toLowerCase().includes('newcastle') || a.subject.toLowerCase().includes('cessnock'))
    );
    console.log('Newcastle/Cessnock activities:', newcastleActivities.length);
    
    // Print first few activities for Ben F
    console.log('\nBen F activities:');
    benActivities.slice(0, 5).forEach((activity, i) => {
      console.log(`${i+1}. ${activity.due_date} ${activity.due_time} - ${activity.subject}`);
    });
  }
  
  // Check console logs for our debug messages
  const relevantLogs = logs.filter(log => 
    log.includes('PIPEDRIVE API:') || 
    log.includes('activities count:') ||
    log.includes('DASHBOARD DEBUG:')
  );
  
  console.log('\n=== RELEVANT CONSOLE LOGS ===');
  relevantLogs.forEach(log => console.log(log));
  
  // Take screenshot for visual verification
  await page.screenshot({ path: 'debug-pipedrive-calendar.png', fullPage: true });
  console.log('\nScreenshot saved as debug-pipedrive-calendar.png');
});