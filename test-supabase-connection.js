#!/usr/bin/env node

// Test Supabase connection and roster functionality
import { supabase, rosterApi } from './src/lib/supabase.js';

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase Connection and Roster API...\n');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('inspector_roster')
      .select('count(*)', { count: 'exact' });
    
    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message);
      return;
    }
    
    console.log('✅ Connected to Supabase successfully');
    console.log(`📊 Current roster records: ${connectionTest[0]?.count || 0}\n`);

    // Test 2: Get roster data for current week
    console.log('2. Testing roster data retrieval...');
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday
    
    const rosterData = await rosterApi.getRosterData(
      startOfWeek.toISOString().split('T')[0],
      endOfWeek.toISOString().split('T')[0]
    );
    
    console.log(`✅ Retrieved ${rosterData.length} roster records for this week`);
    if (rosterData.length > 0) {
      console.log('📋 Sample record:', rosterData[0]);
    }
    console.log();

    // Test 3: Test roster assignment update
    console.log('3. Testing roster assignment update...');
    const testInspectorId = 1;
    const testInspectorName = 'Test Inspector';
    const testDate = new Date().toISOString().split('T')[0];
    const testRegionCode = 'R01';
    const testRegionName = 'R01 - Brisbane/Logan/Ipswich';
    
    const updateResult = await rosterApi.updateRosterAssignment(
      testInspectorId,
      testInspectorName,
      testDate,
      testRegionCode,
      testRegionName,
      'working',
      'Test assignment from script'
    );

    if (updateResult.success) {
      console.log('✅ Roster assignment update successful');
      console.log('📝 Updated record:', updateResult.data);
    } else {
      console.log('❌ Roster assignment update failed:', updateResult.error);
    }
    console.log();

    // Test 4: Verify the update by querying back
    console.log('4. Verifying the roster assignment...');
    const verifyData = await rosterApi.getRosterData(testDate, testDate, testInspectorId);
    if (verifyData.length > 0) {
      console.log('✅ Assignment verified in database');
      console.log('🔍 Retrieved record:', verifyData[0]);
    } else {
      console.log('❌ Assignment not found in database');
    }
    console.log();

    // Test 5: Clean up test data
    console.log('5. Cleaning up test data...');
    const deleteResult = await rosterApi.deleteRosterAssignment(testInspectorId, testDate);
    if (deleteResult.success) {
      console.log('✅ Test data cleaned up successfully');
    } else {
      console.log('❌ Failed to clean up test data:', deleteResult.error);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSupabaseConnection();
}

export { testSupabaseConnection };