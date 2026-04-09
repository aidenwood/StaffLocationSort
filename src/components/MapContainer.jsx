import React from 'react';
import { AlertCircle } from 'lucide-react';
import GoogleMapsView from './GoogleMapsView';

const MapContainer = ({
  mobileViewMode,
  driveTimeImpact,
  potentialBooking,
  selectedInspector,
  selectedDate,
  onDateChange,
  onDriveTimeCalculated,
  hoveredAppointment,
  onAppointmentHover,
  onAppointmentLeave,
  enrichedActivities,
  enrichedMapActivities,
  isLiveData,
  loading,
  isTimeout,
  error,
  dealsToShowOnMap,
  pipedriveInspectors
}) => {
  return (
    <div className={`flex flex-col gap-4 min-w-0 transition-all duration-500 ease-in-out overflow-hidden ${
      mobileViewMode === 'calendar'
        ? 'h-0 w-0 lg:w-0 opacity-0 translate-x-full lg:translate-x-0 translate-y-full'
        : mobileViewMode === 'split'
          ? 'h-1/2 w-full min-h-[50vh] lg:h-auto lg:w-1/2 opacity-100 translate-x-0 translate-y-0'
          : 'h-full w-full lg:h-auto lg:w-full opacity-100 translate-x-0 translate-y-0'
    }`}>
      {/* Drive Time Impact */}
      {driveTimeImpact && potentialBooking && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Route Impact Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {driveTimeImpact.driveTimeToPrev && (
              <div className="text-center">
                <div className="text-gray-600">From Previous</div>
                <div className="font-semibold text-lg">{Math.round(driveTimeImpact.driveTimeToPrev)}m</div>
              </div>
            )}
            {driveTimeImpact.driveTimeToNext && (
              <div className="text-center">
                <div className="text-gray-600">To Next</div>
                <div className="font-semibold text-lg">{Math.round(driveTimeImpact.driveTimeToNext)}m</div>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className={`text-center font-semibold ${
              driveTimeImpact.totalDriveTimeChange > 0 ? 'text-red-600' : 
              driveTimeImpact.totalDriveTimeChange < 0 ? 'text-green-600' : 'text-gray-900'
            }`}>
              Total Change: {driveTimeImpact.totalDriveTimeChange >= 0 ? '+' : ''}
              {Math.round(driveTimeImpact.totalDriveTimeChange)}m
            </div>
            <div className={`text-xs text-center mt-2 p-2 rounded ${
              driveTimeImpact.totalDriveTimeChange > 15 ? 'bg-red-50 text-red-700' :
              driveTimeImpact.totalDriveTimeChange > 0 ? 'bg-amber-50 text-amber-700' :
              'bg-green-50 text-green-700'
            }`}>
              {driveTimeImpact.totalDriveTimeChange > 15 
                ? 'Significant increase in drive time'
                : driveTimeImpact.totalDriveTimeChange > 0 
                  ? 'Minor increase in drive time'
                  : 'Good scheduling - minimal impact'}
            </div>
          </div>
        </div>
      )}

      {/* Map View */}
      <div className={`${
        mobileViewMode === 'split' 
          ? 'flex-1 min-h-[40vh]' // Responsive height in split mode
          : 'flex-1'
      }`}>
        <GoogleMapsView
          selectedInspector={selectedInspector}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          potentialBooking={potentialBooking}
          onDriveTimeCalculated={onDriveTimeCalculated}
          hoveredAppointment={hoveredAppointment}
          onAppointmentHover={onAppointmentHover}
          onAppointmentLeave={onAppointmentLeave}
          activities={enrichedActivities}
          enrichedDayActivities={enrichedMapActivities}
          isLiveData={isLiveData}
          loading={loading}
          isTimeout={isTimeout}
          error={error}
          dealsToShow={dealsToShowOnMap}
          inspectors={pipedriveInspectors}
        />
      </div>
    </div>
  );
};

export default MapContainer;