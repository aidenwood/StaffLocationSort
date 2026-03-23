# Deal Timeslot Recommendations System

## Overview

The Deal Timeslot Recommendations system provides intelligent suggestions for scheduling inspections by analyzing proximity between scheduled inspections and Pipedrive deals. It displays colored buttons on available calendar timeslots showing how many deals are nearby, helping optimize route efficiency.

## How It Works

### 1. Button Display Logic

**Location**: `InspectorCalendar.jsx` lines 662-727

The system shows purple gradient buttons on empty timeslots (09:00, 11:00, 13:00, 15:00) with deal counts:

```javascript
// For timeslot 09:00 on Monday March 24th
const dayKey = `${format(day, 'yyyy-MM-dd')}-${timeSlot}`;
const counts = timeSlotDealCounts[dayKey]; // e.g. "2026-03-24-09:00"
```

**Color Coding (Purple Gradient)**:
- `1km`: Bright purple (`bg-purple-600`) - Highest priority
- `2.5km`: Medium purple (`bg-purple-500`) 
- `5km`: Light purple (`bg-purple-400`)
- `10km`: Very light purple (`bg-purple-300`)
- `15km`: Subtle purple (`bg-purple-200`)
- `30km`: Barely purple (`bg-purple-100`)

### 2. Count Calculation Process

**Location**: `InspectionDashboard.jsx` lines 240-335

```javascript
const calculateTimeSlotDealCounts = async () => {
  // 1. Filter activities for selected inspector only
  const dayActivities = enrichedActivities.filter(a =>
    Number(a.owner_id) === Number(selectedInspector) && // ⚠️ Critical: Inspector filter
    a.due_date === dayString &&
    !a.done &&
    a.due_time && a.due_time !== '00:00:00' &&
    a.coordinates // Only activities with coordinates
  );

  // 2. For each timeslot, find reference inspection
  for (const timeSlot of ['09:00', '11:00', '13:00', '15:00']) {
    let referenceInspection = null;
    
    if (timeSlot === '09:00') {
      // Use NEXT inspection as reference point
      referenceInspection = dayActivities
        .filter(a => a.due_time > timeSlot)
        .sort((a, b) => a.due_time.localeCompare(b.due_time))[0];
    } else {
      // Use PREVIOUS inspection as reference point  
      referenceInspection = dayActivities
        .filter(a => a.due_time < timeSlot)
        .sort((a, b) => b.due_time.localeCompare(a.due_time))[0];
    }

    // 3. Calculate distances from reference point to all deals
    const sortedDeals = await sortDealsByDistance(deals, [referenceInspection]);
    
    // 4. Count deals within each radius
    const within1km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 1).length;
    const within5km = dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 5).length;
    // etc...
  }
}
```

### 3. Reference Point Selection Logic

**Critical Logic**: The system chooses different reference inspections for each timeslot:

- **09:00 AM**: Uses the **next** inspection later in the day
  - Rationale: Morning slot should optimize travel to first real appointment
- **11:00, 13:00, 15:00**: Uses the **previous** inspection earlier in the day  
  - Rationale: Should be near recently visited location

**Example for Monday March 24th**:
- Scott has inspections at 10:30 and 14:00
- 09:00 button: Uses 10:30 inspection as reference (next appointment)
- 11:00 button: Uses 10:30 inspection as reference (previous appointment)
- 13:00 button: Uses 10:30 inspection as reference (previous appointment) 
- 15:00 button: Uses 14:00 inspection as reference (previous appointment)

### 4. Deal Console Modal

**Location**: `DealsDebugConsole.jsx` lines 449-505

When clicking a timeslot button, the modal opens showing detailed deal breakdowns:

```
Radius:
1km (0)      ← All deals within 1km
2.5km (5)    ← All deals within 2.5km  
5km (18)     ← All deals within 5km
10km (28)    ← All deals within 10km
15km (40)    ← All deals within 15km
30km (56)    ← All deals within 30km
All (274)    ← Total deals in region
```

**Modal Distance Calculation**:
1. Receives `window.dealsSortByInspection` (set by button click)
2. Uses `sortDealsByDistance(deals, [referenceInspection])`
3. Calculates **cumulative** counts (not incremental)
4. Displays with same purple color scheme as buttons

### 5. Data Flow

```
[InspectionDashboard.jsx]
  ↓ calculateTimeSlotDealCounts()
  ↓ Stores counts in timeSlotDealCounts state
  ↓ 
[InspectorCalendar.jsx]  
  ↓ Receives timeSlotDealCounts prop
  ↓ Displays purple buttons with counts
  ↓ onClick: calls onShowDealsDebugConsole(day, timeSlot, radius)
  ↓
[InspectionDashboard.jsx]
  ↓ handleShowDealsDebugConsole()
  ↓ Sets window.dealsSortByInspection = referenceInspection
  ↓ Opens modal
  ↓
[DealsDebugConsole.jsx]
  ↓ Reads window.dealsSortByInspection
  ↓ Calculates distances from same reference point
  ↓ Shows detailed radius breakdown
```

## Key Components

### Files Involved
- `InspectionDashboard.jsx`: Main logic, count calculation
- `InspectorCalendar.jsx`: Button display, color coding
- `DealsDebugConsole.jsx`: Modal with detailed breakdown
- `pipedriveDeals.js`: Distance calculation utilities

### Critical State
- `timeSlotDealCounts`: Object with keys like `"2026-03-24-09:00"`
- `window.dealsSortByInspection`: Temporary reference inspection for modal
- `selectedInspector`: Must filter all calculations by this inspector

### APIs Used
- `getDealsForRegion()`: Fetches deals for inspector's region
- `sortDealsByDistance()`: Calculates distances from reference points
- Pipedrive API via `/netlify/functions/pipedrive-proxy`

## Common Issues & Solutions

### Issue: Button shows different count than modal
**Cause**: Button and modal using different reference inspections
**Fix**: Ensure `calculateTimeSlotDealCounts` filters by `selectedInspector`

### Issue: No buttons showing
**Cause**: Missing coordinates on inspection activities
**Fix**: Check geocoding in activity enrichment process

### Issue: Wrong colors on buttons
**Cause**: Incorrect count calculation or color mapping
**Fix**: Verify purple gradient logic in `InspectorCalendar.jsx` lines 675-703

## Testing

### Manual Testing Steps
1. Select inspector (e.g., Scott Rodman)
2. Navigate to date with inspections 
3. Enable "Show Opportunities" toggle
4. Verify purple buttons appear on empty timeslots
5. Click button → modal should show same counts
6. Check console for calculation logs

### Test Data Requirements
- Inspector with scheduled inspections
- Deals with coordinates in same region
- Properly geocoded activities with coordinates

## Performance Notes

- Calculations run when inspector/date changes
- Uses `useMemo()` for activity filtering
- Distance calculations can be expensive with many deals
- Modal auto-selects optimal radius when opened

## Debug Logging

Key console messages to watch:
```
📅 Calculated deal counts for X time slots
🎯 Opening deals console for 09:00 with reference inspection
✅ Loaded X deals for region R01 (sorted by distance)
```

This system optimizes inspection scheduling by providing intelligent proximity-based recommendations for available timeslots.