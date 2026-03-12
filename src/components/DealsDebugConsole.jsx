import React, { useState, useEffect } from 'react';
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
  context = null // Context from time slot button (timeSlot, date, radius, etc.)
}) => {
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
  
  const inspectorRegion = determineRegionFromInspections(inspectionActivities);

  const fetchDeals = async (region = selectedRegion, type = dealType) => {
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
      console.log(`✅ Loaded ${processedDeals.length} deals for region ${region}${sortByDistance ? ' (sorted by distance)' : ''}`);
      
    } catch (err) {
      console.error('❌ Error fetching deals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter deals based on selected distance
  const filteredDeals = selectedDistanceFilter 
    ? deals.filter(deal => 
        deal.distanceInfo && 
        deal.distanceInfo.minDistance !== null && 
        deal.distanceInfo.minDistance <= selectedDistanceFilter
      )
    : deals;

  // Send 1km deals + selected deals + hovered deal to map
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
      
      console.log(`📍 Sending ${dealsWithin1km.length} deals within 1km + ${selectedDeals.length} selected${hoveredDeal ? ' + 1 hovered' : ''} to map`);
      onDealsUpdate(dealsToShow);
    } else if (!isOpen) {
      // Clear deals from map when console closes
      setSelectedDeals([]); // Clear selections when closing
      onDealsUpdate([]);
    }
  }, [isOpen, deals, hoveredDeal, selectedDeals, onDealsUpdate]);

  const checkHealth = async () => {
    try {
      const health = await healthCheckDeals();
      setHealthStatus(health);
    } catch (err) {
      setHealthStatus({ success: false, message: err.message });
    }
  };

  // Fetch deals when component opens or settings change
  useEffect(() => {
    if (isOpen) {
      fetchDeals();
      checkHealth();
    }
  }, [isOpen, selectedRegion, dealType, sortByDistance, selectedSortInspection]);

  // Update region when inspector or inspections change
  useEffect(() => {
    if (inspectorRegion && inspectorRegion !== selectedRegion) {
      console.log(`📍 Region: ${inspectorRegion}`);
      setSelectedRegion(inspectorRegion);
    }
  }, [inspectorRegion, inspectionActivities]);

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
              {context ? 
                `Deals Console - ${context.formattedTime}, ${context.formattedDate}` : 
                'Deals Console'
              }
            </h2>
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
              <Target className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Radius:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 1 ? null : 1)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 1 ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  1km ({distanceStats?.within_1km || 0})
                </button>
                <button
                  onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 2.5 ? null : 2.5)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 2.5 ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  2.5km ({distanceStats?.within_2_5km || 0})
                </button>
                <button
                  onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 5 ? null : 5)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 5 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  5km ({distanceStats?.within_5km || 0})
                </button>
                <button
                  onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 10 ? null : 10)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 10 ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  10km ({distanceStats?.within_10km || 0})
                </button>
                <button
                  onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 15 ? null : 15)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === 15 ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  15km ({distanceStats?.within_15km || 0})
                </button>
                <button
                  onClick={() => setSelectedDistanceFilter(null)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedDistanceFilter === null ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({distanceStats?.total_with_distance || 0})
                </button>
              </div>
            </div>
            
            {/* Show All Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  showAll ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
              >
                <Eye className="w-3 h-3" />
                {showAll ? 'Hide All' : 'Show All'}
              </button>
              <span className="text-xs text-gray-500">
                {selectedDate ? format(selectedDate, 'MMM d') : 'Today'} • {inspectionActivities.length} inspection{inspectionActivities.length !== 1 ? 's' : ''}
              </span>
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
                <div key={deal.id || index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  {/* Title Row */}
                  <div className="mb-2">
                    <h3 className="font-medium text-gray-900 text-sm leading-tight">{deal.title}</h3>
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center gap-3 mb-2 text-xs text-gray-600">
                    {deal.value && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${deal.value}
                      </div>
                    )}
                    {deal.person?.name && (
                      <div className="flex items-center gap-1">
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
                  </div>

                  {/* Pills and Actions Row */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Left side pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        deal.priority === 'high' ? 'bg-red-100 text-red-700' :
                        deal.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {deal.priority}
                      </span>
                      
                      {deal.coordinates && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded" title={`${deal.coordinates.lat?.toFixed(4)}, ${deal.coordinates.lng?.toFixed(4)}`}>
                          📍 {deal.coordinates.lat?.toFixed(2)}, {deal.coordinates.lng?.toFixed(2)}
                        </span>
                      )}
                      
                      {deal.distanceInfo && deal.distanceInfo.minDistance !== null && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5" />
                          {deal.distanceInfo.minDistance.toFixed(1)}km
                        </span>
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
                  
                  {/* Address Row */}
                  {deal.address && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {deal.address}
                      </div>
                    </div>
                  )}
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