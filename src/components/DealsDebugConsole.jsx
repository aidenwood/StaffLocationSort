import React, { useState, useEffect } from 'react';
import { X, RefreshCw, MapPin, DollarSign, User, Phone, Navigation, Target, Clock } from 'lucide-react';
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
  inspectionActivities = [] 
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
    
    console.log('🔍 Checking addresses for region detection:', addresses.slice(0, 3));
    
    // Logan area -> R01 (check for specific suburbs)
    const loganKeywords = ['waterford', 'rochedale', 'woodridge', 'bahrs scrub', 'eagleby', 'beenleigh', 'logan', 'gold coast', 'brisbane', 'ipswich'];
    if (addresses.some(addr => loganKeywords.some(keyword => addr.includes(keyword)))) {
      console.log('🌍 Detected Logan/Brisbane area inspections -> Using region R01');
      return 'R01';
    }
    
    // Sunshine Coast -> R03  
    const sunshineCoastKeywords = ['sunshine coast', 'caloundra', 'maroochydore', 'noosa', 'golden beach', 'little mountain', 'twin waters'];
    if (addresses.some(addr => sunshineCoastKeywords.some(keyword => addr.includes(keyword)))) {
      console.log('🌍 Detected Sunshine Coast inspections -> Using region R03');
      return 'R03';
    }
    
    // Newcastle -> R09
    const newcastleKeywords = ['newcastle', 'maitland', 'cessnock', 'central coast', 'fletcher', 'belmont'];
    if (addresses.some(addr => newcastleKeywords.some(keyword => addr.includes(keyword)))) {
      console.log('🌍 Detected Newcastle area inspections -> Using region R09');
      return 'R09';
    }
    
    console.log('🏠 No region match found, using inspector home region:', inspectorHomeRegion);
    return inspectorHomeRegion;
  };
  
  const inspectorRegion = determineRegionFromInspections(inspectionActivities);

  const fetchDeals = async (region = selectedRegion, type = dealType) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Fetching ${type} deals for region: ${region}`);
      
      let result;
      if (type === 'recommendations') {
        result = await getRecommendationDeals(region);
      } else {
        result = await getDealsForRegion(region, { limit: 200 }); // Increased to get all 197 deals
      }
      
      let processedDeals = result || [];
      
      // Apply distance sorting if enabled and we have inspection activities
      if (sortByDistance && inspectionActivities.length > 0) {
        console.log(`📏 Sorting ${processedDeals.length} deals by distance to ${inspectionActivities.length} inspection addresses`);
        
        // Summary logging only
        const dealsWithCoords = processedDeals.filter(d => d.coordinates).length;
        const inspectionsWithCoords = inspectionActivities.filter(a => 
          a.coordinates || a.personAddress?.coordinates || (a.lat && a.lng)
        ).length;
        console.log(`📊 Sorting Summary: ${dealsWithCoords}/${processedDeals.length} deals have coordinates, ${inspectionsWithCoords}/${inspectionActivities.length} inspections have coordinates`);
        
        // Determine which inspections to use for sorting
        let sortingInspections = inspectionActivities;
        
        // Check for sort-by inspection from window (set by calendar button click)
        if (window.dealsSortByInspection) {
          console.log(`🎯 Sorting by specific inspection from calendar: ${window.dealsSortByInspection.due_time} - ${window.dealsSortByInspection.personAddress}`);
          sortingInspections = [window.dealsSortByInspection];
          // Auto-select this inspection in dropdown
          setSelectedSortInspection(window.dealsSortByInspection.id.toString());
          // Clear the window variable
          window.dealsSortByInspection = null;
        } else if (selectedSortInspection !== 'all') {
          // Use specific inspection from dropdown
          const selectedInspection = inspectionActivities.find(a => a.id.toString() === selectedSortInspection);
          if (selectedInspection) {
            console.log(`🎯 Sorting by selected inspection: ${selectedInspection.due_time} - ${selectedInspection.personAddress}`);
            sortingInspections = [selectedInspection];
          }
        }
        
        processedDeals = sortDealsByDistance(processedDeals, sortingInspections);
        
        // Calculate distance statistics
        const dealsWithDistance = processedDeals.filter(d => d.distanceInfo && d.distanceInfo.minDistance !== null);
        
        if (dealsWithDistance.length > 0) {
          const stats = {
            within_1km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 1).length,
            within_5km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 5).length,
            within_10km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 10).length,
            within_15km: dealsWithDistance.filter(d => d.distanceInfo.minDistance <= 15).length,
            total_with_distance: dealsWithDistance.length
          };
          setDistanceStats(stats);
          console.log('📏 Distance statistics:', stats);
        } else {
          setDistanceStats(null);
        }
        
        // Auto-select smallest radius with deals when opened from calendar button
        if (window.dealsSortByInspection && stats) {
          if (stats.within_1km > 0) {
            setSelectedDistanceFilter(1);
            console.log(`🎯 Auto-selected 1km radius (${stats.within_1km} deals)`);
          } else if (stats.within_5km > 0) {
            setSelectedDistanceFilter(5);
            console.log(`🎯 Auto-selected 5km radius (${stats.within_5km} deals)`);
          } else if (stats.within_10km > 0) {
            setSelectedDistanceFilter(10);
            console.log(`🎯 Auto-selected 10km radius (${stats.within_10km} deals)`);
          } else if (stats.within_15km > 0) {
            setSelectedDistanceFilter(15);
            console.log(`🎯 Auto-selected 15km radius (${stats.within_15km} deals)`);
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
      console.log(`✅ Loaded ${processedDeals.length} deals${sortByDistance ? ' (sorted by distance)' : ''}`);
      
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
      console.log(`📍 Region changed from ${selectedRegion} to ${inspectorRegion} based on inspection locations`);
      setSelectedRegion(inspectorRegion);
    }
  }, [inspectorRegion, inspectionActivities]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-6xl max-h-[90vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Deals Debug Console
            </h2>
            {healthStatus && (
              <span className={`text-xs px-2 py-1 rounded ${
                healthStatus.success 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {healthStatus.success ? '✅ API Connected' : '❌ API Error'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDeals()}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Distance-based Deal Counts Subheader - Always Visible */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Deals Near Today's Inspections
            </h3>
            <span className="text-xs text-blue-600 font-medium">
              {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Selected Date'} • {inspectionActivities.length} inspection{inspectionActivities.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            <button
              onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 1 ? null : 1)}
              className={`text-center p-3 rounded-lg transition-colors ${
                selectedDistanceFilter === 1 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'hover:bg-purple-50 text-purple-600'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{distanceStats?.within_1km || 0}</div>
              <div className="text-xs font-medium">Within 1km</div>
              <div className="text-xs opacity-75">Walking distance</div>
            </button>
            <button
              onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 5 ? null : 5)}
              className={`text-center p-3 rounded-lg transition-colors ${
                selectedDistanceFilter === 5 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'hover:bg-green-50 text-green-600'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{distanceStats?.within_5km || 0}</div>
              <div className="text-xs font-medium">Within 5km</div>
              <div className="text-xs opacity-75">Immediate area</div>
            </button>
            <button
              onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 10 ? null : 10)}
              className={`text-center p-3 rounded-lg transition-colors ${
                selectedDistanceFilter === 10 
                  ? 'bg-yellow-600 text-white shadow-lg' 
                  : 'hover:bg-yellow-50 text-yellow-600'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{distanceStats?.within_10km || 0}</div>
              <div className="text-xs font-medium">Within 10km</div>
              <div className="text-xs opacity-75">Close proximity</div>
            </button>
            <button
              onClick={() => setSelectedDistanceFilter(selectedDistanceFilter === 15 ? null : 15)}
              className={`text-center p-3 rounded-lg transition-colors ${
                selectedDistanceFilter === 15 
                  ? 'bg-orange-600 text-white shadow-lg' 
                  : 'hover:bg-orange-50 text-orange-600'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{distanceStats?.within_15km || 0}</div>
              <div className="text-xs font-medium">Within 15km</div>
              <div className="text-xs opacity-75">Reasonable drive</div>
            </button>
            <button
              onClick={() => setSelectedDistanceFilter(null)}
              className={`text-center p-3 rounded-lg transition-colors ${
                selectedDistanceFilter === null 
                  ? 'bg-gray-600 text-white shadow-lg' 
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{distanceStats?.total_with_distance || 0}</div>
              <div className="text-xs font-medium">All Deals</div>
              <div className="text-xs opacity-75">Show all</div>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Region:</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(REGIONAL_DEAL_FILTERS).map(([key, filter]) => (
                  <option key={key} value={key}>
                    {filter.name} (Filter {filter.filterId})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Deals</option>
                <option value="recommendations">Recommendation Ready</option>
              </select>
            </div>
            
            {/* Distance Sorting Toggle */}
            {inspectionActivities.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sortByDistance"
                  checked={sortByDistance}
                  onChange={(e) => setSortByDistance(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="sortByDistance" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Sort by Distance
                </label>
                <span className="text-xs text-gray-500">
                  ({inspectionActivities.length} inspection{inspectionActivities.length !== 1 ? 's' : ''} on {selectedDate ? format(selectedDate, 'MMM d') : 'selected date'})
                </span>
              </div>
            )}
            
            {/* Sort by specific inspection dropdown */}
            {sortByDistance && inspectionActivities.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={selectedSortInspection}
                  onChange={(e) => setSelectedSortInspection(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Inspections</option>
                  {inspectionActivities.map(activity => (
                    <option key={activity.id} value={activity.id.toString()}>
                      {activity.due_time} - {activity.personAddress?.substring(0, 30) || activity.subject?.substring(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>
            )}

  
            {currentInspector && (
              <div className="text-sm text-gray-600">
                Current Inspector: <span className="font-medium">{currentInspector.name}</span> ({inspectorRegion})
              </div>
            )}
          </div>

          <div className="text-sm text-gray-600">
            {loading ? (
              'Loading...'
            ) : (
              <>
                {selectedDistanceFilter 
                  ? `${filteredDeals.length} deals within ${selectedDistanceFilter}km (${deals.length} total)`
                  : `${deals.length} deals found`
                }
                {sortByDistance && inspectionActivities.length > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (sorted by distance)
                  </span>
                )}
                {selectedDistanceFilter && (
                  <span className="ml-2 text-orange-600 font-medium">
                    (filtered)
                  </span>
                )}
              </>
            )}
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
                <div key={deal.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{deal.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {deal.value && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${deal.value}
                          </div>
                        )}
                        {deal.person?.name && (
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {deal.person.name}
                          </div>
                        )}
                        {deal.person?.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {deal.person.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        deal.priority === 'high' ? 'bg-red-100 text-red-700' :
                        deal.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {deal.priority}
                      </span>
                      
                      {deal.coordinates && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                          📍 Geocoded
                        </span>
                      )}
                      
                      {deal.distanceInfo && deal.distanceInfo.minDistance !== null && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {deal.distanceInfo.minDistance.toFixed(1)}km
                        </span>
                      )}
                      
                      {deal.addressSource && (
                        <span className={`px-2 py-1 text-xs rounded ${
                          deal.addressSource === 'deal_address_field' ? 'bg-green-100 text-green-700' :
                          deal.addressSource === 'person_address' ? 'bg-yellow-100 text-yellow-700' :
                          deal.addressSource === 'org_address' ? 'bg-orange-100 text-orange-700' :
                          deal.addressSource === 'parsed_from_title' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {deal.addressSource === 'deal_address_field' ? '🏠 Deal Address' :
                           deal.addressSource === 'person_address' ? '👤 Person Address' :
                           deal.addressSource === 'org_address' ? '🏢 Org Address' :
                           deal.addressSource === 'parsed_from_title' ? '📝 Parsed from Title' :
                           '❓ Unknown Source'
                          }
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {deal.address && (
                    <div className="text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {deal.address}
                    </div>
                  )}

                  {deal.coordinates && (
                    <div className="text-xs text-gray-500">
                      Coordinates: {deal.coordinates.lat?.toFixed(4)}, {deal.coordinates.lng?.toFixed(4)}
                    </div>
                  )}
                  
                  {deal.distanceInfo && deal.distanceInfo.closestAddress && (
                    <div className="text-xs text-blue-600 bg-blue-50 rounded p-2 mt-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Navigation className="w-3 h-3" />
                        <span className="font-medium">Closest to: {deal.distanceInfo.closestAddress}</span>
                      </div>
                      <div>Distance: {deal.distanceInfo.minDistance?.toFixed(1)}km</div>
                      {deal.distanceInfo.allDistances?.[0]?.coordSource && (
                        <div className="text-xs text-gray-500 mt-1">
                          Coord source: {deal.distanceInfo.allDistances[0].coordSource}
                        </div>
                      )}
                      {deal.distanceInfo.allDistances && deal.distanceInfo.allDistances.length > 1 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Other inspections: {deal.distanceInfo.allDistances.slice(1, 3).map(d => d.distance.toFixed(1) + 'km').join(', ')}
                          {deal.distanceInfo.allDistances.length > 3 && ` + ${deal.distanceInfo.allDistances.length - 3} more`}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      ID: {deal.id} | Stage: {deal.stage} | Source: {deal.source}
                    </div>
                    {deal.expectedCloseDate && (
                      <div className="text-xs text-gray-500">
                        Expected: {new Date(deal.expectedCloseDate).toLocaleDateString()}
                      </div>
                    )}
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