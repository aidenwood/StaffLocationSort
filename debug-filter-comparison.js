// Debug script to compare filtered vs unfiltered API calls
// Run this in the browser console when the app is loaded

console.log('🔍 DEBUGGING FILTER COMPARISON...');

// Import the API functions
const testFilterComparison = async () => {
  try {
    // Import API functions dynamically
    const { 
      fetchUserActivities, 
      fetchActivitiesWithFilter,
      fetchTransformedActivities 
    } = await import('./src/api/pipedriveRead.js');

    console.log('\n📊 Testing API approaches...');
    
    // Test 1: Unfiltered approach (V0 style) - get all activities for Ben Thompson
    console.log('\n1️⃣ TESTING UNFILTERED (V0 approach)...');
    const unfilteredActivities = await fetchUserActivities(2); // Ben Thompson's user ID
    console.log(`✅ UNFILTERED: ${unfilteredActivities.length} total activities for user 2`);
    
    // Count Property Inspections manually
    const propertyInspections = unfilteredActivities.filter(activity => {
      const subject = activity.subject || '';
      return subject.toLowerCase().includes('property inspection');
    });
    console.log(`🏠 Property Inspections in unfiltered: ${propertyInspections.length}`);
    
    // Test 2: Filtered approach (V5 style) 
    console.log('\n2️⃣ TESTING FILTERED (V5 approach)...');
    const filteredActivities = await fetchActivitiesWithFilter(215315);
    console.log(`✅ FILTERED: ${filteredActivities.length} total activities with filter 215315`);
    
    // Test 3: Try a different date range
    console.log('\n3️⃣ TESTING FILTERED WITH DATE RANGE...');
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateFilteredActivities = await fetchActivitiesWithFilter(215315, today, nextWeek);
    console.log(`✅ DATE FILTERED: ${dateFilteredActivities.length} activities (${today} to ${nextWeek})`);
    
    // Summary
    console.log('\n📈 COMPARISON SUMMARY:');
    console.log(`   Unfiltered (user 2): ${unfilteredActivities.length} activities`);
    console.log(`   Property Inspections: ${propertyInspections.length} activities`);
    console.log(`   Server Filter (all): ${filteredActivities.length} activities`);
    console.log(`   Server Filter (7 days): ${dateFilteredActivities.length} activities`);
    console.log(`   Missing: ${propertyInspections.length - filteredActivities.length} activities from server filter`);
    
    // Store results for further inspection
    window.debugResults = {
      unfiltered: unfilteredActivities,
      propertyInspections,
      filtered: filteredActivities,
      dateFiltered: dateFilteredActivities
    };
    
    console.log('\n💾 Results stored in window.debugResults for inspection');
    
  } catch (error) {
    console.error('❌ Filter comparison failed:', error);
  }
};

// Auto-run if in browser
if (typeof window !== 'undefined') {
  testFilterComparison();
} else {
  console.log('Run this in the browser console after the app loads');
}