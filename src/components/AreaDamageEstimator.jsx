import React, { useState } from 'react';
import { Search, MapPin, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import AddressAutocompleteNew from './AddressAutocompleteNew';
import TrafficLight from './TrafficLight';
import csvLookup from '../utils/csvLookup';

export default function AreaDamageEstimator() {
  console.log('🔥 AreaDamageEstimator component loaded');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleAddressSelect = async (placeDetails) => {
    console.log('🎯 Address selected in AreaDamageEstimator:', placeDetails);
    if (!placeDetails || !placeDetails.address || !placeDetails.address.trim()) {
      console.log('⚠️ Invalid placeDetails, skipping lookup:', placeDetails);
      return;
    }
    
    setAddress(placeDetails.address);
    await performLookup(placeDetails.address);
  };

  const performLookup = async (searchAddress) => {
    if (!searchAddress.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const data = await csvLookup.lookupByAddress(searchAddress);
      
      if (!data || data.length === 0) {
        setError('No area data found for this postcode. This may be outside our current coverage area.');
        return;
      }

      setResults(data);
    } catch (err) {
      console.error('Lookup error:', err);
      setError(err.message || 'Failed to look up area information');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performLookup(address);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-700 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'LOW': return <CheckCircle className="h-5 w-5" />;
      case 'MEDIUM': return <Clock className="h-5 w-5" />;
      case 'HIGH': return <AlertTriangle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  // Parse DD/MM/YYYY date format from CSV
  const parseDDMMYYYY = (dateStr) => {
    if (!dateStr) return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Validate the parts
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    
    // Create Date object (month is 0-indexed)
    return new Date(year, month - 1, day);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header - Responsive Figma Style */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <h1 className="text-sm font-medium text-gray-900">
              Area Damage Estimator
            </h1>
            <div className="w-px h-4 bg-gray-300"></div>
            <span className="text-xs text-gray-500">
              Risk Assessment Tool
            </span>
          </div>
          
          {/* Right: Back button */}
          <button 
            onClick={() => {
              window.location.hash = ''
              window.location.reload()
            }}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <AddressAutocompleteNew
                onPlaceSelect={handleAddressSelect}
                placeholder="Enter property address to assess area risk..."
                error={error}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !address.trim()}
              className="btn btn-primary px-6 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          <div className="mt-3 text-sm text-gray-500">
            <div className="mb-2">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd> to search
            </div>
            <div className="text-xs text-gray-400">
              Example addresses: "Belmont NSW 2280", "Toukley NSW 2263", "Gwandalan NSW 2259"
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* Header with location and risk info */}
                <div className={`px-6 py-4 border-b ${getRiskColor(result.riskLevel)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <TrafficLight zone={result.zone} className="w-12 h-24 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {result.suburb}, {result.state} {result.postcode}
                        </h3>
                        <p className="text-sm opacity-75 mb-2">
                          Risk Level: {result.riskLevel}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          {getRiskIcon(result.riskLevel)}
                          <span className="font-medium">{result.zone}</span>
                          <span className="opacity-75">• {result.recommendation}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium">{result.odds}</div>
                      <div className="text-sm opacity-75">Damage Odds</div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6">
                  <div className="grid md:grid-cols-1 gap-6">
                    {/* Weather Events */}
                    <div className="space-y-4">
                      {result.storms && result.storms.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Weather Events ({result.storms.length})</h4>
                          <div className="space-y-2">
                            {result.storms.map((storm, stormIndex) => (
                              <div key={stormIndex} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                  <span className="font-medium text-blue-900">
                                    {parseDDMMYYYY(storm.date)?.toLocaleDateString('en-AU') || storm.date}
                                  </span>
                                  {stormIndex === 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Latest</span>
                                  )}
                                </div>
                                <div className="text-sm text-blue-700 space-y-1">
                                  <div>Hail size: {storm.size}</div>
                                  {storm.coverage && storm.coverage !== 'Unknown' && (
                                    <div>Coverage: {storm.coverage}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                  
                  {/* Area Data - Bottom */}
                  <div className="px-6 py-3 bg-gray-50 border-t mt-4">
                    <div className="text-sm text-gray-700 mb-3">Area Data</div>
                    
                    {/* Numbers above the bar */}
                    <div className="flex justify-between text-xs mb-2">
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{result.claimsLodged} claims lodged</div>
                        <div className="text-red-600">{result.claimsPercent.toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{result.minorDamage} minor damage</div>
                        <div className="text-yellow-600">{result.minorPercent.toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{result.noDamage} no damage</div>
                        <div className="text-green-600">{result.noDamagePercent.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-2 text-center">
                      Total volume: {result.totalVolume} properties assessed
                    </div>
                    
                    {/* Single horizontal linked progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 flex overflow-hidden">
                      <div className="bg-red-500 h-3" style={{ width: `${result.claimsPercent}%` }}></div>
                      <div className="bg-yellow-500 h-3" style={{ width: `${result.minorPercent}%` }}></div>
                      <div className="bg-green-500 h-3" style={{ width: `${result.noDamagePercent}%` }}></div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-center gap-4 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded"></div>
                        <span className="text-gray-600">Claims</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded"></div>
                        <span className="text-gray-600">Minor</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded"></div>
                        <span className="text-gray-600">No Damage</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}

        {/* Empty State */}
        {!results && !loading && !error && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Enter an address to get started
            </h3>
            <p className="text-gray-500">
              We'll provide area risk assessment based on historical damage data
            </p>
          </div>
        )}

        </div>
      </div>
    </div>
  );
}