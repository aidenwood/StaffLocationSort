#!/usr/bin/env node
/**
 * Debug script to test Pipedrive V2 Activities API with filter_id
 * Run: VITE_PIPEDRIVE_API_KEY=your_token node debug-v2-activities.js
 * Or: add API key to .env and run with dotenv
 */
const FILTER_ID = 215315;
const API_KEY = process.env.VITE_PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_KEY;

async function fetchV2Activities() {
  const url = `https://api.pipedrive.com/v2/activities?filter_id=${FILTER_ID}&limit=500&api_token=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function main() {
  console.log('🧪 Testing Pipedrive V2 Activities API');
  console.log('   Filter ID:', FILTER_ID);
  console.log('   Endpoint: GET https://api.pipedrive.com/v2/activities');
  console.log('---');

  if (!API_KEY) {
    console.error('❌ Set VITE_PIPEDRIVE_API_KEY or PIPEDRIVE_API_KEY');
    process.exit(1);
  }

  try {
    const data = await fetchV2Activities();
    const activities = data.data || [];
    const nextCursor = data.additional_data?.next_cursor;

    console.log('\n✅ Success');
    console.log('   Activities:', activities.length);
    if (nextCursor) console.log('   More pages: next_cursor present');

    if (activities.length > 0) {
      console.log('\nFirst 3 activities:');
      activities.slice(0, 3).forEach((a, i) => {
        const owner = a.owner_id ?? a.user_id;
        console.log(`  ${i + 1}. ${a.subject} | owner_id: ${owner} | due: ${a.due_date} ${a.due_time}`);
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) console.error('   Status:', err.response.status);
  }
}

main();
