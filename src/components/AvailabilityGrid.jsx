import React, { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, subWeeks, addWeeks, subDays } from 'date-fns';
import { Calendar, Grid3x3, ChevronLeft, ChevronRight, MapPin, Users, ArrowLeft, Columns2, Map, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { validateAddressInServiceArea, regionCenters } from '../utils/regionValidation.js';
import DatePickerDropdown from './DatePickerDropdown';
import DealsDebugConsole from './DealsDebugConsole';
import RosterCellEditor from './RosterCellEditor';
import { useRosterData } from '../hooks/useRosterData';

const AvailabilityGrid = ({ pipedriveData }) => {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedInspector, setSelectedInspector] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRegionalBreakdown, setShowRegionalBreakdown] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState(null); // Track which region is expanded
  const [showDealsConsole, setShowDealsConsole] = useState(false);
  const [selectedRegionData, setSelectedRegionData] = useState(null);
  const [editingCell, setEditingCell] = useState(null);

  // Get roster data for the current date range
  const endDate = addDays(startDate, 27); // 4 weeks
  const { rosterData, loading: rosterLoading, updateRoster, getRosterForDate } = useRosterData(
    startDate,
    endDate
  );

  const {
    activities: allActivities,
    inspectors,
    loading,
    error,
    isLiveData
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
    const dailyTotals = {}; // Track total inspections per day
    const locationData = {}; // Track location-specific data from Label field
    const INSPECTOR_DAILY_CAPACITY = 4; // Each inspector can handle 4 inspections per day
    
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
        
        // Add to daily totals for capacity calculation
        if (!dailyTotals[dayString]) {
          dailyTotals[dayString] = 0;
        }
        dailyTotals[dayString] += count;

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

    // Calculate capacity utilization for each day and regional breakdowns
    const capacityData = {};
    const regionalData = {};
    
    weekdays.forEach(day => {
      const dayString = format(day, 'yyyy-MM-dd');
      const totalInspections = dailyTotals[dayString] || 0;
      const totalCapacity = filteredInspectors.length * INSPECTOR_DAILY_CAPACITY;
      const utilizationPercent = totalCapacity > 0 ? (totalInspections / totalCapacity) * 100 : 0;
      
      capacityData[dayString] = {
        totalInspections,
        totalCapacity,
        utilizationPercent: Math.round(utilizationPercent)
      };
      
      // Calculate regional breakdown for this day
      const regionTotals = {};
      filteredInspectors.forEach(inspector => {
        // Extract region code from inspector data
        const regionCode = inspector.region || inspector.regionName || 'Unknown';
        let regionKey = regionCode;
        
        // Parse region codes (R01-R09) with proper town names
        if (regionCode.includes('R01')) regionKey = 'R01 - Brisbane/Logan/Ipswich';
        else if (regionCode.includes('R02')) regionKey = 'R02 - Gympie/Maryborough';
        else if (regionCode.includes('R03')) regionKey = 'R03 - Sunshine Coast';
        else if (regionCode.includes('R04')) regionKey = 'R04 - Toowoomba';
        else if (regionCode.includes('R05')) regionKey = 'R05 - Warwick/Stanthorpe';
        else if (regionCode.includes('R06')) regionKey = 'R06 - Townsville';
        else if (regionCode.includes('R07')) regionKey = 'R07 - Grafton/Coffs';
        else if (regionCode.includes('R08')) regionKey = 'R08 - Glen Innes/Armidale';
        else if (regionCode.includes('R09')) regionKey = 'R09 - Newcastle';
        else if (regionCode.includes('Brisbane') || regionCode.includes('Logan') || regionCode.includes('Ipswich')) regionKey = 'R01 - Brisbane/Logan/Ipswich';
        else if (regionCode.includes('Gympie') || regionCode.includes('Maryborough')) regionKey = 'R02 - Gympie/Maryborough';
        else if (regionCode.includes('Gold Coast')) regionKey = 'Gold Coast Region';
        else if (regionCode.includes('Sunshine Coast')) regionKey = 'R03 - Sunshine Coast';
        else if (regionCode.includes('Toowoomba')) regionKey = 'R04 - Toowoomba';
        else if (regionCode.includes('Warwick') || regionCode.includes('Stanthorpe')) regionKey = 'R05 - Warwick/Stanthorpe';
        else if (regionCode.includes('Cairns')) regionKey = 'Cairns Region';
        else if (regionCode.includes('Townsville')) regionKey = 'R06 - Townsville';
        else if (regionCode.includes('Grafton') || regionCode.includes('Coffs')) regionKey = 'R07 - Grafton/Coffs';
        else if (regionCode.includes('Mackay')) regionKey = 'Mackay Region';
        else if (regionCode.includes('Glen Innes') || regionCode.includes('Armidale')) regionKey = 'R08 - Glen Innes/Armidale';
        else if (regionCode.includes('Rockhampton')) regionKey = 'Rockhampton Region';
        else if (regionCode.includes('Newcastle')) regionKey = 'R09 - Newcastle';
        else if (regionCode.includes('Bundaberg')) regionKey = 'Bundaberg Region';
        else regionKey = regionCode || 'Unknown Region';
        
        if (!regionTotals[regionKey]) {
          regionTotals[regionKey] = {
            inspectors: 0,
            inspections: 0,
            capacity: 0,
            utilizationPercent: 0
          };
        }
        
        regionTotals[regionKey].inspectors++;
        regionTotals[regionKey].capacity += INSPECTOR_DAILY_CAPACITY;
        
        const inspectorDayData = data[inspector.id]?.[dayString];
        if (inspectorDayData) {
          regionTotals[regionKey].inspections += inspectorDayData.count || 0;
        }
      });
      
      // Calculate utilization percentages for each region
      Object.keys(regionTotals).forEach(regionKey => {
        const region = regionTotals[regionKey];
        region.utilizationPercent = region.capacity > 0 ? Math.round((region.inspections / region.capacity) * 100) : 0;
      });
      
      regionalData[dayString] = regionTotals;
    });

    // Process all activities for location data (separate from inspector-specific processing)
    weekdays.forEach(day => {
      const dayString = format(day, 'yyyy-MM-dd');
      if (!locationData[dayString]) {
        locationData[dayString] = {};
      }

      // Get all activities for this day across all inspectors
      const dayActivities = allActivities.filter(activity => 
        activity.due_date === dayString &&
        !activity.done &&
        activity.due_time && activity.due_time !== '00:00:00'
      );

      dayActivities.forEach(activity => {
        let region = 'Unknown';
        let isFromLabel = false;

        // Use Label field if available (should contain 3-digit codes)
        if (activity.label) {
          console.log('🏷️ Raw label field for activity:', activity.subject, 'Label:', activity.label);
          
          let labelValue = '';
          
          // Handle different label field formats
          if (typeof activity.label === 'string') {
            labelValue = activity.label.trim();
          } else if (typeof activity.label === 'object' && activity.label !== null) {
            // Label might be an object with properties
            labelValue = activity.label.value || activity.label.name || JSON.stringify(activity.label);
            console.log('🏷️ Label is object:', activity.label);
          }
          
          if (labelValue) {
            isFromLabel = true;
            console.log('🔍 Processing label value:', labelValue);
            
            // Map 3-digit codes to locations (you'll need to provide the actual mappings)
            const locationCodeMap = {
              // Brisbane Metro
              '001': 'Brisbane',
              '002': 'Brisbane North', 
              '003': 'Brisbane South',
              '004': 'Brisbane West',
              '005': 'Brisbane East',
              // Logan
              '010': 'Logan',
              '011': 'Logan Central',
              '012': 'Logan West',
              // Ipswich  
              '020': 'Ipswich',
              '021': 'Ipswich Central',
              // Gold Coast
              '030': 'Gold Coast',
              '031': 'Gold Coast North',
              '032': 'Gold Coast Central',
              '033': 'Gold Coast South',
              // Sunshine Coast
              '040': 'Sunshine Coast',
              '041': 'Sunshine Coast North',
              '042': 'Sunshine Coast South',
              // Toowoomba
              '050': 'Toowoomba',
              // Gympie/Maryborough
              '060': 'Gympie',
              '061': 'Maryborough',
              // Warwick/Stanthorpe  
              '070': 'Warwick',
              '071': 'Stanthorpe',
              // Grafton/Coffs
              '080': 'Grafton',
              '081': 'Coffs Harbour',
              // Glen Innes/Armidale
              '090': 'Glen Innes', 
              '091': 'Armidale',
              // Newcastle
              '100': 'Newcastle'
            };
            
            // Check if it's a 3-digit code
            if (locationCodeMap[labelValue]) {
              region = locationCodeMap[labelValue];
              console.log(`✅ Mapped code ${labelValue} to ${region}`);
            } else {
              // Fallback to text-based matching for non-code labels
              const labelUpper = labelValue.toUpperCase();
              if (labelUpper.includes('GOLD COAST')) region = 'Gold Coast';
              else if (labelUpper.includes('LOGAN')) region = 'Logan';
              else if (labelUpper.includes('IPSWICH')) region = 'Ipswich';
              else if (labelUpper.includes('BRISBANE')) region = 'Brisbane';
              else if (labelUpper.includes('SUNSHINE COAST')) region = 'Sunshine Coast';
              else if (labelUpper.includes('TOOWOOMBA')) region = 'Toowoomba';
              else if (labelUpper.includes('GYMPIE')) region = 'Gympie';
              else if (labelUpper.includes('MARYBOROUGH')) region = 'Maryborough';
              else if (labelUpper.includes('WARWICK')) region = 'Warwick';
              else if (labelUpper.includes('STANTHORPE')) region = 'Stanthorpe';
              else if (labelUpper.includes('GRAFTON')) region = 'Grafton';
              else if (labelUpper.includes('COFFS')) region = 'Coffs Harbour';
              else if (labelUpper.includes('GLEN INNES')) region = 'Glen Innes';
              else if (labelUpper.includes('ARMIDALE')) region = 'Armidale';
              else if (labelUpper.includes('NEWCASTLE')) region = 'Newcastle';
              else {
                region = `Code: ${labelValue}`;
                console.log(`❓ Unknown label: "${labelValue}"`);
              }
            }
          }
        }

        // Use location object if no label
        if (region === 'Unknown' && activity.location?.locality) {
          const locality = activity.location.locality.toLowerCase();
          if (locality.includes('gold coast')) region = 'Gold Coast';
          else if (locality.includes('logan')) region = 'Logan';
          else if (locality.includes('ipswich')) region = 'Ipswich';
          else if (locality.includes('brisbane')) region = 'Brisbane';
          else if (locality.includes('sunshine coast')) region = 'Sunshine Coast';
          else if (locality.includes('toowoomba')) region = 'Toowoomba';
        }

        // Map regions to parent regions for nested breakdown
        let parentRegion = null;
        let specificLocation = region;

        if (region.includes('Brisbane') || region.includes('Logan') || region.includes('Ipswich') || region.includes('Gold Coast')) {
          parentRegion = 'R01 - Brisbane/Logan/Ipswich';
          specificLocation = region;
        } else if (region.includes('Gympie') || region.includes('Maryborough')) {
          parentRegion = 'R02 - Gympie/Maryborough';
          specificLocation = region;
        } else if (region.includes('Sunshine Coast')) {
          parentRegion = 'R03 - Sunshine Coast';
          specificLocation = 'Sunshine Coast';
        } else if (region.includes('Toowoomba')) {
          parentRegion = 'R04 - Toowoomba';
          specificLocation = 'Toowoomba';
        } else if (region.includes('Warwick') || region.includes('Stanthorpe')) {
          parentRegion = 'R05 - Warwick/Stanthorpe';
          specificLocation = region;
        } else if (region.includes('Grafton') || region.includes('Coffs')) {
          parentRegion = 'R07 - Grafton/Coffs';
          specificLocation = region;
        } else if (region.includes('Glen Innes') || region.includes('Armidale')) {
          parentRegion = 'R08 - Glen Innes/Armidale';
          specificLocation = region;
        } else if (region.includes('Newcastle')) {
          parentRegion = 'R09 - Newcastle';
          specificLocation = 'Newcastle';
        }

        // Track location data if we have a parent region
        if (parentRegion && region !== 'Unknown') {
          if (!locationData[dayString][parentRegion]) {
            locationData[dayString][parentRegion] = {};
          }
          if (!locationData[dayString][parentRegion][specificLocation]) {
            locationData[dayString][parentRegion][specificLocation] = { count: 0, activities: [] };
          }
          locationData[dayString][parentRegion][specificLocation].count++;
          locationData[dayString][parentRegion][specificLocation].activities.push(activity);
        }
      });
    });

    // Single clean console log with summary
    if (loadSummary.activitiesFound > 0) {
      console.log('📅 AVAILABILITY GRID: Loaded inspection data', loadSummary);
      console.log('📍 Location Data (detailed):', JSON.stringify(locationData, null, 2));
      
      // Show which regions have location data
      Object.keys(locationData).forEach(date => {
        console.log(`📅 ${date}:`, Object.keys(locationData[date]));
        Object.keys(locationData[date]).forEach(region => {
          console.log(`  🏙️ ${region}:`, Object.keys(locationData[date][region]));
        });
      });
    }

    return { inspectorData: data, capacityData, regionalData, locationData };
  }, [allActivities, filteredInspectors, weekdays]);

  // Capacity utilization color coding
  const getCapacityColor = (utilizationPercent) => {
    if (utilizationPercent >= 100) return 'bg-green-600'; // 100% - Perfect utilization
    if (utilizationPercent >= 66) return 'bg-green-500'; // 66%+ - Good utilization
    if (utilizationPercent >= 33) return 'bg-yellow-500'; // 33-65% - Medium utilization
    if (utilizationPercent > 0) return 'bg-orange-500'; // 1-32% - Low utilization
    return 'bg-gray-200'; // 0% - No utilization
  };

  // Get text color based on background
  const getTextColor = (utilizationPercent) => {
    return utilizationPercent > 0 ? 'text-white' : 'text-gray-600';
  };

  // Check if inspector is working outside their assigned region
  const isOutOfRegion = (inspector, dominantRegion) => {
    if (!inspector.region && !inspector.regionName) return false;
    if (!dominantRegion || dominantRegion.includes('Unknown') || dominantRegion.includes('(est)')) return false;
    
    const inspectorRegion = (inspector.region || inspector.regionName || '').toLowerCase();
    const workingRegion = dominantRegion.toLowerCase();
    
    // Map inspector regions to expected working regions
    const regionMappings = {
      'r01': ['brisbane', 'logan', 'ipswich'],
      'r02': ['gympie', 'maryborough'], 
      'r03': ['sunshine coast'],
      'r04': ['toowoomba'],
      'r05': ['warwick', 'stanthorpe'],
      'r06': ['townsville'],
      'r07': ['grafton', 'coffs'],
      'r08': ['glen innes', 'armidale'],
      'r09': ['newcastle']
    };
    
    // Find inspector's region code
    let inspectorRegionCode = null;
    for (const [code, areas] of Object.entries(regionMappings)) {
      if (inspectorRegion.includes(code) || areas.some(area => inspectorRegion.includes(area))) {
        inspectorRegionCode = code;
        break;
      }
    }
    
    if (!inspectorRegionCode) return false;
    
    // Check if working region matches inspector's region
    const expectedAreas = regionMappings[inspectorRegionCode];
    return !expectedAreas.some(area => workingRegion.includes(area));
  };

  // Region color mapping - only color actual Label data, gray for estimates
  const getRegionColor = (region) => {
    // If region contains "(est)", it's estimated - use gray
    if (region.includes('(est)') || region === 'Unknown') {
      return 'bg-gray-100 text-gray-600';
    }
    
    // Map region codes to colors
    const regionCodeColors = {
      'R01': 'bg-blue-100 text-blue-800',
      'R02': 'bg-green-100 text-green-800',
      'R03': 'bg-purple-100 text-purple-800',
      'R04': 'bg-red-100 text-red-800',
      'R05': 'bg-yellow-100 text-yellow-800',
      'R06': 'bg-orange-100 text-orange-800',
      'R07': 'bg-pink-100 text-pink-800',
      'R08': 'bg-indigo-100 text-indigo-800',
      'R09': 'bg-teal-100 text-teal-800'
    };
    
    // Check if it's a region code first
    if (regionCodeColors[region]) {
      return regionCodeColors[region];
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

  // Status color mapping for roster status
  const getStatusColor = (status) => {
    const statusColors = {
      'working': 'bg-green-100 text-green-800',
      'sick': 'bg-red-100 text-red-800',
      'rain': 'bg-blue-100 text-blue-800',
      'rdo': 'bg-yellow-100 text-yellow-800',
      'annual_leave': 'bg-purple-100 text-purple-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-600';
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

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    // Update the start date to show the week containing the selected date
    setStartDate(startOfWeek(newDate, { weekStartsOn: 1 }));
  };

  const handleBackToDashboard = () => {
    window.location.hash = '#dashboard';
  };

  const handleCapacityCellClick = (regionKey, date, regionType = 'total') => {
    // Map region keys to region codes expected by the deals API
    const regionMapping = {
      'R01 - Brisbane/Logan/Ipswich': 'R1',
      'R02 - Gympie/Maryborough': 'R2', 
      'R03 - Sunshine Coast': 'R3',
      'R04 - Toowoomba': 'R4',
      'R05 - Warwick/Stanthorpe': 'R5',
      'R06 - Townsville': 'R6',
      'R07 - Grafton/Coffs': 'R7',
      'R08 - Glen Innes/Armidale': 'R8',
      'R09 - Newcastle': 'R9',
      'Total': 'R1' // Default to R1 for total view, could be enhanced later
    };

    // Map to region center coordinates for distance sorting
    const regionCenterMapping = {
      'R01 - Brisbane/Logan/Ipswich': regionCenters.R01,
      'R02 - Gympie/Maryborough': regionCenters.R02, 
      'R03 - Sunshine Coast': regionCenters.R03,
      'R04 - Toowoomba': regionCenters.R04,
      'R05 - Warwick/Stanthorpe': regionCenters.R05,
      'R06 - Townsville': regionCenters.R06,
      'R07 - Grafton/Coffs': regionCenters.R07,
      'R08 - Glen Innes/Armidale': regionCenters.R08,
      'R09 - Newcastle': regionCenters.R09,
      'Total': regionCenters.R01 // Default to R01 center for total view
    };

    const mappedRegion = regionMapping[regionKey] || 'R1';
    const regionCenter = regionCenterMapping[regionKey] || regionCenters.R01;
    
    setSelectedRegionData({
      regionKey,
      mappedRegion,
      date: new Date(date),
      regionType,
      regionCenter, // Add region center coordinates for distance sorting
      // Get activities for that day from the region
      inspectionActivities: allActivities.filter(activity => 
        activity.due_date === date && 
        !activity.done &&
        activity.due_time && 
        activity.due_time !== '00:00:00'
      )
    });
    setShowDealsConsole(true);
  };

  const handleCloseDealsConsole = () => {
    setShowDealsConsole(false);
    setSelectedRegionData(null);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header - Responsive Figma Style */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2">
        {/* Desktop Layout - Single Row */}
        <div className="hidden lg:flex items-center justify-between gap-4">
          {/* Left: Back Button and Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-medium text-gray-900">
              Availability Grid
            </h1>
            <div className="w-px h-4 bg-gray-300"></div>
            <span className="text-xs text-gray-500">
              Inspector Overview
            </span>
          </div>

          {/* Center Controls */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {/* Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5">
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer min-w-0"
              >
                <option value="all">All Inspectors</option>
                {inspectors?.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => navigateWeeks('prev')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous 4 weeks"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className="px-1"
              />
              
              <button
                onClick={() => navigateWeeks('next')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next 4 weeks"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800"
                title="Dashboard View"
              >
                <Columns2 className="w-3 h-3" />
                <span className="text-xs">Dashboard</span>
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors bg-white text-blue-600 shadow-sm"
                title="Grid View - Current"
              >
                <Grid3x3 className="w-3 h-3" />
                <span className="text-xs">Grid</span>
              </button>
            </div>
          </div>

          {/* Right: Status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {isLiveData ? 'Live' : 'Mock'}
              </span>
            </div>
          </div>
        </div>

        {/* Tablet Layout - Two Rows */}
        <div className="hidden md:block lg:hidden">
          {/* First Row - Title and Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-sm font-medium text-gray-900">Availability Grid</h1>
              <div className="w-px h-4 bg-gray-300"></div>
              <span className="text-xs text-gray-500">Inspector Overview</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {isLiveData ? 'Live' : 'Mock'}
              </span>
            </div>
          </div>

          {/* Second Row - Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5">
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="all">All Inspectors</option>
                {inspectors?.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => navigateWeeks('prev')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous 4 weeks"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className="px-1"
              />
              
              <button
                onClick={() => navigateWeeks('next')}
                className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next 4 weeks"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800"
                title="Dashboard View"
              >
                <Columns2 className="w-3 h-3" />
                <span className="text-xs">Dashboard</span>
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors bg-white text-blue-600 shadow-sm"
                title="Grid View - Current"
              >
                <Grid3x3 className="w-3 h-3" />
                <span className="text-xs">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Single Row */}
        <div className="block md:hidden">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back Button, Title and Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <h1 className="text-sm font-medium text-gray-900">Grid</h1>
              <div className={`w-2 h-2 rounded-full ${
                isLiveData ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
            </div>

            {/* Center: Compact Inspector Selector */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 min-w-0 flex-1 max-w-[100px]">
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="bg-transparent text-[10px] font-medium text-gray-700 px-1 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer w-full truncate"
              >
                <option value="all">All Inspectors</option>
                {inspectors?.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Center Right: Date Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => navigateWeeks('prev')}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Previous 4 weeks"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                className=""
              />
              
              <button
                onClick={() => navigateWeeks('next')}
                className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                title="Next 4 weeks"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            {/* Right: Navigation Control */}
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5 flex-shrink-0">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center p-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800"
                title="Dashboard View"
              >
                <Columns2 className="w-3 h-3" />
              </button>
              <button
                className="flex items-center p-1 rounded text-xs font-medium transition-colors bg-white text-blue-600 shadow-sm"
                title="Grid View - Current"
              >
                <Grid3x3 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {/* Grid */}
        <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full relative table-fixed">
            <colgroup>
              <col className="w-48" />
              {weekdays.map((_, index) => (
                <col key={index} className="w-20" />
              ))}
            </colgroup>
            {/* Header row with dates */}
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48 sticky left-0 bg-gray-50 z-30 border-r border-gray-200">
                  Inspector
                </th>
                {weekdays.map((day, index) => (
                  <th 
                    key={index}
                    className="w-20 h-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-gray-400">{format(day, 'M/d')}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Total capacity row */}
            <tbody className="bg-white">
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <td className="w-48 h-16 px-4 py-2 text-sm font-bold text-gray-900 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  <div className="flex items-center gap-2 h-full">
                    <button
                      onClick={() => setShowRegionalBreakdown(!showRegionalBreakdown)}
                      className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {showRegionalBreakdown ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div>Total</div>
                      <div className="text-xs text-gray-500">Daily Capacity</div>
                    </div>
                  </div>
                </td>
                {weekdays.map((day, dayIndex) => {
                  const dayString = format(day, 'yyyy-MM-dd');
                  const capacity = gridData.capacityData?.[dayString] || { totalInspections: 0, totalCapacity: 0, utilizationPercent: 0 };
                  
                  return (
                    <td 
                      key={dayIndex}
                      className="w-20 h-16 px-1 py-1 text-center border-r border-gray-100 relative cursor-pointer hover:opacity-80"
                      title={`${format(day, 'MMM d')}: ${capacity.totalInspections}/${capacity.totalCapacity} inspections (${capacity.utilizationPercent}% utilization) - Click for deals`}
                      onClick={() => handleCapacityCellClick('Total', format(day, 'yyyy-MM-dd'), 'total')}
                    >
                      <div className={`w-full h-full flex items-center justify-center rounded-md ${getCapacityColor(capacity.utilizationPercent)}`}>
                        <div className={`text-sm font-bold ${getTextColor(capacity.utilizationPercent)}`}>
                          {capacity.totalInspections}/{capacity.totalCapacity}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
              
              {/* Regional breakdown rows */}
              {showRegionalBreakdown && (
                <>
                  {Object.keys(gridData.regionalData?.[format(weekdays[0], 'yyyy-MM-dd')] || {})
                    .sort((a, b) => {
                      // Sort by region code R01, R02, R03, etc., then Unknown at end
                      const getRegionNumber = (key) => {
                        const match = key.match(/R(\d+)/);
                        return match ? parseInt(match[1]) : 999; // Unknown regions go to end
                      };
                      return getRegionNumber(a) - getRegionNumber(b);
                    })
                    .map((regionKey) => (
                    <React.Fragment key={regionKey}>
                      {/* Main regional row with nested dropdown */}
                      <tr className="bg-blue-50 border-b border-blue-100">
                        <td className="w-48 h-16 px-6 py-2 text-sm font-medium text-blue-900 border-r border-blue-200 sticky left-0 bg-blue-50 z-10">
                          <div className="pl-6 flex items-center gap-2 h-full">
                            <button
                              onClick={() => setExpandedRegion(expandedRegion === regionKey ? null : regionKey)}
                              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {expandedRegion === regionKey ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            <div>{regionKey}</div>
                          </div>
                        </td>
                      {weekdays.map((day, dayIndex) => {
                        const dayString = format(day, 'yyyy-MM-dd');
                        const regionalCapacity = gridData.regionalData?.[dayString]?.[regionKey] || { 
                          inspections: 0, 
                          capacity: 0, 
                          utilizationPercent: 0,
                          inspectors: 0
                        };
                        
                        return (
                          <td 
                            key={dayIndex}
                            className="w-20 h-16 px-1 py-1 text-center border-r border-blue-100 relative cursor-pointer hover:opacity-80"
                            title={`${regionKey} - ${format(day, 'MMM d')}: ${regionalCapacity.inspections}/${regionalCapacity.capacity} inspections (${regionalCapacity.utilizationPercent}% utilization) - ${regionalCapacity.inspectors} inspectors - Click for deals`}
                            onClick={() => handleCapacityCellClick(regionKey, format(day, 'yyyy-MM-dd'), 'regional')}
                          >
                            <div className={`w-full h-full flex items-center justify-center rounded-md ${getCapacityColor(regionalCapacity.utilizationPercent)}`}>
                              <div className={`text-sm font-medium ${getTextColor(regionalCapacity.utilizationPercent)}`}>
                                {regionalCapacity.inspections}/{regionalCapacity.capacity}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      </tr>
                      
                      {/* Location-specific breakdown when region is expanded */}
                      {expandedRegion === regionKey && (() => {
                        const firstDay = format(weekdays[0], 'yyyy-MM-dd');
                        const locationData = gridData.locationData?.[firstDay]?.[regionKey] || {};
                        console.log(`🔍 Checking location data for ${regionKey} on ${firstDay}:`, locationData);
                        console.log(`📊 All location data:`, gridData.locationData);
                        return Object.keys(locationData).length > 0;
                      })() && (
                        Object.keys(gridData.locationData[format(weekdays[0], 'yyyy-MM-dd')]?.[regionKey] || {})
                          .sort()
                          .map((locationKey) => (
                            <tr key={`${regionKey}-${locationKey}`} className="bg-green-50 border-b border-green-100">
                              <td className="w-48 h-16 px-8 py-2 text-sm font-medium text-green-900 border-r border-green-200 sticky left-0 bg-green-50 z-10">
                                <div className="pl-8 flex items-center h-full">
                                  <div>{locationKey}</div>
                                </div>
                              </td>
                              {weekdays.map((day, dayIndex) => {
                                const dayString = format(day, 'yyyy-MM-dd');
                                const locationCount = gridData.locationData?.[dayString]?.[regionKey]?.[locationKey]?.count || 0;
                                
                                return (
                                  <td 
                                    key={dayIndex}
                                    className="w-20 h-16 px-1 py-1 text-center border-r border-green-100 relative cursor-pointer hover:opacity-80"
                                    title={`${locationKey} on ${format(day, 'MMM d')}: ${locationCount} inspections - Click for deals`}
                                    onClick={() => handleCapacityCellClick(locationKey, format(day, 'yyyy-MM-dd'), 'location')}
                                  >
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="text-sm font-medium text-green-900">
                                        {locationCount > 0 ? locationCount : '-'}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                      )}
                    </React.Fragment>
                  ))}
                </>
              )}
            </tbody>

            {/* Inspector rows */}
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInspectors.map((inspector) => (
                <tr key={inspector.id} className="hover:bg-gray-50">
                  <td className="w-48 h-16 px-4 py-2 text-sm font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white hover:bg-gray-50 z-10">
                    <div className="flex flex-col justify-center h-full">
                      <div>{inspector.name}</div>
                      <div className="text-xs text-gray-500">{inspector.region || inspector.regionName}</div>
                    </div>
                  </td>
                  {weekdays.map((day, dayIndex) => {
                    const dayString = format(day, 'yyyy-MM-dd');
                    const dayData = gridData.inspectorData?.[inspector.id]?.[dayString] || { count: 0, dominantRegion: '', activities: [] };
                    const existingRoster = getRosterForDate(inspector.id, day);
                    const isEditingThisCell = editingCell && editingCell.inspectorId === inspector.id && editingCell.date === dayString;
                    
                    return (
                      <td 
                        key={dayIndex}
                        className="w-20 h-16 px-1 py-1 text-center border-r border-gray-100 relative"
                        title={`${inspector.name} - ${format(day, 'MMM d')}: ${dayData.count} inspections${dayData.dominantRegion ? ` in ${dayData.dominantRegion}` : ''}${isOutOfRegion(inspector, dayData.dominantRegion) ? ' - OUT OF REGION!' : ''}`}
                      >
                        <div 
                          className="h-full relative cursor-pointer hover:bg-gray-100 rounded transition-colors"
                          onClick={() => setEditingCell({ inspectorId: inspector.id, inspectorName: inspector.name, date: dayString })}
                        >
                          {dayData.count > 0 ? (
                            <div className="space-y-1 relative z-10">
                              <div className="text-lg font-bold text-gray-900">
                                {dayData.count}
                              </div>
                              {(existingRoster?.region_code || dayData.dominantRegion) && (
                                <div className={`text-xs px-1 py-0.5 rounded-md flex items-center gap-1 ${
                                  existingRoster?.status && existingRoster.status !== 'working' 
                                    ? getStatusColor(existingRoster.status)
                                    : isOutOfRegion(inspector, existingRoster?.region_code || dayData.dominantRegion) 
                                      ? 'bg-red-500 text-white' 
                                      : getRegionColor(existingRoster?.region_code || dayData.dominantRegion)
                                }`}>
                                  {isOutOfRegion(inspector, existingRoster?.region_code || dayData.dominantRegion) && (
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                  )}
                                  <span>{existingRoster?.region_code || dayData.dominantRegion}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              {existingRoster ? (
                                <div className={`text-xs px-2 py-1 rounded-md ${
                                  existingRoster.status === 'working' && existingRoster.region_code
                                    ? getRegionColor(existingRoster.region_code)
                                    : getStatusColor(existingRoster.status)
                                }`}>
                                  {existingRoster.status === 'working' && existingRoster.region_code 
                                    ? existingRoster.region_code 
                                    : existingRoster.status === 'sick' ? 'Sick'
                                    : existingRoster.status === 'rain' ? 'Rain'
                                    : existingRoster.status === 'rdo' ? 'RDO'
                                    : existingRoster.status === 'annual_leave' ? 'Leave'
                                    : 'Available'
                                  }
                                </div>
                              ) : (
                                <div className="text-gray-300">-</div>
                              )}
                            </div>
                          )}
                          
                          {isEditingThisCell && (
                            <RosterCellEditor
                              inspector={{ id: inspector.id, name: inspector.name }}
                              date={dayString}
                              currentRegion={{ code: existingRoster?.region_code, name: existingRoster?.region_name }}
                              onClose={() => setEditingCell(null)}
                              onSave={(rosterData) => {
                                // The hook will handle the update
                                setEditingCell(null);
                              }}
                            />
                          )}
                        </div>
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
      <div className="mt-2 flex-shrink-0">
        {/* Desktop - Single Row Layout */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-gray-600 overflow-x-auto py-2">
          {/* Capacity Utilization */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span className="font-medium">Capacity:</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getCapacityColor(0)} ${getTextColor(0)}`}>0%</div>
              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getCapacityColor(20)} ${getTextColor(20)}`}>Low</div>
              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getCapacityColor(50)} ${getTextColor(50)}`}>Med</div>
              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getCapacityColor(80)} ${getTextColor(80)}`}>Good</div>
              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getCapacityColor(100)} ${getTextColor(100)}`}>Full</div>
            </div>
          </div>
          
          <div className="w-px h-4 bg-gray-300 flex-shrink-0"></div>
          
          {/* Regional Distribution */}
          <div className="flex items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 flex-shrink-0">
              <MapPin className="h-3 w-3" />
              <span className="font-medium">Regions:</span>
            </div>
            <div className="flex items-center gap-2">
              {['Brisbane', 'Logan', 'Ipswich', 'Gold Coast', 'Sunshine Coast', 'Toowoomba'].map(region => (
                <div key={region} className={`px-1.5 py-0.5 rounded text-[10px] ${getRegionColor(region)} flex-shrink-0`}>
                  {region.split(' ')[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Mobile/Tablet - Two Row Layout */}
        <div className="lg:hidden space-y-2">
          {/* Capacity Utilization Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-600 overflow-x-auto">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Users className="h-3 w-3" />
              <span className="font-medium">Capacity:</span>
            </div>
            <div className={`px-2 py-1 rounded-md ${getCapacityColor(0)} ${getTextColor(0)} flex-shrink-0`}>0%</div>
            <div className={`px-2 py-1 rounded-md ${getCapacityColor(20)} ${getTextColor(20)} flex-shrink-0`}>Low</div>
            <div className={`px-2 py-1 rounded-md ${getCapacityColor(50)} ${getTextColor(50)} flex-shrink-0`}>Medium</div>
            <div className={`px-2 py-1 rounded-md ${getCapacityColor(80)} ${getTextColor(80)} flex-shrink-0`}>Good</div>
            <div className={`px-2 py-1 rounded-md ${getCapacityColor(100)} ${getTextColor(100)} flex-shrink-0`}>Full</div>
          </div>
          
          {/* Regional Distribution Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-600 overflow-x-auto">
            <div className="flex items-center gap-2 flex-shrink-0">
              <MapPin className="h-3 w-3" />
              <span className="font-medium">Regions:</span>
            </div>
            {['Brisbane', 'Logan', 'Ipswich', 'Gold Coast', 'Sunshine Coast', 'Toowoomba'].map(region => (
              <div key={region} className={`px-2 py-1 rounded-md ${getRegionColor(region)} flex-shrink-0`}>
                {region}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Deals Console */}
      {showDealsConsole && selectedRegionData && (
        <DealsDebugConsole
          isOpen={showDealsConsole}
          onClose={handleCloseDealsConsole}
          selectedInspector={selectedInspector === 'all' ? null : inspectors.find(i => i.id === Number(selectedInspector))}
          inspectors={inspectors}
          selectedDate={selectedRegionData.date}
          inspectionActivities={selectedRegionData.inspectionActivities}
          viewMode="grid"
          context={{
            regionKey: selectedRegionData.regionKey,
            mappedRegion: selectedRegionData.mappedRegion,
            regionType: selectedRegionData.regionType,
            regionCenter: selectedRegionData.regionCenter,
            source: 'availability-grid'
          }}
        />
      )}
    </div>
  );
};

export default AvailabilityGrid;