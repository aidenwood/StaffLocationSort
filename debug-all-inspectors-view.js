// Debug script for All Inspectors view - run in browser console

console.log('🔍 DEBUGGING ALL INSPECTORS VIEW...');

// Check current state
console.log('Current app state:', {
  selectedInspector: window.React?.version, // Just checking if React is available
  activities: window.debugActivitiesV5Filtered?.length || 'Not found'
});

// Test the hook directly
const debugAllInspectorsView = async () => {
  try {
    console.log('\n📊 Testing All Inspectors data fetching...');
    
    // Import the hook and API functions
    const { fetchActivitiesByDateRange } = await import('./src/api/pipedriveRead.js');
    
    // Test the proven working approach for All Inspectors
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const oneWeekFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    console.log('📅 Testing date range:', {
      start: oneWeekAgo.toISOString().split('T')[0],
      end: oneWeekFromNow.toISOString().split('T')[0]
    });
    
    // Use the proven working V0 approach
    const allActivities = await fetchActivitiesByDateRange(
      oneWeekAgo.toISOString().split('T')[0],
      oneWeekFromNow.toISOString().split('T')[0]
    );
    
    console.log(`✅ V0 Method: ${allActivities.length} total activities retrieved`);
    
    // Filter for Property Inspections
    const propertyInspections = allActivities.filter(activity => {
      const subject = activity.subject || '';
      return subject.toLowerCase().includes('property inspection');
    });
    
    console.log(`🏠 Property Inspections: ${propertyInspections.length} found`);
    
    // Transform to app format
    const { transformPipedriveActivity } = await import('./src/api/pipedriveRead.js');
    const transformedActivities = allActivities
      .map(transformPipedriveActivity)
      .filter(activity => activity !== null);
    
    console.log(`🔄 Transformed: ${transformedActivities.length} activities for app`);
    
    // Group by inspector for All Inspectors view
    const activitiesByInspector = {};
    transformedActivities.forEach(activity => {
      const inspectorId = activity.owner_id || activity.creator_user_id || 'unknown';
      if (!activitiesByInspector[inspectorId]) {
        activitiesByInspector[inspectorId] = [];
      }
      activitiesByInspector[inspectorId].push(activity);
    });
    
    console.log('👥 Activities by Inspector:', Object.keys(activitiesByInspector).map(id => ({
      inspectorId: id,
      count: activitiesByInspector[id].length,
      sampleActivity: activitiesByInspector[id][0]?.subject
    })));
    
    // Store results for inspection
    window.debugAllInspectorsData = {
      allActivities,
      propertyInspections,
      transformedActivities,
      activitiesByInspector
    };
    
    console.log('💾 Results stored in window.debugAllInspectorsData');
    
    return {
      total: allActivities.length,
      inspections: propertyInspections.length,
      transformed: transformedActivities.length,
      inspectors: Object.keys(activitiesByInspector).length
    };
    
  } catch (error) {
    console.error('❌ All Inspectors debugging failed:', error);
    return { error: error.message };
  }
};

// Auto-run if in browser
if (typeof window !== 'undefined') {
  debugAllInspectorsView().then(result => {
    console.log('\n📈 FINAL RESULTS:', result);
  });
} else {
  console.log('Run this in the browser console');
}