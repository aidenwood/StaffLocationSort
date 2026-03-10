import React, { useState, useEffect } from 'react';
import { X, RefreshCw, MapPin, DollarSign, User, Phone } from 'lucide-react';
import { 
  getDealsForRegion, 
  getRecommendationDeals, 
  healthCheckDeals,
  REGIONAL_DEAL_FILTERS 
} from '../api/pipedriveDeals.js';

const DealsDebugConsole = ({ isOpen, onClose, selectedInspector, inspectors }) => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('R1');
  const [dealType, setDealType] = useState('all'); // 'all' or 'recommendations'

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
        result = await getDealsForRegion(region, { limit: 50 });
      }
      
      setDeals(result || []);
      console.log(`✅ Loaded ${result?.length || 0} deals`);
      
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
  }, [isOpen, selectedRegion, dealType]);

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
              `${deals.length} deals found`
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
                    
                    <div className="flex items-center gap-2">
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