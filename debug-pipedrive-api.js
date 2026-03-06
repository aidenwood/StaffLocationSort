// Debug Pipedrive API Connection and Filters
import fetch from 'node-fetch';

const API_TOKEN = '51097810cd3328e8bc27ee01352b287d4d9f39a1';
const BASE_URL = 'https://api.pipedrive.com/v1';

async function testPipedriveConnection() {
  console.log('🔍 Testing Pipedrive API Connection...\n');
  
  try {
    // 1. Test basic connection
    console.log('1. Testing basic API connection...');
    const userResponse = await fetch(`${BASE_URL}/users?api_token=${API_TOKEN}`);
    const userData = await userResponse.json();
    
    if (userData.success) {
      console.log('✅ API Connection successful');
      console.log(`   Found ${userData.data?.length || 0} users`);
    } else {
      console.log('❌ API Connection failed:', userData.error);
      return;
    }

    // 2. Test activities endpoint
    console.log('\n2. Testing activities endpoint...');
    const activitiesResponse = await fetch(`${BASE_URL}/activities?api_token=${API_TOKEN}&limit=10`);
    const activitiesData = await activitiesResponse.json();
    
    if (activitiesData.success) {
      console.log('✅ Activities endpoint working');
      console.log(`   Total activities available: ${activitiesData.additional_data?.pagination?.total_count || 'unknown'}`);
      console.log(`   Sample activities: ${activitiesData.data?.length || 0}`);
      
      // Show sample activity subjects
      if (activitiesData.data?.length > 0) {
        console.log('   Sample subjects:');
        activitiesData.data.slice(0, 3).forEach((activity, i) => {
          console.log(`     ${i+1}. ${activity.subject || 'No subject'}`);
        });
      }
    } else {
      console.log('❌ Activities endpoint failed:', activitiesData.error);
    }

    // 3. Test filters endpoint
    console.log('\n3. Testing filters endpoint...');
    const filtersResponse = await fetch(`${BASE_URL}/filters?api_token=${API_TOKEN}&type=activity`);
    const filtersData = await filtersResponse.json();
    
    if (filtersData.success) {
      console.log('✅ Filters endpoint working');
      console.log(`   Found ${filtersData.data?.length || 0} activity filters`);
      
      if (filtersData.data?.length > 0) {
        console.log('   Available filters:');
        filtersData.data.forEach((filter, i) => {
          console.log(`     ${i+1}. ID: ${filter.id}, Name: "${filter.name}"`);
        });
        
        // Check if filter 215256 exists
        const targetFilter = filtersData.data.find(f => f.id === 215256);
        if (targetFilter) {
          console.log(`\n✅ Filter 215256 found: "${targetFilter.name}"`);
        } else {
          console.log('\n❌ Filter 215256 not found in available filters');
        }
      }
    } else {
      console.log('❌ Filters endpoint failed:', filtersData.error);
    }

    // 4. Test specific filter 215256
    console.log('\n4. Testing specific filter 215256...');
    const specificFilterResponse = await fetch(`${BASE_URL}/filters/215256?api_token=${API_TOKEN}`);
    const specificFilterData = await specificFilterResponse.json();
    
    if (specificFilterData.success) {
      console.log('✅ Filter 215256 accessible');
      console.log(`   Name: "${specificFilterData.data?.name}"`);
      console.log(`   Type: ${specificFilterData.data?.type}`);
    } else {
      console.log('❌ Filter 215256 not accessible:', specificFilterData.error);
    }

    // 5. Try fetching activities with Property Inspection in subject
    console.log('\n5. Testing activities with Property Inspection filter...');
    const propertyActivitiesResponse = await fetch(
      `${BASE_URL}/activities?api_token=${API_TOKEN}&limit=50&start=0`
    );
    const propertyActivitiesData = await propertyActivitiesResponse.json();
    
    if (propertyActivitiesData.success) {
      const propertyActivities = propertyActivitiesData.data?.filter(activity => 
        activity.subject?.toLowerCase().includes('property inspection')
      ) || [];
      
      console.log(`✅ Found ${propertyActivities.length} activities with 'Property Inspection' in subject`);
      
      if (propertyActivities.length > 0) {
        console.log('   Sample Property Inspection activities:');
        propertyActivities.slice(0, 5).forEach((activity, i) => {
          console.log(`     ${i+1}. ${activity.subject} (${activity.due_date || 'No date'})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error testing Pipedrive API:', error.message);
  }
}

testPipedriveConnection();