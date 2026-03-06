// Quick API debug test
import { fetchActivitiesWithFilterV2 } from './src/api/pipedriveRead.js';
import { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } from './src/config/pipedriveFilters.js';

const testApi = async () => {
  console.log('🔍 Testing Simple API Connection...');
  console.log('Filter ID:', PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
  console.log('API Key configured:', !!process.env.VITE_PIPEDRIVE_API_KEY);
  
  try {
    console.log('📞 Making API call...');
    const activities = await fetchActivitiesWithFilterV2(
      PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID,
      null,
      null
    );
    
    console.log('✅ Success! Got', activities.length, 'activities');
    console.log('First 3 activities:', activities.slice(0, 3).map(a => ({
      id: a.id,
      subject: a.subject,
      due_date: a.due_date,
      user_id: a.user_id,
      owner_id: a.owner_id
    })));
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }
};

testApi();