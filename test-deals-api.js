// Test script for Pipedrive deals API integration
// NOTE: This test fails in Node.js because import.meta.env is not available
// The API works correctly in the browser through React/Vite
// To test: Use the Deals Debug Console in the app footer

import { 
  fetchDealsWithFilter, 
  getDealsForRegion,
  getRecommendationDeals,
  healthCheckDeals,
  REGIONAL_DEAL_FILTERS 
} from './src/api/pipedriveDeals.js';

async function testDealsAPI() {
  console.log('🧪 Testing Pipedrive Deals API Integration\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing API health check...');
    const health = await healthCheckDeals();
    console.log('Health check result:', health);
    console.log('');

    // Test 2: Fetch deals with R1 filter
    console.log('2️⃣ Testing R1 regional filter (ID: 222491)...');
    const r1Result = await fetchDealsWithFilter(222491, { limit: 10 });
    console.log(`Found ${r1Result.deals?.length || 0} deals with R1 filter`);
    
    if (r1Result.deals && r1Result.deals.length > 0) {
      console.log('Sample deal:', {
        id: r1Result.deals[0].id,
        title: r1Result.deals[0].title,
        value: r1Result.deals[0].value,
        address: r1Result.deals[0].address,
        person: r1Result.deals[0].person?.name
      });
    }
    console.log('');

    // Test 3: Get deals for Logan region
    console.log('3️⃣ Testing getDealsForRegion for Logan...');
    const loganDeals = await getDealsForRegion('Logan', { limit: 5 });
    console.log(`Found ${loganDeals?.length || 0} deals for Logan region`);
    console.log('');

    // Test 4: Get recommendation deals
    console.log('4️⃣ Testing getRecommendationDeals...');
    const recommendationDeals = await getRecommendationDeals('Logan');
    console.log(`Found ${recommendationDeals?.length || 0} suitable deals for recommendations`);
    
    if (recommendationDeals && recommendationDeals.length > 0) {
      console.log('Sample recommendation deal:', {
        title: recommendationDeals[0].title,
        value: recommendationDeals[0].value,
        priority: recommendationDeals[0].priority,
        hasAddress: !!recommendationDeals[0].address,
        hasCoordinates: !!recommendationDeals[0].coordinates
      });
    }
    console.log('');

    // Test 5: Show regional filter configuration
    console.log('5️⃣ Regional filter configuration:');
    Object.entries(REGIONAL_DEAL_FILTERS).forEach(([key, filter]) => {
      console.log(`${key}: Filter ${filter.filterId} - ${filter.name}`);
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Make sure VITE_PIPEDRIVE_API_KEY is configured in your .env file');
  }
}

// Run the test
testDealsAPI();