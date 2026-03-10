# Intelligent Appointment Recommendation System

## Overview
Build a recommendation system that fetches ready-to-book deals from Pipedrive filters, calculates optimal routing using Google Distance Matrix API, and presents recommendations for each time slot.

## Architecture Components

### 1. API Layer - Pipedrive Deals Integration
**File**: `src/api/pipedriveDeals.js`

#### Functions to implement:
- `fetchDealsWithFilter(filterId)` - Fetch deals using regional filters
- `transformPipedriveDeal(deal)` - Extract address and relevant data from deal
- `enrichDealsWithAddresses(deals)` - Add geocoding to deals
- `getDealsForRegion(regionName)` - Get deals by inspector region

#### Features:
- Support for multiple regional filters (Logan, Brisbane, Gold Coast, etc.)
- Cache deals by region to minimize API calls
- Transform deal data to standard format for recommendations
- Handle rate limiting and error states

```javascript
// Example API structure
const dealData = {
  id: 12345,
  title: "Property Inspection - John Smith",
  address: "123 Main St, Logan QLD 4114",
  value: 450,
  priority: "high",
  person: {
    name: "John Smith",
    phone: "0412345678"
  },
  coordinates: { lat: -27.6378, lng: 153.1094 }
}
```

### 2. Distance Calculation Service
**File**: `src/services/distanceMatrix.js`

#### Enhancements to existing geocoding:
- Add `calculateDistanceMatrix(origins, destinations)` using Google Distance Matrix API
- Implement OD Cost Matrix calculation for batch processing
- Cache distance calculations to reduce API costs
- Support time-based routing (traffic at different appointment times)

#### Functions:
```javascript
calculateDistanceMatrix(origins, destinations, options = {})
calculateOptimalRoute(waypoints)
getCachedDistance(origin, destination)
```

### 3. Recommendation Engine
**File**: `src/services/recommendationEngine.js`

#### Core algorithm:
```javascript
calculateRecommendations(timeSlot, inspectorLocation, availableDeals)
```

#### Scoring factors:
- **Travel distance/time** from current location or previous appointment
- **Route optimization** between multiple appointments in the day
- **Deal priority/value** from Pipedrive (high value = higher score)
- **Time window constraints** (morning vs afternoon preferences)
- **Geographic clustering** (group nearby appointments)

#### Output:
- Top 3-5 recommendations per time slot
- Score breakdown for each recommendation
- Estimated travel times and route efficiency

### 4. Data Management Hook
**File**: `src/hooks/useRecommendations.js`

#### State management:
- Fetch deals based on selected inspector's region
- Update when inspector or date changes
- Background refresh every 5 minutes
- Loading states progression

#### Loading states:
1. "Fetching available deals..."
2. "Calculating optimal routes..." 
3. "Ready - 12 deals available"

#### Cache strategy:
- Cache by region + date combination
- Invalidate cache after 5 minutes
- Pre-fetch next/previous week in background

### 5. UI Components

#### A. Calendar Enhancement
**Update**: `src/components/InspectorCalendar.jsx`

##### Visual indicators on time slots:
- **Loading state**: Gray pill with "Downloading deals..."
- **Ready state**: Colored pill with count "5 deals nearby"
- **Color coding**: 
  - Green: 3+ excellent matches within 10km
  - Yellow: 1-2 good matches within 15km
  - Red: Limited options, 20km+ travel
  - Gray: No deals available

##### Implementation:
```jsx
{/* Add to time slot rendering */}
<div className="recommendation-pill">
  {recommendations.loading ? (
    <span className="text-xs text-gray-500">Loading...</span>
  ) : (
    <span className={`text-xs pill-${recommendations.quality}`}>
      {recommendations.count} deals
    </span>
  )}
</div>
```

#### B. Recommendation Modal
**New file**: `src/components/RecommendationModal.jsx`

##### Features:
- Opens when clicking on available time slot with recommendations
- Shows top 5 recommended deals sorted by score
- For each recommendation display:
  - Customer name and full address
  - Deal value and priority
  - Drive time from previous appointment
  - Route efficiency score
  - One-click "Book Appointment" action
  - Google Maps link for address verification

##### Modal structure:
```jsx
<RecommendationModal>
  <ModalHeader timeSlot={timeSlot} />
  <RecommendationList>
    {recommendations.map(deal => (
      <RecommendationCard 
        deal={deal} 
        onBook={() => bookAppointment(deal)}
        travelTime={deal.travelTime}
        score={deal.score}
      />
    ))}
  </RecommendationList>
</RecommendationModal>
```

#### C. Header Region Indicator
**Update**: `src/components/InspectionDashboard.jsx`

