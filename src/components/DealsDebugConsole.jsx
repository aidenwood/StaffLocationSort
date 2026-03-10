import React, { useState, useEffect } from 'react';
import { X, RefreshCw, MapPin, DollarSign, User, Phone, Navigation, Target } from 'lucide-react';
import { format } from 'date-fns';
import { 
  getDealsForRegion, 
  getRecommendationDeals, 
  healthCheckDeals,
  sortDealsByDistance,
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
  const [sortByDistance, setSortByDistance] = useState(false);

  // Get region for current inspector
  const currentInspector = inspectors?.find(i => i.id === selectedInspector);
  const inspectorRegion = currentInspector?.region || 'R1';

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
        
        // Debug logging
        console.log('📊 Debug info:');
        console.log('- Deals with coordinates:', processedDeals.filter(d => d.coordinates).length);
        console.log('- Address sources breakdown:', {
          deal_address_field: processedDeals.filter(d => d.addressSource === 'deal_address_field').length,
          person_address: processedDeals.filter(d => d.addressSource === 'person_address').length,
          org_address: processedDeals.filter(d => d.addressSource === 'org_address').length,
          parsed_from_title: processedDeals.filter(d => d.addressSource === 'parsed_from_title').length,
          no_address: processedDeals.filter(d => !d.address).length
        });
        console.log('- Inspection activities with coordinates:', inspectionActivities.filter(a => 
          a.coordinates || a.personAddress?.coordinates || (a.lat && a.lng)
        ).length);
        
        // Sample inspection activity structure
        if (inspectionActivities.length > 0) {
          const sample = inspectionActivities[0];
          console.log('- Sample inspection activity:', {
            id: sample.id,
            subject: sample.subject,
            hasCoordinates: !!sample.coordinates,
            hasPersonAddress: !!sample.personAddress,
            hasLatLng: !!(sample.lat && sample.lng)
          });
        }
        
        processedDeals = sortDealsByDistance(processedDeals, inspectionActivities);
        
        // Log sorted results
        const dealsWithDistance = processedDeals.filter(d => d.distanceInfo && d.distanceInfo.minDistance !== null);
        console.log(`✅ ${dealsWithDistance.length} deals successfully sorted by distance`);
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
  }, [isOpen, selectedRegion, dealType, sortByDistance]);

  // Update region when inspector changes
  useEffect(() => {
    if (inspectorRegion && inspectorRegion !== selectedRegion) {
      setSelectedRegion(inspectorRegion);
    }
  }, [inspectorRegion]);

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
                {deals.length} deals found
                {sortByDistance && inspectionActivities.length > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (sorted by distance)
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
          ) : deals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No deals found for this region</p>
              <p className="text-sm mt-1">Try refreshing or check the filter configuration</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {deals.map((deal, index) => (
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