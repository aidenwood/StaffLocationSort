// Count total activities available in Pipedrive filter 215315
const API_TOKEN = '51097810cd3328e8bc27ee01352b287d4d9f39a1';
const BASE_URL = 'https://api.pipedrive.com/v1';
const FILTER_ID_OLD = 215315;
const FILTER_ID_BEN = 215319; // Ben's activities filter

async function countFilterActivities() {
  console.log(`🔍 Testing API access and counting activities...\n`);
  
  try {
    // First test: Check filters/helpers
    console.log('1. Testing filters/helpers endpoint...');
    const helpersResponse = await fetch(`${BASE_URL}/filters/helpers?api_token=${API_TOKEN}`);
    const helpersData = await helpersResponse.json();
    
    if (helpersData.success) {
      console.log('✅ Filters/helpers endpoint working');
      console.log(`   Available filter types: ${Object.keys(helpersData.data || {}).join(', ')}`);
    } else {
      console.log('❌ Filters/helpers error:', helpersData.error);
    }
    
    // Second test: All activities without filter
    console.log('\n2. Testing all activities (no filter)...');
    let allActivitiesResponse = await fetch(`${BASE_URL}/activities?api_token=${API_TOKEN}&limit=10`);
    let allActivitiesData = await allActivitiesResponse.json();
    
    if (allActivitiesData.success) {
      console.log(`✅ Total activities available: ${allActivitiesData.additional_data?.pagination?.total_count || 'unknown'}`);
      console.log(`   Sample: ${allActivitiesData.data?.length || 0} activities`);
      
      if (allActivitiesData.data?.length > 0) {
        console.log('\n   Sample activity subjects:');
        allActivitiesData.data.slice(0, 5).forEach((a, i) => {
          console.log(`     ${i+1}. "${a.subject}" (${a.due_date || 'No date'})`);
        });
        
        const propertyInspections = allActivitiesData.data.filter(a => 
          a.subject?.toLowerCase().includes('property inspection')
        );
        console.log(`\n   Property Inspections in sample: ${propertyInspections.length}`);
        
        // Check for different variations
        const inspectionVariations = allActivitiesData.data.filter(a => 
          a.subject?.toLowerCase().includes('inspection')
        );
        console.log(`   Any "inspection" activities: ${inspectionVariations.length}`);
      }
    } else {
      console.log('❌ Error accessing activities:', allActivitiesData.error);
      return;
    }
    
    // Third test: Filter 215315 (old)
    console.log(`\n3. Testing filter ${FILTER_ID_OLD} (API owner inspections)...`);
    await testFilter(FILTER_ID_OLD);
    
    // Fourth test: Validate specific filters exist
    console.log(`\n4. Validating filter ${FILTER_ID_OLD} exists...`);
    await validateFilterExists(FILTER_ID_OLD);
    
    console.log(`\n5. Validating filter ${FILTER_ID_BEN} exists...`);
    await validateFilterExists(FILTER_ID_BEN);
    
    // Fifth test: Filter 215319 (Ben's activities)  
    console.log(`\n6. Testing filter ${FILTER_ID_BEN} (Ben's activities)...`);
    await testFilter(FILTER_ID_BEN);
    
  } catch (error) {
    console.error('❌ Error testing activities:', error.message);
  }
}

async function testFilter(filterId) {
  try {
    let totalCount = 0;
    let start = 0;
    const limit = 100; // Smaller batch for testing
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(
        `${BASE_URL}/activities?api_token=${API_TOKEN}&filter_id=${filterId}&limit=${limit}&start=${start}`
      );
      
      const data = await response.json();
      
      if (!data.success) {
        console.log(`❌ API Error for filter ${filterId}:`, data.error);
        break;
      }
      
      const batchCount = data.data?.length || 0;
      totalCount += batchCount;
      
      console.log(`   📦 Batch ${Math.floor(start/limit) + 1}: ${batchCount} activities (total: ${totalCount})`);
      
      // Show sample activities from first batch
      if (start === 0 && batchCount > 0) {
        console.log('   Sample activities:');
        data.data.slice(0, 3).forEach((activity, i) => {
          console.log(`     ${i+1}. "${activity.subject}" (${activity.due_date || 'No date'})`);
        });
      }
      
      start += limit;
      
      // Check if there are more results
      const pagination = data.additional_data?.pagination;
      hasMore = pagination?.more_items_in_collection === true;
      
      if (batchCount === 0) {
        hasMore = false;
      }
    }
    
    console.log(`   ✅ Total activities in filter ${filterId}: ${totalCount}`);
    
    if (totalCount > 0) {
      if (totalCount < 100) {
        console.log('   🟢 Small dataset - safe to cache all activities');
      } else if (totalCount < 500) {
        console.log('   🟡 Medium dataset - consider partial caching by date range');
      } else {
        console.log('   🔴 Large dataset - implement pagination and selective caching');
      }
    }
    
  } catch (error) {
    console.error(`❌ Error testing filter ${filterId}:`, error.message);
  }
}

async function validateFilterExists(filterId) {
  try {
    const response = await fetch(`${BASE_URL}/filters/${filterId}?api_token=${API_TOKEN}`);
    const data = await response.json();
    
    if (data.success) {
      console.log(`   ✅ Filter ${filterId} exists: "${data.data.name}"`);
      console.log(`   Type: ${data.data.type}, Conditions: ${JSON.stringify(data.data.conditions).length > 100 ? '[Complex]' : JSON.stringify(data.data.conditions)}`);
    } else {
      console.log(`   ❌ Filter ${filterId} not found:`, data.error);
    }
  } catch (error) {
    console.log(`   ❌ Error validating filter ${filterId}:`, error.message);
  }
}

countFilterActivities();