##### Add to header status area:
- Current region filter active (e.g., "Logan Region")
- Deal count for current region (e.g., "24 available deals")
- Last sync time and refresh button
- Recommendation system status (active/loading/error)

### 6. Configuration & Filters

#### Regional Filters Setup
**Update**: `src/config/pipedriveFilters.js`

```javascript
export const REGIONAL_FILTERS = {
  LOGAN: {
    filterId: 215316,
    name: "Logan Ready to Book",
    regions: ["Logan", "Logan Central", "Loganholme"]
  },
  BRISBANE: {
    filterId: 215317, 
    name: "Brisbane Ready to Book",
    regions: ["Brisbane", "Brisbane City", "South Brisbane"]
  },
  GOLD_COAST: {
    filterId: 215318,
    name: "Gold Coast Ready to Book", 
    regions: ["Gold Coast", "Southport", "Surfers Paradise"]
  }
}

export const getFilterForInspectorRegion = (inspectorId) => {
  const inspector = getInspectorById(inspectorId);
  const region = inspector?.region;
  return REGIONAL_FILTERS[region?.toUpperCase()] || REGIONAL_FILTERS.LOGAN;
}
```

#### Deal Filter Criteria (Server-side Pipedrive filters should include):
- Deal stage: "Ready to Book" or equivalent
- Activity type: No existing inspection scheduled
- Geographic region matching
- Deal value above minimum threshold
- Contact information available
- Property address available

### 7. Performance Optimizations

#### A. Lazy Loading Strategy:
- Load recommendations only for visible week
- Pre-fetch next/previous week in background
- Unload data for weeks that are no longer visible

#### B. Caching Layers:
- **Level 1**: Component state for current view
- **Level 2**: Hook cache for recent data
- **Level 3**: localStorage for persistent cache
- **Level 4**: Service worker for offline capability

#### C. API Optimizations:
- Batch distance calculations where possible
- Use Google Distance Matrix for multiple origins/destinations
- Implement request debouncing for rapid date changes
- Queue non-urgent requests during heavy usage

#### D. React Performance:
- `React.memo` for recommendation components
- Virtual scrolling for large deal lists
- Intersection Observer for lazy modal loading
- Web Workers for heavy calculations

### 8. Implementation Roadmap

#### Phase 1: Foundation (Week 1)
- [ ] Create Pipedrive deals API integration
- [ ] Set up basic distance calculation service
- [ ] Implement simple recommendation scoring
- [ ] Add basic loading states to calendar

#### Phase 2: Core Features (Week 2)
- [ ] Build recommendation modal UI
- [ ] Add calendar pill indicators
- [ ] Implement regional filter switching
- [ ] Create basic caching system

#### Phase 3: Optimization (Week 3)
- [ ] Add route optimization algorithms
- [ ] Implement performance optimizations
- [ ] Add comprehensive error handling
- [ ] Create admin tools for filter management

#### Phase 4: Polish (Week 4)
- [ ] Add analytics and tracking
- [ ] Implement A/B testing for scoring algorithms
- [ ] Add user preferences and learning
- [ ] Performance monitoring and alerts

### 9. Success Metrics

#### A. User Efficiency:
- Reduce average travel time between appointments by 25%
- Increase daily appointment capacity by 15%
- Improve inspector satisfaction scores

#### B. Business Impact:
- Increase booking conversion rate from recommendations
- Reduce fuel and travel costs
- Optimize inspector utilization across regions

#### C. Technical Performance:
- Modal load time under 500ms
- Recommendation accuracy > 85%
- API response times under 2 seconds
- Cache hit rate > 70%

### 10. Future Enhancements

#### A. Machine Learning Integration:
- Learn from inspector preferences and success rates
- Predictive scoring based on historical data
- Dynamic route optimization based on traffic patterns

#### B. Advanced Features:
- Multi-day route planning
- Customer preference matching
- Weather-based scheduling
- Integration with inspector mobile apps

#### C. Analytics Dashboard:
- Route efficiency reports
- Revenue optimization insights
- Inspector performance metrics
- Regional demand analysis

---

## Getting Started

1. **Server-side Setup**: Ensure Pipedrive filters are configured for each region
2. **API Keys**: Verify Google Maps API has Distance Matrix enabled
3. **Development**: Start with Phase 1 implementation
4. **Testing**: Use mock data initially, gradually integrate live APIs
5. **Deployment**: Roll out region by region for controlled testing

## Notes

- This system is designed to integrate seamlessly with existing calendar functionality
- All components should gracefully degrade if APIs are unavailable
- Focus on mobile-first design for inspector field use
- Consider offline capabilities for areas with poor connectivity