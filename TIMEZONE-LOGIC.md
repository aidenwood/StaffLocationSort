# Timezone Logic Documentation

## Why This App Needs Special Timezone Handling

### The Problem

This inspection scheduling application operates in Australia and integrates with Pipedrive CRM. The timezone handling is critical because:

1. **Pipedrive stores all times in UTC** - When you schedule a 9:00 AM Sydney appointment in Pipedrive, it's stored as 23:00:00 UTC (the previous day)
2. **Australian inspectors work in AEST/AEDT** - Sydney/Brisbane time is UTC+10 (or UTC+11 during daylight saving)
3. **Date boundary issues** - Without proper handling, morning appointments show on the wrong day

### Real-World Example

**Scenario**: An inspection scheduled for Friday 9:00 AM in Sydney

- **What Pipedrive stores**: 
  - `due_date`: "2026-03-27" (Thursday)
  - `due_time`: "23:00:00" (11 PM UTC)
  
- **Without our timezone logic**: The app would show this as Thursday 11 PM
- **With our timezone logic**: The app correctly shows Friday 9:00 AM

## How Our Solution Works

### 1. UTC to Australian Time Conversion (`timezone.js`)

```javascript
convertToAustralianTime(utcTimeString) {
  // Add 10 hours for AEST (Sydney/Brisbane timezone)
  hours = hours + 10;
  
  // Track if we crossed midnight (crucial!)
  const crossedMidnight = hours >= 24;
  
  // Handle hour rollover
  if (hours >= 24) {
    hours = hours - 24;
  }
  
  return {
    time: timeString,
    crossedMidnight: crossedMidnight  // Flag for date adjustment
  };
}
```

### 2. Date Adjustment in Calendar (`InspectorCalendar.jsx`)

```javascript
getPipedriveDateTime(timeString, dateString) {
  const converted = convertToAustralianTime(timeString);
  
  // If conversion crossed midnight, move to next day
  if (converted.crossedMidnight) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    adjustedDate = format(date, 'yyyy-MM-dd');
  }
  
  return {
    date: adjustedDate,  // Corrected date
    time: converted.time // Local time
  };
}
```

### 3. Activity Filtering

The calendar filters activities using the **adjusted date**, not the raw Pipedrive date:

```javascript
// Check if activity is on this date (use adjusted date)
if (timeInfo.date !== dateString) return false;
```

## Why This Matters for the Business

1. **Accurate Scheduling**: Inspectors see appointments on the correct day
2. **Route Optimization**: Google Maps routing works with accurate dates
3. **No Missed Appointments**: Morning appointments aren't hidden on wrong days
4. **Multi-Inspector Coordination**: All team members see consistent schedules

## Common Timezone Scenarios

| Pipedrive UTC Time | Pipedrive Date | Local Sydney Time | Displayed Date | Notes |
|-------------------|----------------|-------------------|----------------|-------|
| 23:00:00 | Thursday | 09:00 AM | Friday | Crossed midnight |
| 00:30:00 | Friday | 10:30 AM | Friday | Early morning |
| 04:00:00 | Friday | 02:00 PM | Friday | Afternoon |
| 14:00:00 | Friday | 12:00 AM (midnight) | Saturday | Crossed midnight |

## Technical Considerations

### Why Not Use Moment.js or date-fns-tz?

1. **Simple Use Case**: We only need UTC→AEST conversion
2. **Performance**: Lightweight custom solution vs heavy library
3. **Control**: Direct control over edge cases specific to our needs

### Future Enhancements

- **Daylight Saving Support**: Currently assumes AEST (UTC+10). Could add DST detection for NSW
- **Multiple Timezones**: If expanding beyond Eastern Australia
- **User Preferences**: Allow inspectors to set their preferred timezone

## Testing the Logic

Run the test file to verify timezone conversion:

```bash
node test-timezone.js
```

Expected output:
```
UTC 23:00:00 -> Local 09:00 (9:00 AM)
Crossed midnight: true
```

## Components Affected by Timezone Logic

### 1. InspectorCalendar.jsx
- **getActivityForSlot()**: Filters activities using adjusted dates
- **getAllActivitiesForSlot()**: Ensures all-inspector view shows correct day
- **getPipedriveDateTime()**: Core function that adjusts dates when crossing midnight

### 2. InspectionDashboard.jsx  
- **enrichedMapActivities**: Filters map activities using timezone-adjusted dates
- **allDayInspectionActivities**: Distance sorting uses corrected dates
- Both ensure 9am appointments appear on Friday map, not Thursday

### 3. GoogleMapsView.jsx
- **todaysAppointments**: Uses pre-filtered `enrichedDayActivities` from dashboard
- **Map markers**: Show correct day's appointments including morning slots
- **Route calculation**: Includes all appointments for the actual day
- **"Open in Maps" button**: Generates route URL with all correct appointments

## Impact on Features

### Map View
- Morning appointments (9am) now appear on the map for the correct day
- Route optimization includes ALL appointments, not missing morning ones
- Drive time calculations are accurate for the full day's schedule

### Open in Google Maps Button
- Generates navigation URL with complete appointment list
- Morning appointments are included in the route
- Waypoints are in correct chronological order

### Inspector Calendar
- Visual grid shows appointments on correct days
- Morning slots (9am, 10am) appear on intended day
- Multi-inspector view consistently shows same appointments

## Key Takeaway

**Without this timezone logic, morning appointments would appear on the wrong day, causing:**
- **Missed inspections** - 9am Friday appointments hidden on Thursday
- **Incomplete routes** - Google Maps navigation missing morning stops  
- **Incorrect scheduling** - Inspectors arriving on wrong day
- **Lost revenue** - Appointments not completed due to confusion

**This conversion ensures the calendar, map, and navigation tools accurately reflect when inspectors need to be at each location.**