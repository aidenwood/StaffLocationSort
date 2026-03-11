import React, { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, subWeeks, addWeeks } from 'date-fns';
import { Calendar, Grid3x3, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { validateAddressInServiceArea, regionCenters } from '../utils/regionValidation.js';

const AvailabilityGrid = ({ pipedriveData }) => {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedInspector, setSelectedInspector] = useState('all');

  const {
    activities: allActivities,
    inspectors,
    loading,
    error
  } = pipedriveData;

  // Generate 4 weeks of weekdays (20 days total)
  const weekdays = useMemo(() => {
    const days = [];
    let currentDay = startDate;
    
    for (let week = 0; week < 4; week++) {
      for (let day = 0; day < 5; day++) { // Monday to Friday
        days.push(new Date(currentDay));
        currentDay = addDays(currentDay, 1);
      }
      // Skip weekend
      currentDay = addDays(currentDay, 2);
    }
    
    return days;
  }, [startDate]);

  // Filter inspectors based on selection
  const filteredInspectors = useMemo(() => {
    if (selectedInspector === 'all') {
      return inspectors;
    }
    return inspectors.filter(inspector => inspector.id === Number(selectedInspector));
  }, [inspectors, selectedInspector]);

  // Process activities into grid data
  const gridData = useMemo(() => {
    if (!allActivities || !filteredInspectors) {
      return {};
    }

    const data = {};
    const loadSummary = {
      totalActivities: allActivities?.length || 0,
      inspectors: filteredInspectors?.length || 0,
      dateRange: `${format(weekdays[0], 'MMM d')} - ${format(weekdays[weekdays.length - 1], 'MMM d')}`,
      activitiesFound: 0,
      inspectorSummary: []
    };
    
    filteredInspectors.forEach(inspector => {
      data[inspector.id] = {};
      let inspectorActivities = 0;
      
      weekdays.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Find activities for this inspector on this day
        const dayActivities = allActivities.filter(activity => 
          Number(activity.owner_id) === Number(inspector.id) &&
          activity.due_date === dayString &&
          !activity.done &&
          activity.due_time && activity.due_time !== '00:00:00'
        );
        
        if (dayActivities.length > 0) {
          inspectorActivities += dayActivities.length;
          loadSummary.activitiesFound += dayActivities.length;
        }

        // Count inspections
        const count = dayActivities.length;

        // Determine most common region
        let dominantRegion = '';
        if (count > 0) {
          const regions = {};
          
          dayActivities.forEach(activity => {
            let region = 'Unknown';
            let isFromLabel = false; // Track if region came from Label field
            
            // First: Use Label field if available (3-digit Pipedrive codes)
            // TODO: Labels are returning as 3-digit codes that need translation to region names
            // Current format: "XXX" where XXX is a 3-digit code for the region
            if (activity.label && typeof activity.label === 'string') {
              const label = activity.label.trim();
              console.log(`🏷️ Found label for activity "${activity.subject}": "${label}" (3-digit code)`);
              isFromLabel = true;
              
              // TODO: Replace this with proper 3-digit code to region mapping
              if (label.includes('GOLD COAST')) region = 'Gold Coast';
              else if (label.includes('LOGAN')) region = 'Logan';
              else if (label.includes('IPSWICH')) region = 'Ipswich';
              else if (label.includes('BRISBANE')) region = 'Brisbane';
              else if (label.includes('SUNSHINE COAST')) region = 'Sunshine Coast';
              else if (label.includes('TOOWOOMBA')) region = 'Toowoomba';
              else {
                // For now, display the 3-digit code as-is
                region = `Code: ${label}`;
              }
              console.log(`🎯 Mapped label "${label}" to region: "${region}"`);
            }
            
            // Second: Use location object if available
            if (region === 'Unknown' && activity.location) {
              const loc = activity.location;
              if (loc.locality) {
                const locality = loc.locality.toLowerCase();
                if (locality.includes('gold coast') || locality.includes('surfers paradise') || locality.includes('broadbeach')) {
                  region = 'Gold Coast';
                } else if (locality.includes('logan') || locality.includes('beenleigh') || locality.includes('eagleby')) {
                  region = 'Logan';
                } else if (locality.includes('ipswich') || locality.includes('springfield')) {
                  region = 'Ipswich';
                } else if (locality.includes('brisbane') || locality.includes('south bank') || locality.includes('fortitude valley')) {
                  region = 'Brisbane';
                } else if (locality.includes('sunshine coast') || locality.includes('caloundra') || locality.includes('maroochydore')) {
                  region = 'Sunshine Coast';
                } else if (locality.includes('toowoomba')) {
                  region = 'Toowoomba';
                }
              }
            }
            
            // Third: Use coordinates if available
            if (region === 'Unknown' && (activity.coordinates || (activity.lat && activity.lng) || (activity.location_lat && activity.location_lng))) {
              const lat = activity.lat || activity.coordinates?.lat || activity.location_lat;
              const lng = activity.lng || activity.coordinates?.lng || activity.location_lng;
              
              if (lat && lng) {
                const regionResult = validateAddressInServiceArea(lat, lng);
                if (regionResult?.closestRegion) {
                  const regionName = regionResult.closestRegion.name;
                  const match = regionName.match(/\((.*?)\)/);
                  if (match) {
                    const cities = match[1].split('/').map(s => s.trim());
                    region = cities[0];
                  } else {
                    region = regionResult.closestRegion.code || 'Unknown';
                  }
                }
              }
            }
            
            // Fourth: Use personAddress if available
            if (region === 'Unknown' && activity.personAddress) {
              const address = activity.personAddress.toLowerCase();
              if (address.includes('gold coast')) region = 'Gold Coast';
              else if (address.includes('logan')) region = 'Logan';
              else if (address.includes('ipswich')) region = 'Ipswich';
              else if (address.includes('brisbane')) region = 'Brisbane';
              else if (address.includes('sunshine coast')) region = 'Sunshine Coast';
              else if (address.includes('toowoomba')) region = 'Toowoomba';
            }
            
            // Final fallback: Use inspector's home region as default
            if (region === 'Unknown') {
              const inspectorRegion = inspector.region || inspector.regionName || '';
              if (inspectorRegion.includes('R01') || inspectorRegion.includes('Brisbane') || inspectorRegion.includes('Logan') || inspectorRegion.includes('Ipswich')) {
                region = 'Brisbane/Logan'; // R01 covers multiple areas
              } else if (inspectorRegion.includes('R03') || inspectorRegion.includes('Sunshine Coast')) {
                region = 'Sunshine Coast';
              } else if (inspectorRegion.includes('R04') || inspectorRegion.includes('Toowoomba')) {
                region = 'Toowoomba';
              } else {
                region = inspectorRegion.split(' - ')[0] || 'Unknown';
              }
            }
            
            // Store region with metadata about data source
            const regionKey = isFromLabel ? region : `${region} (est)`;
            regions[regionKey] = (regions[regionKey] || 0) + 1;
          });

          // Find most common region
          dominantRegion = Object.keys(regions).reduce((a, b) => 
            regions[a] > regions[b] ? a : b, Object.keys(regions)[0] || ''
          );
        }

        data[inspector.id][dayString] = {
          count,
          dominantRegion,
          activities: dayActivities
        };
      });
      
      // Add inspector summary
      if (inspectorActivities > 0) {
        loadSummary.inspectorSummary.push({
          name: inspector.name,
          activities: inspectorActivities
        });
      }
    });

    // Single clean console log with summary
    if (loadSummary.activitiesFound > 0) {
      console.log('📅 AVAILABILITY GRID: Loaded inspection data', loadSummary);
    }

    return data;
  }, [allActivities, filteredInspectors, weekdays]);

  // Region color mapping - only color actual Label data, gray for estimates
  const getRegionColor = (region) => {
    // If region contains "(est)", it's estimated - use gray
    if (region.includes('(est)') || region === 'Unknown') {
      return 'bg-gray-100 text-gray-600';
    }
    
    // Only color actual Label field data
    const colors = {
      'Brisbane': 'bg-blue-100 text-blue-800',
      'Logan': 'bg-green-100 text-green-800',
      'Ipswich': 'bg-purple-100 text-purple-800',
      'Gold Coast': 'bg-yellow-100 text-yellow-800',
      'Sunshine Coast': 'bg-orange-100 text-orange-800',
      'Toowoomba': 'bg-red-100 text-red-800'
    };
    return colors[region] || 'bg-gray-100 text-gray-600';
  };

  const navigateWeeks = (direction) => {
    if (direction === 'prev') {
      setStartDate(prev => subWeeks(prev, 4));
    } else {
      setStartDate(prev => addWeeks(prev, 4));
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6 bg-white">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading availability data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 bg-white">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white">
      {/* Figma-style Header */}
      <div className="mb-6">
        {/* Main header bar */}
        <div className="flex items-center justify-between bg-white border-b border-gray-200 pb-4 mb-4">
          {/* Left: Title and subtitle */}
          <div className="flex items-center gap-3">
            <Grid3x3 className="h-6 w-6 text-gray-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Availability Grid
              </h1>
              <span className="text-xs text-gray-500">
                Inspector availability overview
              </span>
            </div>
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-3">
            {/* Inspector Filter */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5">
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="all">All Inspectors</option>
                {inspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => navigateWeeks('prev')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous 4 weeks"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="px-2 py-1 text-xs text-gray-700 min-w-max">
                {format(startDate, 'MMM d')} - {format(addDays(weekdays[weekdays.length - 1], 0), 'MMM d')}
              </span>
              <button
                onClick={() => navigateWeeks('next')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next 4 weeks"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right: Status indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-500">Live Data</span>
            </div>
          </div>
        </div>
      </div>


      {/* Grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header row with dates */}
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                  Inspector
                </th>
                {weekdays.map((day, index) => (
                  <th 
                    key={index}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24"
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-gray-400">{format(day, 'M/d')}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Inspector rows */}
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInspectors.map((inspector) => (
                <tr key={inspector.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 border-r border-gray-200">
                    <div>
                      <div>{inspector.name}</div>
                      <div className="text-xs text-gray-500">{inspector.region || inspector.regionName}</div>
                    </div>
                  </td>
                  {weekdays.map((day, dayIndex) => {
                    const dayString = format(day, 'yyyy-MM-dd');
                    const dayData = gridData[inspector.id]?.[dayString] || { count: 0, dominantRegion: '', activities: [] };
                    
                    return (
                      <td 
                        key={dayIndex}
                        className="px-2 py-2 text-center border-r border-gray-100 relative"
                        title={`${inspector.name} - ${format(day, 'MMM d')}: ${dayData.count} inspections${dayData.dominantRegion ? ` in ${dayData.dominantRegion}` : ''}`}
                      >
                        {dayData.count > 0 ? (
                          <div className="space-y-1">
                            <div className="text-lg font-bold text-gray-900">
                              {dayData.count}
                            </div>
                            {dayData.dominantRegion && (
                              <div className={`text-xs px-1 py-0.5 rounded-md ${getRegionColor(dayData.dominantRegion)}`}>
                                {dayData.dominantRegion}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-300">-</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3" />
          <span>Regional Distribution:</span>
        </div>
        {['Brisbane', 'Logan', 'Ipswich', 'Gold Coast', 'Sunshine Coast', 'Toowoomba'].map(region => (
          <div key={region} className={`px-2 py-1 rounded-md ${getRegionColor(region)}`}>
            {region}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityGrid;