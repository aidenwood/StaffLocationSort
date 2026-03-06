// Test V5 filtering with the corrected fallback
// This simulates what happens when the server filter fails

import { fetchActivitiesForInspectorV5 } from './src/api/pipedriveRead.js';
import { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } from './src/config/pipedriveFilters.js';

console.log('🔍 Testing V5 filtering with corrected fallback...');

// Test for Ben Thompson (user ID 2)
const testV5Filtering = async () => {
  try {
    console.log('\n📊 Testing fetchActivitiesForInspectorV5...');
    
    const activities = await fetchActivitiesForInspectorV5(
      2, // Ben Thompson's Pipedrive user ID
      'Ben Thompson', // Inspector name
      PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID, // Filter ID
      null, // Start date (null = no limit)
      null  // End date (null = no limit)
    );
    
    console.log(`✅ V5 returned ${activities.length} activities for Ben Thompson`);
    
    // Show first few activities
    activities.slice(0, 3).forEach((activity, i) => {
      console.log(`   ${i+1}. "${activity.subject}" on ${activity.due_date}`);
    });
    
  } catch (error) {
    console.error('❌ V5 test failed:', error.message);
    
    // Check if it's the function name error we just fixed
    if (error.message.includes('fetchActivitiesBasic')) {
      console.log('🔧 This is the function name error we just fixed!');
    }
  }
};

testV5Filtering();