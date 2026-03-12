import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, MapPin, DollarSign, Target, TrendingUp, Info } from 'lucide-react';
import { analyzeDealsNearTimeSlots, getWeekSummary } from '../utils/timeSlotDealsAnalyzer.js';

const TimeSlotOpportunities = ({ 
  deals = [], 
  activities = [], 
  selectedDate = new Date(),
  proximityThreshold = 1,
  className = '' 
}) => {
  const weekAnalysis = useMemo(() => {
    return analyzeDealsNearTimeSlots(deals, activities, selectedDate, proximityThreshold);
  }, [deals, activities, selectedDate, proximityThreshold]);

  const weekSummary = useMemo(() => {
    return getWeekSummary(weekAnalysis);
  }, [weekAnalysis]);

  const getSlotStyleClasses = (slotAnalysis) => {
    if (!slotAnalysis.available) {
      return 'bg-red-100 border-red-300 text-red-700';
    }
    
    if (slotAnalysis.optimizationScore === 0) {
      return 'bg-gray-50 border-gray-200 text-gray-500';
    }
    
    if (slotAnalysis.optimizationScore >= 70) {
      return 'bg-green-100 border-green-400 text-green-800 ring-2 ring-green-300';
    }
    
    if (slotAnalysis.optimizationScore >= 40) {
      return 'bg-yellow-100 border-yellow-400 text-yellow-800';
    }
    
    return 'bg-blue-50 border-blue-300 text-blue-700';
  };

  const getScoreIcon = (score) => {
    if (score >= 70) return <TrendingUp className="w-4 h-4" />;
    if (score >= 40) return <Target className="w-4 h-4" />;
    if (score > 0) return <Info className="w-4 h-4" />;
    return null;
  };

  if (Object.keys(weekAnalysis).length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p>No time slot data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Time Slot Opportunities
          </h3>
          <div className="text-sm text-gray-500">
            Within {proximityThreshold}km radius
          </div>
        </div>
        
        {/* Week Summary */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-semibold text-green-700">{weekSummary.totalOpportunities}</div>
            <div className="text-green-600">Opportunities</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-semibold text-blue-700">{weekSummary.totalNearbyDeals}</div>
            <div className="text-blue-600">Nearby Deals</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded">
            <div className="font-semibold text-purple-700">{weekSummary.highValueOpportunities}</div>
            <div className="text-purple-600">High Value</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-semibold text-gray-700">{weekSummary.availableSlots}</div>
            <div className="text-gray-600">Available</div>
          </div>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="p-4">
        <div className="grid gap-4">
          {Object.values(weekAnalysis).map(dayAnalysis => (
            <div key={dayAnalysis.dateString} className="border border-gray-200 rounded-lg">
              {/* Day Header */}
              <div className="p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">
                    {dayAnalysis.dayName}
                  </h4>
                  <span className="text-sm text-gray-500">
                    {format(dayAnalysis.date, 'MMM d')}
                  </span>
                </div>
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
                {Object.values(dayAnalysis.timeSlots).map(slotAnalysis => (
                  <div 
                    key={slotAnalysis.time}
                    className={`p-3 border rounded-lg transition-all duration-200 hover:shadow-md ${getSlotStyleClasses(slotAnalysis)}`}
                  >
                    {/* Time Label */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {slotAnalysis.label}
                      </span>
                      {getScoreIcon(slotAnalysis.optimizationScore)}
                    </div>

                    {/* Slot Status */}
                    {!slotAnalysis.available ? (
                      <div className="text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Occupied
                        </div>
                        {slotAnalysis.existingBooking && (
                          <div className="mt-1 text-xs opacity-75">
                            {slotAnalysis.existingBooking.subject?.substring(0, 30)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Optimization Score */}
                        {slotAnalysis.optimizationScore > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <TrendingUp className="w-3 h-3" />
                            Score: {Math.round(slotAnalysis.optimizationScore)}
                          </div>
                        )}

                        {/* Nearby Deals Count */}
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3" />
                          {slotAnalysis.totalNearbyDeals} deals nearby
                        </div>

                        {/* Best Deal Preview */}
                        {slotAnalysis.nearbyOpportunities.length > 0 && (
                          <div className="text-xs opacity-75">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Best: ${slotAnalysis.nearbyOpportunities[0]?.value || 0}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Best Opportunity Highlight */}
        {weekSummary.bestOpportunitySlot && (
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Best Opportunity</h4>
                <p className="text-gray-600 text-sm mt-1">
                  {format(new Date(weekSummary.bestOpportunitySlot.date), 'EEEE, MMM d')} at{' '}
                  {weekSummary.bestOpportunitySlot.label} - {weekSummary.bestOpportunitySlot.nearbyDeals} deals nearby
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    Score: {Math.round(weekSummary.bestOpportunitySlot.score)}
                  </span>
                  <span className="text-gray-500">
                    Optimal for route efficiency
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-400 rounded"></div>
            <span>High opportunity (70+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded"></div>
            <span>Medium opportunity (40+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
            <span>Low opportunity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Occupied</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSlotOpportunities;