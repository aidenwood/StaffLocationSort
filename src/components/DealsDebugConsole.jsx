import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw, MapPin, DollarSign, User, Phone, Navigation, Target, Clock, ExternalLink, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { 
  getDealsForRegion, 
  getRecommendationDeals, 
  healthCheckDeals,
  sortDealsByDistance,
  groupDealsByProximity,
  REGIONAL_DEAL_FILTERS 
} from '../api/pipedriveDeals.js';

const DealsDebugConsole = ({ 
  isOpen, 
  onClose, 
  selectedInspector, 
  inspectors, 
  selectedDate, 
  inspectionActivities = [],
  viewMode = 'split', // 'split', 'calendar', 'map'
  onDealsUpdate = () => {}, // Callback to update deals shown on map
  context = null, // Context from time slot button (timeSlot, date, radius, etc.)
  dealStageFilter = 'all' // Stage filter: 'all', 'lead_to_book', 'lead_interested'
}) => {
  
  // Get distance-based color scheme - bright purple for close, fading for distant
  const getDistanceColor = (distance) => {
    if (!distance) return 'bg-gray-100 text-gray-600';
    
    if (distance <= 1) return 'bg-purple-600 text-white'; // Bright purple for 1km
    if (distance <= 2.5) return 'bg-purple-500 text-white opacity-90'; // Slightly less intense
    if (distance <= 5) return 'bg-purple-400 text-white opacity-80'; // Medium purple
    if (distance <= 10) return 'bg-purple-300 text-purple-900 opacity-70'; // Light purple with dark text
    if (distance <= 15) return 'bg-purple-200 text-purple-800 opacity-60'; // Very light purple
    if (distance <= 30) return 'bg-purple-100 text-purple-700 opacity-50'; // Barely purple
    return 'bg-gray-100 text-gray-600 opacity-40'; // Very muted for far distances
  };

  // Get card border/background for distance-based highlighting
  const getCardDistanceStyle = (deal) => {
    const distance = deal.distanceInfo?.minDistance;
    if (!distance) return 'border border-gray-200 bg-white';
    
    if (distance <= 1) return 'border-2 border-purple-600 bg-purple-50 shadow-md'; // Strong highlight for closest
    if (distance <= 2.5) return 'border-2 border-purple-500 bg-purple-50'; // Medium highlight  
    if (distance <= 5) return 'border border-purple-400 bg-purple-50/50'; // Light highlight
    return 'border border-gray-200 bg-white'; // Default for distant deals
  };
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('R1');
  const [dealType, setDealType] = useState('all'); // 'all' or 'recommendations'
  const [sortByDistance, setSortByDistance] = useState(true); // Default to true
  const [selectedSortInspection, setSelectedSortInspection] = useState('all'); // 'all' or inspection ID
  const [distanceStats, setDistanceStats] = useState(null);
  const [selectedDistanceFilter, setSelectedDistanceFilter] = useState(null); // 5, 10, 15 or null for all
  const [proximityAnalysis, setProximityAnalysis] = useState(null);
  const [hoveredDeal, setHoveredDeal] = useState(null); // For showing individual deal on map
  const [selectedDeals, setSelectedDeals] = useState([]); // For showing multiple selected deals on map
  const [showAll, setShowAll] = useState(false); // Show all deals in current radius on map
  const [lastFetchTime, setLastFetchTime] = useState(null); // Track when deals were last fetched

  // Helper function to handle radius changes and update map markers if toggle is on
  const handleRadiusChange = (newRadius) => {
    const wasToggleOn = showAll;
    setSelectedDistanceFilter(newRadius);
    
    // If the toggle is on, automatically update map markers to show new radius deals
    if (wasToggleOn) {
      setTimeout(() => {
        const newFilteredDeals = newRadius === null 
          ? processedDeals.filter(deal => deal.coordinates)
          : processedDeals.filter(deal => 
              deal.coordinates && 
              deal.distanceInfo?.minDistance !== null && 
              deal.distanceInfo.minDistance <= newRadius
            );
        setSelectedDeals(newFilteredDeals.map(deal => ({...deal, isSelected: true})));
      }, 0); // Use timeout to ensure state update happens after filteredDeals updates
    }
  };

  // Toggle deal selection for map display
  const toggleDealSelection = (deal) => {
    setSelectedDeals(prev => {
      const isSelected = prev.find(d => d.id === deal.id);
      if (isSelected) {
        // Remove deal
        return prev.filter(d => d.id !== deal.id);
      } else {
        // Add deal
        return [...prev, {...deal, isSelected: true}];
      }
    });
  };

  // Set radius filter based on context when console opens
  useEffect(() => {
    if (isOpen && context?.radius) {
      setSelectedDistanceFilter(context.radius);
    }
  }, [isOpen, context]);


  // Get region for current inspector
  const currentInspector = inspectors?.find(i => i.id === selectedInspector);
  const inspectorHomeRegion = currentInspector?.region || 'R1';
  
  // Determine region based on inspection locations (overrides inspector home region)
  const determineRegionFromInspections = (activities) => {
    if (!activities || activities.length === 0) return inspectorHomeRegion;
    
    // Check addresses for region keywords - use multiple address sources
    const addresses = activities.map(a => {
      const sources = [
        a.personAddress?.address,
        a.address,
        a.enrichedAddress,
        a.subject // Sometimes addresses are in the subject line
      ];
      return sources.find(addr => addr && addr.length > 10) || '';
    }).filter(Boolean).map(addr => addr.toLowerCase());
    
    // Region detection from addresses
    
    // Logan area -> R01 (check for specific suburbs)
    const loganKeywords = ['waterford', 'rochedale', 'woodridge', 'bahrs scrub', 'eagleby', 'beenleigh', 'logan', 'gold coast', 'brisbane', 'ipswich'];
    if (addresses.some(addr => loganKeywords.some(keyword => addr.includes(keyword)))) {
      return 'R01';
    }
    
    // Sunshine Coast -> R03  
    const sunshineCoastKeywords = ['sunshine coast', 'caloundra', 'maroochydore', 'noosa', 'golden beach', 'little mountain', 'twin waters'];
    if (addresses.some(addr => sunshineCoastKeywords.some(keyword => addr.includes(keyword)))) {
      return 'R03';
    }
    
    // Newcastle -> R09
    const newcastleKeywords = ['newcastle', 'maitland', 'cessnock', 'central coast', 'fletcher', 'belmont'];
    if (addresses.some(addr => newcastleKeywords.some(keyword => addr.includes(keyword)))) {
      return 'R09';
    }
    
    return inspectorHomeRegion;
  };
  
  // ⚠️ URGENT: Memoize region calculation to prevent infinite loops in useEffect
  const inspectorRegion = useMemo(() => {
    return determineRegionFromInspections(inspectionActivities);
  }, [inspectionActivities, inspectorHomeRegion]);

  // ⚠️ URGENT: Wrap fetchDeals in useCallback to prevent infinite loops in useEffect
  const fetchDeals = useCallback(async (region = selectedRegion, type = dealType) => {
    setLoading(true);
    setError(null);
    
    try {
      
      let result;
      if (type === 'recommendations') {
        result = await getRecommendationDeals(region);
      } else {
        result = await getDealsForRegion(region, { limit: 200 }); // Increased to get all 197 deals
      }
      
      let processedDeals = result || [];
      
      // Apply stage filter FIRST (before distance calculation)
      if (dealStageFilter !== 'all') {
        // Log stage names to debug
        const stageNames = [...new Set(processedDeals.map(d => d.stageName).filter(Boolean))];
        console.log(`📋 Available stage names: ${stageNames.join(', ')}`);
        
        processedDeals = processedDeals.filter(deal => {
          // If no stageName, don't filter out (show the deal)
          if (!deal.stageName) {
            console.warn(`⚠️ Deal ${deal.id} has no stageName, including in results`);
            return true;
          }
          const stageLower = deal.stageName.toLowerCase();
          
          if (dealStageFilter === 'lead_to_book') {
            // More flexible matching for "Lead to Book" stages
            return stageLower.includes('book') || 
                   stageLower.includes('to book') || 
                   stageLower.includes('ready') ||
                   stageLower === 'lead to book';
          } else if (dealStageFilter === 'lead_interested') {
            // More flexible matching for "Lead Interested" stages
            return stageLower.includes('interested') || 
                   stageLower.includes('lead interested') ||
                   stageLower.includes('qualify') ||
                   stageLower === 'lead interested';
          }
          return true;
        });
        console.log(`🎯 Stage filter applied early: ${processedDeals.length}/${(result || []).length} deals match "${dealStageFilter}"`);
      }
      
      // Apply distance sorting if enabled and we have inspection activities
      if (sortByDistance && inspectionActivities.length > 0) {
        
        // Summary logging only
        const dealsWithCoords = processedDeals.filter(d => d.coordinates).length;
        const inspectionsWithCoords = inspectionActivities.filter(a => 
          a.coordinates || a.personAddress?.coordinates || (a.lat && a.lng)
        ).length;
        
        // Determine which inspections to use for sorting
        let sortingInspections = inspectionActivities;
        
        // Check for sort-by inspection from window (set by calendar button click)
        if (window.dealsSortByInspection) {
          sortingInspections = [window.dealsSortByInspection];
          // Auto-select this inspection in dropdown
          setSelectedSortInspection(window.dealsSortByInspection.id.toString());
          // Clear the window variable
          window.dealsSortByInspection = null;
        } else if (selectedSortInspection !== 'all') {
          // Use specific inspection from dropdown
          const selectedInspection = inspectionActivities.find(a => a.id.toString() === selectedSortInspection);
          if (selectedInspection) {
            sortingInspections = [selectedInspection];
          }
        }
        
        processedDeals = sortDealsByDistance(processedDeals, sortingInspections);
        
        // Calculate distance statistics
        const dealsWithDistance = processedDeals.filter(d => d.distanceInfo && d.distanceInfo.minDistance !== null);
        
        if (dealsWithDistance.length > 0) {
          const stats = {
            within_1km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 1).length,
            within_2_5km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 2.5).length,
            within_5km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 5).length,
            within_10km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 10).length,
            within_15km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 15).length,
            within_30km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 30).length,
            total_with_distance: dealsWithDistance.length
          };
          setDistanceStats(stats);
        } else {
          setDistanceStats(null);
        }
        
        // Auto-select smallest radius with deals when opened from calendar button
        if (window.dealsSortByInspection && stats) {
          if (stats.within_1km > 0) {
            setSelectedDistanceFilter(1);
          } else if (stats.within_5km > 0) {
            setSelectedDistanceFilter(5);
          } else if (stats.within_10km > 0) {
            setSelectedDistanceFilter(10);
          } else if (stats.within_15km > 0) {
            setSelectedDistanceFilter(15);
          } else if (stats.within_30km > 0) {
            setSelectedDistanceFilter(30);
          }
        }
        
        console.log(`✅ ${dealsWithDistance.length} deals successfully sorted by distance`);
      }
      
      // Calculate proximity analysis for time slot opportunities
      if (inspectionActivities.length > 0 && processedDeals.length > 0) {
        const proximityData = groupDealsByProximity(processedDeals, inspectionActivities, 1); // 1km threshold
        setProximityAnalysis(proximityData);
        console.log('🎯 Proximity analysis complete:', {
          activitiesWithDeals: proximityData.summary.activitiesWithDeals,
          totalConnections: proximityData.summary.totalNearbyConnections
        });
      } else {
        setProximityAnalysis(null);
      }
      
      setDeals(processedDeals);
      setLastFetchTime(new Date()); // Track when deals were fetched
      console.log(`✅ Loaded ${processedDeals.length} deals for region ${region}${sortByDistance ? ' (sorted by distance)' : ''}${dealStageFilter !== 'all' ? ` (filtered by ${dealStageFilter})` : ''}`);
      
    } catch (err) {
      console.error('❌ Error fetching deals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, dealType, sortByDistance, inspectionActivities, selectedSortInspection, dealStageFilter]);

  // Filter deals based on selected distance
  const filteredDeals = selectedDistanceFilter 
    ? deals.filter(deal => 
        deal.distanceInfo && 
        deal.distanceInfo.minDistance !== null && 
        deal.distanceInfo.minDistance <= selectedDistanceFilter
      )
    : deals;

  // Handle Show All functionality - auto-select all deals in current radius
  // ⚠️ URGENT: NEVER use useEffect for this - creates infinite loop with selectedDeals state
  // ⚠️ URGENT: Show All functionality moved to onClick handler to prevent loops
  // DISABLED TO STOP INFINITE LOOP
  // useEffect(() => {
  //   if (showAll && filteredDeals.length > 0) {
  //     // Select all deals in current radius filter that have coordinates
  //     const dealsToSelect = filteredDeals.filter(deal => deal.coordinates);
  //     setSelectedDeals(dealsToSelect.map(deal => ({...deal, isSelected: true})));
  //   } else if (!showAll) {
  //     // Clear selections when Show All is turned off
  //     setSelectedDeals([]);
  //   }
  // }, [showAll, filteredDeals]);

  // Send 1km deals + selected deals + hovered deal to map
  // ⚠️ URGENT: onDealsUpdate removed from deps to prevent infinite callback loops
  useEffect(() => {
    if (isOpen && deals.length > 0) {
      // Filter deals within 1km for map display
      const dealsWithin1km = deals.filter(deal => 
        deal.distanceInfo && 
        deal.distanceInfo.minDistance !== null && 
        deal.distanceInfo.minDistance <= 1.0 &&
        deal.coordinates // Only include deals with coordinates
      );

      // Start with 1km deals
      let dealsToShow = [...dealsWithin1km];

      // Add selected deals (even if outside 1km)
      selectedDeals.forEach(selectedDeal => {
        if (selectedDeal.coordinates && !dealsToShow.find(d => d.id === selectedDeal.id)) {
          dealsToShow.push({...selectedDeal, isSelected: true});
        }
      });

      // Add hovered deal if it exists and has coordinates
      if (hoveredDeal && hoveredDeal.coordinates && 
          !dealsToShow.find(d => d.id === hoveredDeal.id)) {
        dealsToShow.push({...hoveredDeal, isHovered: true});
      }
      
      // Mark selected deals in the array
      dealsToShow = dealsToShow.map(deal => ({
        ...deal,
        isSelected: selectedDeals.find(d => d.id === deal.id) ? true : deal.isSelected,
        isHovered: hoveredDeal?.id === deal.id ? true : deal.isHovered
      }));
      
      onDealsUpdate(dealsToShow);
    }
  }, [isOpen, deals, hoveredDeal, selectedDeals]);

  // Handle console closing separately to avoid infinite loop
  useEffect(() => {
    if (!isOpen) {
      setSelectedDeals([]); // Clear selections when closing
      onDealsUpdate([]);
    }
  }, [isOpen, onDealsUpdate]);

  // ⚠️ URGENT: Wrap checkHealth in useCallback to prevent infinite loops in useEffect
  const checkHealth = useCallback(async () => {
    try {
      const health = await healthCheckDeals();
      setHealthStatus(health);
    } catch (err) {
      setHealthStatus({ success: false, message: err.message });
    }
  }, []);

  // Fetch deals when component opens or settings change
  useEffect(() => {
    if (isOpen) {
      fetchDeals();
      checkHealth();
    }
  }, [isOpen, selectedRegion, dealType, sortByDistance, selectedSortInspection, fetchDeals, checkHealth]);

  // Update region when inspector or inspections change
  useEffect(() => {
    if (inspectorRegion && inspectorRegion !== selectedRegion) {
      console.log(`📍 Region: ${inspectorRegion}`);
      setSelectedRegion(inspectorRegion);
    }
  }, [inspectorRegion, inspectionActivities]);

  // Set region based on context from grid click
  useEffect(() => {
    if (context && context.source === 'availability-grid' && context.mappedRegion) {
      console.log(`🎯 Grid Context: Setting region to ${context.mappedRegion} for ${context.regionKey}`);
      setSelectedRegion(context.mappedRegion);
      
      // If it's a total view, we might want to show recommendations instead
      if (context.regionType === 'total') {
        setDealType('recommendations');
      } else {
        setDealType('all');
      }

      // For grid context with region center, create a mock inspection activity
      // at the region center to enable proper distance sorting
      if (context.regionCenter) {
        console.log(`📍 Creating distance anchor at region center: ${context.regionCenter.lat}, ${context.regionCenter.lng}`);
        
        // Set a global variable that the distance sorting function can use
        window.gridRegionCenter = {
          lat: context.regionCenter.lat,
          lng: context.regionCenter.lng,
          name: context.regionKey
        };
      }
    }
  }, [context]);

  // Clear grid region center when console is closed
  useEffect(() => {
    if (!isOpen && window.gridRegionCenter) {
      console.log('🧹 Clearing grid region center');
      delete window.gridRegionCenter;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Different positioning based on view mode
  const getModalClasses = () => {
    if (viewMode === 'split') {
      // In split view, position over the left half (calendar section)
      return "fixed left-0 top-0 bottom-0 w-1/2 bg-black bg-opacity-50 flex items-center justify-center z-50 lg:left-4 lg:top-4 lg:bottom-4 lg:w-[calc(50%-2rem)]";
    } else {
      // Full screen modal for calendar or map only views
      return "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    }
  };

  const getContentClasses = () => {
    if (viewMode === 'split') {
      return "bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] m-4 flex flex-col";
    } else {
      return "bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-6xl max-h-[90vh] m-4 flex flex-col";
    }
  };

  return (
    <div className={getModalClasses()}>
      <div className={getContentClasses()}>
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <h2 className="text-sm font-medium text-gray-900 truncate">
              {context && context.source === 'availability-grid' ? 
                `Deals Console - ${context.regionKey} - ${format(selectedDate, 'MMM d, yyyy')}` :
                context ? 
                  `Deals Console - ${context.formattedTime}, ${context.formattedDate}` : 
                  'Deals Console'
              }
            </h2>
            {dealStageFilter !== 'all' && (
              <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                dealStageFilter === 'lead_to_book' ? 'bg-green-100 text-green-700' :
                dealStageFilter === 'lead_interested' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {dealStageFilter === 'lead_to_book' ? 'Lead to Book' :
                 dealStageFilter === 'lead_interested' ? 'Lead Interested' :
                 dealStageFilter}
              </span>
            )}
            {lastFetchTime && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500" title={`Last updated: ${lastFetchTime.toLocaleString()}`}>
                  Updated {lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded" title="Live data from Pipedrive API">
                  Live
                </span>
              </div>
            )}
            {healthStatus && (
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                healthStatus.success ? 'bg-green-500' : 'bg-red-500'
              }`} title={healthStatus.success ? 'API Connected' : 'API Error'} />
            )}
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => fetchDeals()}
              disabled={loading}
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              title="Refresh Deals"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Compact Distance Controls */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => handleRadiusChange(1)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 1 ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  1km ({distanceStats?.within_1km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(2.5)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 2.5 ? 'bg-purple-500 text-white shadow-md' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  2.5km ({distanceStats?.within_2_5km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(5)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 5 ? 'bg-purple-400 text-white shadow-md' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  5km ({distanceStats?.within_5km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(10)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 10 ? 'bg-purple-300 text-purple-900 shadow-md' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                  }`}
                >
                  10km ({distanceStats?.within_10km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(15)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 15 ? 'bg-purple-200 text-purple-800 shadow-md' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  }`}
                >
                  15km ({distanceStats?.within_15km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(30)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 30 ? 'bg-purple-100 text-purple-700 shadow-md' : 'bg-gray-100 text-purple-500 hover:bg-purple-50'
                  }`}
                >
                  30km ({distanceStats?.within_30km || 0})
                </button>
                <button
                  onClick={() => handleRadiusChange(null)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === null ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({distanceStats?.total_with_distance || 0})
                </button>
              </div>
            </div>
            
            {/* Show All Toggle - Improved Toggle Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Toggle Switch */}
                <button
                  onClick={() => {
                    // ⚠️ URGENT: Show All logic moved here from useEffect to prevent infinite loops
                    if (!showAll) {
                      // Show All - select all deals in current radius
                      const dealsToSelect = filteredDeals.filter(deal => deal.coordinates);
                      setSelectedDeals(dealsToSelect.map(deal => ({...deal, isSelected: true})));
                      setShowAll(true);
                    } else {
                      // Hide All - clear selections
                      setSelectedDeals([]);
                      setShowAll(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    showAll ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  title={showAll ? 'Hide all deals from map' : `Show all ${filteredDeals.filter(d => d.coordinates).length} deals on map`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-lg ${
                      showAll ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Controls */}
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 space-y-2">
          {/* Top row: selectors and checkbox */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            >
              {Object.entries(REGIONAL_DEAL_FILTERS).map(([key, filter]) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            
            <select
              value={dealType}
              onChange={(e) => setDealType(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            >
              <option value="all">All</option>
              <option value="recommendations">Recs</option>
            </select>
            
            {inspectionActivities.length > 0 && (
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortByDistance}
                  onChange={(e) => setSortByDistance(e.target.checked)}
                  className="w-3 h-3"
                />
                <span>By distance</span>
              </label>
            )}
            
            {/* Inspector dropdown for multi-inspection sorting */}
            {sortByDistance && inspectionActivities.length > 1 && (
              <select
                value={selectedSortInspection}
                onChange={(e) => setSelectedSortInspection(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="all">All</option>
                {inspectionActivities.map(activity => (
                  <option key={activity.id} value={activity.id.toString()}>
                    {activity.due_time} - {activity.personAddress?.split(',')[0] || activity.subject?.substring(0, 15)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Bottom row: status */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            {currentInspector && (
              <span>{currentInspector.name} ({inspectorRegion})</span>
            )}
            
            <span>
              {loading ? 'Loading...' : (
                selectedDistanceFilter 
                  ? `${filteredDeals.length} of ${deals.length} deals`
                  : `${deals.length} deals`
              )}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-medium">Error:</span>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}


          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></div>
              <span className="ml-3 text-gray-600">Loading deals...</span>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{selectedDistanceFilter 
                  ? `No deals found within ${selectedDistanceFilter}km of today's inspections`
                  : 'No deals found for this region'
                }</p>
              <p className="text-sm mt-1">
                {selectedDistanceFilter 
                  ? 'Try increasing the distance filter or check if inspections have coordinates'
                  : 'Try refreshing or check the filter configuration'
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDeals.map((deal, index) => (
                <div key={deal.id || index} className={`${getCardDistanceStyle(deal)} rounded-lg p-3 hover:shadow-md transition-all duration-200`}>
                  {/* Title Row */}
                  <div className="mb-2">
                    <h3 className="font-medium text-gray-900 text-sm leading-tight">{deal.title}</h3>
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                   
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                        deal.priority === 'high' ? 'bg-red-100 text-red-700' :
                        deal.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {deal.priority}
                      </span>
                    {deal.stageName && (
                      <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                        deal.stageName.toLowerCase().includes('book') ? 'bg-green-100 text-green-700' :
                        deal.stageName.toLowerCase().includes('interested') ? 'bg-blue-100 text-blue-700' :
                        deal.stageName.toLowerCase().includes('lead') ? 'bg-yellow-100 text-yellow-700' :
                        deal.stageName.toLowerCase().includes('close') || deal.stageName.toLowerCase().includes('won') ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {deal.stageName}
                      </span>
                    )}
                    {deal.person?.name && (
                      <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                        <User className="w-3 h-3" />
                        {deal.person.name}
                      </div>
                    )}
                    {deal.person?.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {deal.person.phone}
                      </div>
                    )}

                    {deal.distanceInfo && deal.distanceInfo.minDistance !== null && (
                        <span className={`px-1.5 py-0.5 text-xs rounded flex items-center gap-1 font-medium ${getDistanceColor(deal.distanceInfo.minDistance)}`}>
                          <Navigation className="w-2.5 h-2.5" />
                          {deal.distanceInfo.minDistance.toFixed(1)}km
                        </span>
                      )}
                  </div>

                  {/* Pills and Actions Row */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Left side pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      
                      
                      {deal.coordinates && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded" title={`${deal.coordinates.lat?.toFixed(4)}, ${deal.coordinates.lng?.toFixed(4)}`}>
                          📍 {deal.coordinates.lat?.toFixed(2)}, {deal.coordinates.lng?.toFixed(2)}
                        </span>
                      )}
                      

                      {/* Address Row */}
                      {deal.address && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {deal.address}
                          </div>
                      )}
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {deal.coordinates && (
                        <button
                          onClick={() => toggleDealSelection(deal)}
                          onMouseEnter={() => setHoveredDeal(deal)}
                          onMouseLeave={() => setHoveredDeal(null)}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
                            selectedDeals.find(d => d.id === deal.id)
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'hover:bg-purple-100 text-purple-600'
                          }`}
                          title={selectedDeals.find(d => d.id === deal.id) ? "Hide from map" : "Show on map"}
                        >
                          <Eye className={`w-3 h-3 ${selectedDeals.find(d => d.id === deal.id) ? 'text-white' : 'text-purple-600'}`} />
                          <span className={`text-xs ${selectedDeals.find(d => d.id === deal.id) ? 'text-white' : 'text-purple-600'}`}>
                            {selectedDeals.find(d => d.id === deal.id) ? 'Hide' : 'Map'}
                          </span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => window.open(`https://rebuildrelief.pipedrive.com/deal/${deal.id}`, '_blank')}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-orange-100 rounded transition-colors"
                        title="Open in Pipedrive"
                      >
                        <ExternalLink className="w-3 h-3 text-orange-600" />
                        <span className="text-xs text-orange-600">Open</span>
                      </button>
                    </div>
                  </div>
                  
                  
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div>
              Filter ID: {REGIONAL_DEAL_FILTERS[selectedRegion]?.filterId} | 
              Region: {REGIONAL_DEAL_FILTERS[selectedRegion]?.name}
            </div>
            {healthStatus && (
              <div>
                Last Health Check: {new Date(healthStatus.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealsDebugConsole;