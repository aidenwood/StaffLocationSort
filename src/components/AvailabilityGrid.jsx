import React, { useState, useMemo, useEffect } from 'react';
import { format, addDays, startOfWeek, subWeeks, addWeeks, subDays } from 'date-fns';
import { Calendar, Grid3x3, ChevronLeft, ChevronRight, MapPin, Users, ArrowLeft, Columns2, Map, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { validateAddressInServiceArea, regionCenters } from '../utils/regionValidation.js';
import DatePickerDropdown from './DatePickerDropdown';
import DealsDebugConsole from './DealsDebugConsole';
import RosterCellEditor from './RosterCellEditor';
import { useRosterData } from '../hooks/useRosterData';
import { getRegionFromLabel } from '../data/regionMapping.js';

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
  const { getRosterForDate } = useRosterData(
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

  // Generate 4 weeks of all days (28 days total including weekends)
  const weekdays = useMemo(() => {
    const days = [];
    let currentDay = startDate;
    
    for (let week = 0; week < 4; week++) {
      for (let day = 0; day < 7; day++) { // Sunday to Saturday
        days.push(new Date(currentDay));
        currentDay = addDays(currentDay, 1);
      }
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
    console.log('🔍 GRID LOADING - Activities:', allActivities?.length, 'Inspectors:', filteredInspectors?.length);
    if (!allActivities || !filteredInspectors) {
      console.log('🔍 GRID EARLY EXIT - Missing data');
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
    
    // DEBUG: Check if activities have labels
    if (allActivities.length > 0) {
      console.log('🔍 GRID LABEL CHECK:', allActivities.slice(0,3).map(a => ({id: a.id, label: a.label, subject: a.subject})));
    }
    
    filteredInspectors.forEach(inspector => {
      data[inspector.id] = {};
      let inspectorActivities = 0;
      
      weekdays.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Find activities for this inspector on this day
        // Activities can have owner_id as either appId (small numbers) or Pipedrive ID (large numbers)
        const dayActivities = allActivities.filter(activity => 
          (Number(activity.owner_id) === Number(inspector.id) || 
           Number(activity.owner_id) === Number(inspector.pipedriveId)) &&
          activity.due_date === dayString &&
          !activity.done &&
          activity.due_time && activity.due_time !== '00:00:00'
        );
        
        // Debug activity structure to understand enrichment status
        if (dayActivities.length > 0 && inspector.name === 'Richard Lugert' && dayString === '2026-03-26') {
          console.log(`🔍 SAMPLE ACTIVITY DEBUG for ${inspector.name}:`, {
            activity: dayActivities[0],
            hasCoords: !!(dayActivities[0].coordinates?.lat || dayActivities[0].lat),
            hasAddress: !!dayActivities[0].personAddress,
            hasLabel: !!dayActivities[0].label,
            label: dayActivities[0].label,
            subject: dayActivities[0].subject
          });
        }
        
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

        // Determine most common region based on actual inspection locations
        let dominantRegion = '';
        if (count > 0) {
          const regions = {};
          
          dayActivities.forEach(activity => {
            let region = 'Unknown';
            let confidence = 'low'; // Track confidence level: high, medium, low
            
            
            // Debug logging (disabled to reduce spam)
            // const hasCoords = !!(activity.coordinates?.lat || activity.lat);
            // const hasAddress = !!activity.personAddress;
            // if (hasCoords || hasAddress) {
            //   console.log(`🔍 Activity "${activity.subject}": coords=${hasCoords}, address=${hasAddress}, label=${activity.label}`);
            // }
            
            // PRIORITY 1: Use coordinates for highest accuracy (from geocoded addresses)
            if ((activity.coordinates?.lat && activity.coordinates?.lng) || (activity.lat && activity.lng)) {
              const lat = activity.lat || activity.coordinates?.lat;
              const lng = activity.lng || activity.coordinates?.lng;
              
              if (lat && lng) {
                const regionResult = validateAddressInServiceArea(lat, lng);
                if (regionResult?.closestRegion) {
                  const regionName = regionResult.closestRegion.name;
                  const match = regionName.match(/\((.*?)\)/);
                  if (match) {
                    const cities = match[1].split('/').map(s => s.trim());
                    region = cities[0];
                    confidence = 'high';
                  } else {
                    region = regionResult.closestRegion.code || 'Unknown';
                    confidence = 'high';
                  }
                  console.log(`✅ COORDS: "${activity.subject}" -> ${region}`);
                }
              }
            }
            
            // PRIORITY 2: Use person address for medium accuracy
            if (region === 'Unknown' && activity.personAddress) {
              const address = activity.personAddress.toLowerCase();
              if (address.includes('gold coast') || address.includes('surfers paradise') || address.includes('broadbeach') || address.includes('southport') || address.includes('burleigh')) {
                region = 'Gold Coast';
                confidence = 'medium';
              } else if (address.includes('logan') || address.includes('beenleigh') || address.includes('eagleby') || address.includes('loganholme') || address.includes('marsden') || address.includes('woodridge')) {
                region = 'Logan';
                confidence = 'medium';
              } else if (address.includes('ipswich') || address.includes('springfield') || address.includes('redbank') || address.includes('goodna') || address.includes('booval')) {
                region = 'Ipswich';
                confidence = 'medium';
              } else if (address.includes('brisbane') || address.includes('south bank') || address.includes('fortitude valley') || address.includes('woolloongabba') || address.includes('milton') || address.includes('paddington') || address.includes('toowong') || address.includes('newstead')) {
                region = 'Brisbane Metro';
                confidence = 'medium';
              } else if (address.includes('sunshine coast') || address.includes('caloundra') || address.includes('maroochydore') || address.includes('noosa') || address.includes('nambour') || address.includes('buderim') || address.includes('mooloolaba')) {
                region = 'Sunshine Coast';
                confidence = 'medium';
              } else if (address.includes('toowoomba') || address.includes('darling downs') || address.includes('highfields') || address.includes('rangeville')) {
                region = 'Toowoomba';
                confidence = 'medium';
              } else if (address.includes('gympie') || address.includes('cooroy') || address.includes('pomona')) {
                region = 'Regional QLD';
                confidence = 'medium';
              } else if (address.includes('maryborough') || address.includes('hervey bay') || address.includes('urangan')) {
                region = 'Regional QLD';
                confidence = 'medium';
              } else {
                // Extract suburb and try to map to region
                const suburbMatch = address.match(/([a-zA-Z ]+),\s*qld|([a-zA-Z ]+)\s+qld/i);
                if (suburbMatch) {
                  const suburb = (suburbMatch[1] || suburbMatch[2]).trim().toLowerCase();
                  
                  // Try to map common suburbs to regions
                  if (suburb.includes('gympie') || suburb.includes('cooroy')) {
                    region = 'Regional QLD';
                  } else if (suburb.includes('maryborough') || suburb.includes('hervey')) {
                    region = 'Regional QLD';
                  } else if (suburb.includes('warwick') || suburb.includes('stanthorpe')) {
                    region = 'Toowoomba';
                  } else {
                    // Default to suburb name if we can't map it
                    region = `${suburb.charAt(0).toUpperCase() + suburb.slice(1)}`;
                  }
                  confidence = 'medium';
                }
              }
            }
            
            // PRIORITY 3: Use Pipedrive label field if available  
            if (region === 'Unknown' && activity.label) {
              const label = String(activity.label).trim();
              
              // Skip internal notes format (e.g., "Property Inspection ACTUAL - Scott")
              const isInternalNote = label.includes('ACTUAL') || 
                                   label.includes('Property Inspection') ||
                                   label.includes(' - ') || // Contains person names
                                   label.length > 10 || // Label codes should be short
                                   /[a-zA-Z]{3,}/.test(label); // Contains words (not just numbers)
              
              if (!isInternalNote) {
                // Use the proper CSV mapping for numeric codes only
                const mappedRegion = getRegionFromLabel(label);
                
                if (mappedRegion) {
                  region = mappedRegion;
                  confidence = 'high'; // CSV mapping is authoritative
                  console.log(`🏷️ ACTIVITY LABEL: Code ${label} -> ${region} for "${activity.subject}"`);
                } else {
                  console.log(`❓ UNKNOWN ACTIVITY LABEL: Code "${label}" not found in mapping`);
                }
              } else {
                console.log(`🚫 SKIPPED INTERNAL NOTE: "${label}" for "${activity.subject}"`);
              }
            }
            
            // PRIORITY 4: Use deal label from enriched data (labels are on deals, not activities)
            if (region === 'Unknown' && activity.dealLabel) {
              const dealLabel = String(activity.dealLabel).trim();
              const dealMappedRegion = getRegionFromLabel(dealLabel);
              
              if (dealMappedRegion) {
                region = dealMappedRegion;
                confidence = 'high';
                console.log(`🏢 DEAL LABEL: Code ${dealLabel} -> ${region} for deal ${activity.deal_id}`);
              }
            }
            
            // PRIORITY 5: Text matching fallback
            if (region === 'Unknown' && activity.label) {
              const label = String(activity.label);
              if (label.includes('GOLD COAST')) {
                region = 'Brisbane Metro';
                confidence = 'low';
              } else if (label.includes('LOGAN')) {
                region = 'Brisbane Metro';
                confidence = 'low';
              } else if (label.includes('IPSWICH')) {
                region = 'Brisbane Metro';
                confidence = 'low';
              } else if (label.includes('BRISBANE')) {
                region = 'Brisbane Metro';
                confidence = 'low';
              } else if (label.includes('SUNSHINE COAST')) {
                region = 'Sunshine Coast';
                confidence = 'low';
              } else if (label.includes('TOOWOOMBA')) {
                region = 'Toowoomba';
                confidence = 'low';
              } else {
                region = label; // Use label as-is for unmapped cases
                confidence = 'low';
              }
              // console.log(`🏷️ Processed label "${label}" -> region: "${region}" (confidence: ${confidence})`);
            }
            
            // PRIORITY 4: Use location object
            if (region === 'Unknown' && activity.location?.locality) {
              const locality = activity.location.locality.toLowerCase();
              if (locality.includes('gold coast')) region = 'Gold Coast';
              else if (locality.includes('logan')) region = 'Logan'; 
              else if (locality.includes('ipswich')) region = 'Ipswich';
              else if (locality.includes('brisbane')) region = 'Brisbane';
              else if (locality.includes('sunshine coast')) region = 'Sunshine Coast';
              else if (locality.includes('toowoomba')) region = 'Toowoomba';
              else region = activity.location.locality;
              confidence = 'low';
            }
            
            // Create region key with confidence indicator
            let regionKey;
            if (confidence === 'high') {
              regionKey = region; // No suffix for high confidence
            } else if (confidence === 'medium') {
              regionKey = region; // No suffix for medium confidence  
            } else {
              regionKey = `${region}`; // Keep low confidence regions as-is
            }
            
            regions[regionKey] = (regions[regionKey] || 0) + 1;
            // Log final result for debugging (reduced)
            // if (region !== 'Unknown') {
            //   console.log(`✅ DETECTED: "${activity.subject}" -> ${region}`);
            // } else {
            //   // Debug why detection failed (sample only)
            //   if (Math.random() < 0.02) { // Only 2% of failures
            //     console.log(`❌ FAILED DETECTION SAMPLE: "${activity.subject}"`, {
            //       label: activity.label,
            //       labelType: typeof activity.label,
            //       hasCoords: !!(activity.coordinates?.lat || activity.lat),
            //       hasAddress: !!activity.personAddress
            //     });
            //   }
            // }
          });

          // console.log(`📊 All regions found for ${dayString}:`, regions);

          // Find most common region, prioritizing high-confidence regions
          dominantRegion = Object.keys(regions).reduce((a, b) => {
            // If counts are equal, prefer regions without '(est)' suffix
            if (regions[a] === regions[b]) {
              return !a.includes('(est)') && b.includes('(est)') ? a : b;
            }
            return regions[a] > regions[b] ? a : b;
          }, Object.keys(regions)[0] || '');
          
          // console.log(`🎯 Selected dominant region: "${dominantRegion}" for ${dayString}`);
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
          
          // Skip internal notes format (e.g., "Property Inspection ACTUAL - Scott")
          const isInternalNote = labelValue.includes('ACTUAL') || 
                               labelValue.includes('Property Inspection') ||
                               labelValue.includes(' - ') || // Contains person names
                               labelValue.length > 10 || // Label codes should be short
                               /[a-zA-Z]{3,}/.test(labelValue); // Contains words (not just numbers)
          
          if (labelValue && !isInternalNote) {
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

  // Get background color for actual region pill based on whether it matches rostered region
  const getRegionMatchColor = (inspector, dominantRegion, rosterData) => {
    // If there's roster data and it matches the actual region, use light green
    if (rosterData?.region_code && dominantRegion) {
      const rosteredRegion = rosterData.region_code.toLowerCase();
      const actualRegion = dominantRegion.toLowerCase();
      
      // Map region codes to their covered locations
      const regionCodeMappings = {
        'r01': ['brisbane', 'logan', 'ipswich', 'gold coast', 'beaudesert'],
        'r02': ['gympie', 'maryborough', 'tin can bay'],
        'r03': ['sunshine coast', 'moreton region'],
        'r04': ['gatton', 'toowoomba', 'oakey', 'stanthorpe', 'tara', 'warwick', 'texas'],
        'r05': ['emerald', 'rockhampton', 'roma'],
        'r06': ['grafton', 'port macquarie', 'coffs harbour'],
        'r07': ['tamworth', 'armidale', 'glen innes'],
        'r08': ['grafton', 'port macquarie', 'coffs harbour'],
        'r09': ['aberglasslyn', 'rutherford', 'maitland', 'newcastle', 'mereweather', 'gwandalan', 'port stephens', 'cessnock', 'lake macquarie', 'central coast'],
        'r10': ['sydney', 'penrith', 'parramatta', 'liverpool', 'campbelltown', 'blacktown', 'camden', 'richmond', 'windsor', 'western sydney', 'greater sydney']
      };
      
      // Check if the actual region matches the rostered region code
      const rosteredLocations = regionCodeMappings[rosteredRegion] || [];
      const isMatch = rosteredLocations.some(location => 
        actualRegion.includes(location) || location.includes(actualRegion)
      ) || actualRegion === rosteredRegion || rosteredRegion.includes(actualRegion);
      
      if (isMatch) {
        return 'bg-green-100 text-green-800'; // Light green for match
      } else {
        return 'bg-orange-100 text-orange-800'; // Light orange for mismatch
      }
    }
    
    // Default light gray if no roster data to compare against
    return 'bg-gray-100 text-gray-700';
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
      'R09': 'bg-teal-100 text-teal-800',
      'R10': 'bg-violet-100 text-violet-800'
    };
    
    // Check if it's a region code first
    if (regionCodeColors[region]) {
      return regionCodeColors[region];
    }
    
    // Color mapping for CSV region names
    const colors = {
      // Brisbane Metro Area
      'Brisbane': 'bg-blue-100 text-blue-800',
      'Brisbane Metro': 'bg-blue-100 text-blue-800',
      'Logan': 'bg-green-100 text-green-800', 
      'Ipswich': 'bg-purple-100 text-purple-800',
      'Gold Coast': 'bg-yellow-100 text-yellow-800',
      'Gold Coast/Logan': 'bg-yellow-100 text-yellow-800',
      'Gatton': 'bg-blue-200 text-blue-900',
      
      // Regional QLD
      'Sunshine Coast': 'bg-orange-100 text-orange-800',
      'Toowoomba': 'bg-red-100 text-red-800',
      'Gympie': 'bg-emerald-100 text-emerald-800',
      'Regional QLD': 'bg-emerald-100 text-emerald-800',
      'Maryborough': 'bg-emerald-100 text-emerald-800',
      'Warwick': 'bg-red-200 text-red-900',
      'Stanthorpe': 'bg-red-200 text-red-900',
      'Roma': 'bg-amber-100 text-amber-800',
      'Kingaroy': 'bg-lime-100 text-lime-800',
      'Emerald': 'bg-green-200 text-green-900',
      'Rockhampton': 'bg-orange-200 text-orange-900',
      'Gladstone': 'bg-orange-200 text-orange-900',
      'Biloela': 'bg-orange-200 text-orange-900',
      
      // NSW Regions
      'Regional East': 'bg-cyan-100 text-cyan-800',
      'Newcastle Region': 'bg-indigo-100 text-indigo-800',
      'Regional NSW': 'bg-slate-100 text-slate-800',
      'Glen Innes': 'bg-cyan-100 text-cyan-800',
      'Armidale': 'bg-cyan-100 text-cyan-800',
      'Grafton': 'bg-cyan-100 text-cyan-800',
      'Coffs Harbour': 'bg-cyan-100 text-cyan-800',
      'Newcastle': 'bg-indigo-100 text-indigo-800',
      'Port Macquarie': 'bg-cyan-200 text-cyan-900',
      'Northern NSW': 'bg-cyan-200 text-cyan-900',
      'Penrith': 'bg-violet-100 text-violet-800',
      'Sydney': 'bg-violet-100 text-violet-800',
      'Western Sydney': 'bg-violet-100 text-violet-800',
      'Greater Sydney': 'bg-violet-100 text-violet-800',
      'Parramatta': 'bg-violet-100 text-violet-800',
      'Liverpool': 'bg-violet-100 text-violet-800',
      'Campbelltown': 'bg-violet-100 text-violet-800',
      'Blacktown': 'bg-violet-100 text-violet-800',
      'Camden': 'bg-violet-100 text-violet-800',
      'Richmond': 'bg-violet-100 text-violet-800',
      'Windsor': 'bg-violet-100 text-violet-800'
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
      'annual_leave': 'bg-purple-100 text-purple-800',
      'van_service': 'bg-orange-100 text-orange-800'
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
                <col key={index} className="w-24" />
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
                    className="w-24 h-24 px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                <td className="w-48 h-24 px-4 py-2 text-sm font-bold text-gray-900 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
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
                      className="w-24 h-24 px-1 py-1 text-center border-r border-gray-100 relative cursor-pointer hover:opacity-80"
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
                        <td className="w-48 h-24 px-6 py-2 text-sm font-medium text-blue-900 border-r border-blue-200 sticky left-0 bg-blue-50 z-10">
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
                            className="w-24 h-24 px-1 py-1 text-center border-r border-blue-100 relative cursor-pointer hover:opacity-80"
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
                              <td className="w-48 h-24 px-8 py-2 text-sm font-medium text-green-900 border-r border-green-200 sticky left-0 bg-green-50 z-10">
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
                                    className="w-24 h-24 px-1 py-1 text-center border-r border-green-100 relative cursor-pointer hover:opacity-80"
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
                  <td className="w-48 h-24 px-4 py-2 text-sm font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white hover:bg-gray-50 z-50">
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
                        className="w-24 h-24 px-1 py-1 text-center border-r border-gray-100 relative"
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
                              {/* Dual region pills layout */}
                              <div className="space-y-1">
                                {/* Supabase roster region pill */}
                                {existingRoster?.region_code && (
                                  <div className={`text-xs px-2 py-1 rounded-md flex items-center justify-center gap-1 ${
                                    existingRoster?.status && existingRoster.status !== 'working' 
                                      ? getStatusColor(existingRoster.status)
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    <span className="font-medium">{existingRoster.region_code}</span>
                                    <span className="text-[10px] opacity-75">ROSTERED</span>
                                  </div>
                                )}
                                {/* Pipedrive detected region pill */}
                                {(() => {
                                  const shouldShow = dayData.dominantRegion && 
                                    dayData.dominantRegion !== 'Unknown' &&
                                    dayData.dominantRegion.trim() !== '';
                                  
                                  // Debug for missing pills (disabled to reduce spam)
                                  // if (dayData.count > 0 && !shouldShow) {
                                  //   console.log(`❌ MISSING PILL: ${inspector.name} on ${dayString} - count: ${dayData.count}, dominantRegion: "${dayData.dominantRegion}"`);
                                  // }
                                  
                                  // Debug logging removed - was causing console spam
                                  return shouldShow;
                                })() && (
                                  <div 
                                    className={`text-xs px-2 py-1 rounded-md flex items-center justify-center gap-1 ${getRegionMatchColor(inspector, dayData.dominantRegion, existingRoster)}`}
                                    style={{
                                      zIndex: 99999,
                                      position: 'relative',
                                      minWidth: '60px',
                                      minHeight: '20px'
                                    }}
                                  >
                                    {isOutOfRegion(inspector, dayData.dominantRegion) && (
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                    )}
                                    <span className="font-medium">{dayData.dominantRegion.replace(' (est)', '')}</span>
                                    <span className="text-[10px] opacity-75">ACTUAL</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-1">
                              {existingRoster ? (
                                <div className="space-y-1">
                                  {/* Supabase roster region pill for non-working days */}
                                  {existingRoster.status === 'working' && existingRoster.region_code ? (
                                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md flex items-center justify-center gap-1">
                                      <span className="font-medium">{existingRoster.region_code}</span>
                                      <span className="text-[10px] opacity-75">ROSTERED</span>
                                    </div>
                                  ) : (
                                    <div className={`text-xs px-2 py-1 rounded-md ${
                                      getStatusColor(existingRoster.status)
                                    }`}>
                                      {existingRoster.status === 'sick' ? 'Sick'
                                      : existingRoster.status === 'rain' ? 'Rain'
                                      : existingRoster.status === 'rdo' ? 'RDO'
                                      : existingRoster.status === 'annual_leave' ? 'Leave'
                                      : existingRoster.status === 'van_service' ? 'Van Service'
                                      : 'Available'
                                      }
                                    </div>
                                  )}
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
                                console.log('✅ Roster updated:', rosterData);
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