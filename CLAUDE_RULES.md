# Claude Rules for StaffLocationSort Project

## Project Context
This is a Pipedrive-integrated staff scheduling dashboard for roof inspections in Logan, QLD area.

## Critical Rules

### 0. ABSOLUTE RULES - NEVER VIOLATE
1. **NO MOCK DATA EVER** - Show empty state with overlay, never fake data
2. **Vite env vars ONLY work in browser** - `import.meta.env` fails in Node.js scripts
3. **Filter 215315 EXISTS and is SHARED** - Filter is configured correctly in Pipedrive (Subject contains "Property Inspection", does not start with "TO BOOK")
4. **Remove fetchActivities from useEffect deps** - Causes infinite loops
5. **No data = greyed overlay with "Data not available" text** - Show UI structure with overlay, not blank
6. **Filter 215315 MUST return 188 activities** - This is the expected result. If it returns 0, the API call is failing, NOT the filter
7. **V2 API FIXED to return UPCOMING activities** - Use `updated_since` parameter (RFC3339 format) to avoid 500 activity limit. NO `start_date`/`end_date` params in V2!

### 1. Pipedrive API Integration
**V2 API DATE FILTERING (CORRECT APPROACH):**
```javascript
// ✅ WORKING: V2 API with proper date filtering
const params = {
  filter_id: 215315,
  limit: 500,
  sort_by: 'due_date',
  sort_direction: 'desc',
  updated_since: '2026-02-01T00:00:00Z' // RFC3339 format
};
```

**V2 API RULES:**
- ✅ Use `updated_since` parameter (RFC3339 format: YYYY-MM-DDTHH:MM:SSZ)  
- ✅ Use `updated_until` parameter if needed
- ❌ NO `start_date`/`end_date` params (causes 400 error)
- ✅ Client-side filter by `due_date` after fetch

**FALLBACK APPROACH (If V2 fails):**
```javascript
// ✅ PROVEN: Returns 47+ activities in testing  
const activities = await fetchActivitiesByDateRange(startDate, endDate, userId);
const propertyInspections = activities.filter(activity => {
  const subject = activity.subject || '';
  return subject.toLowerCase().includes('property inspection');
});
```

**FORBIDDEN APPROACHES:**
- ❌ `start_date`/`end_date` params in V2 API
- ❌ Smart fallbacks (add complexity)
- ❌ Mock data (production requires real data)

### 2. File Structure Rules
**Single Source of Truth:**
- Use `src/components/InspectionDashboard.jsx` (not versioned files)
- Use `src/hooks/usePipedriveData.js` (not versioned hooks)
- Delete all V0-V5 versions when encountered

**Forbidden Files:**
- InspectionDashboardV[0-5].jsx
- usePipedriveDataV[0-5].js

### 3. Development Priorities
1. **Activities must display** - This is non-negotiable
2. **Use proven working code** - No experimental approaches
3. **Real data only** - No mock data for production
4. **Simple implementations** - Avoid complex logic

### 4. API Error Handling
- Show error states instead of fallbacks
- Log API calls for debugging
- Use 3-second timeout detection
- Never silently fail to mock data

### 5. Code Quality
- Remove unused imports and functions
- Keep single responsibility principle
- Use consistent naming (no version suffixes)
- Preserve working functionality when refactoring

## Current Working Configuration
- **Hook**: usePipedriveData.js with V0 approach
- **Component**: InspectionDashboard.jsx (consolidated)
- **API Function**: fetchActivitiesByDateRange()
- **Filter**: Client-side "property inspection" filtering

## Production Deployment Rules
- Must display real activities from Pipedrive
- No fallback to mock data
- Error states should be user-friendly
- Performance: < 3 seconds API response time

## When Making Changes
1. Always test with real Pipedrive data
2. Preserve the working V0 approach
3. Remove complexity, don't add it
4. Focus on activities displaying first
5. Clean up unused files immediately