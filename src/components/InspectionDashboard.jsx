import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import InspectorCalendar from './InspectorCalendar';
import InspectorView from './InspectorView';
import RoofInspectionBooking from './RoofInspectionBooking';
import GoogleMapsView from './GoogleMapsView';
import { inspectors, getActivitiesByDate, mockActivities } from '../data/mockActivities';

const InspectionDashboard = () => {
  const [selectedInspector, setSelectedInspector] = useState(1); // Default to first inspector (Ross)
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [potentialBooking, setPotentialBooking] = useState(null);
  const [driveTimeImpact, setDriveTimeImpact] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'inspector'
  const [viewingInspectorId, setViewingInspectorId] = useState(null);
  const [hoveredAppointment, setHoveredAppointment] = useState(null);

  const handleTimeSlotSelection = (slotData) => {
    setSelectedTimeSlot(slotData);
    setShowBookingForm(true);
    
    // Create potential booking for map visualization
    setPotentialBooking({
      datetime: slotData.datetime,
      inspector: slotData.inspector,
      property_address: '', // Will be updated when user enters address
    });
  };

  const handleBookingCancel = () => {
    setShowBookingForm(false);
    setSelectedTimeSlot(null);
    setPotentialBooking(null);
    setDriveTimeImpact(null);
  };

  const handleBookingConfirm = (newActivity) => {
    // In a real app, this would save to Pipedrive API
    console.log('New booking confirmed:', newActivity);
    
    // Close the booking form
    handleBookingCancel();
    
    // Show success message (could be a toast notification)
    alert('Booking confirmed successfully!');
  };

  const handleLocationUpdate = (address) => {
    if (potentialBooking && address) {
      setPotentialBooking(prev => ({
        ...prev,
        property_address: address
      }));
    }
  };

  const handleDriveTimeCalculated = (impact) => {
    setDriveTimeImpact(impact);
  };

  const handleInspectorView = (inspectorId) => {
    setViewingInspectorId(inspectorId);
    setViewMode('inspector');
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setViewingInspectorId(null);
  };

  const handleAppointmentHover = (appointment) => {
    setHoveredAppointment(appointment);
  };

  const handleAppointmentLeave = () => {
    setHoveredAppointment(null);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  // Show inspector view if selected
  if (viewMode === 'inspector' && viewingInspectorId) {
    return (
      <InspectorView 
        inspectorId={viewingInspectorId} 
        onBack={handleBackToDashboard}
      />
    );
  }

  // Calculate dashboard stats
  const todaysActivities = getActivitiesByDate(selectedDate);
  const totalActivities = mockActivities.length;
  const completedActivities = mockActivities.filter(a => a.done).length;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inspection Scheduler
            </h1>
            <p className="text-gray-600 text-sm">
              Manage home inspections for Logan, QLD area
            </p>
          </div>
          
          {/* Stats Pills */}
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {todaysActivities.length} Today's Bookings
            </div>
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              {inspectors.length} Active Inspectors
            </div>
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
              {Math.round((completedActivities / totalActivities) * 100)}% Complete
            </div>
            
            {/* Inspector Quick Access */}
            <div className="border-l border-gray-300 pl-4 ml-2">
              <div className="text-xs text-gray-500 mb-2">Quick Inspector Access:</div>
              <div className="flex gap-2">
                {inspectors.map(inspector => (
                  <button
                    key={inspector.id}
                    onClick={() => handleInspectorView(inspector.id)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
                  >
                    {inspector.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setShowBookingForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </button>

          {/* Region Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Region:</label>
            <select
              value={selectedInspector ? inspectors.find(i => i.id === selectedInspector)?.region || '' : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const inspector = inspectors.find(i => i.region === e.target.value);
                  setSelectedInspector(inspector ? inspector.id : null);
                } else {
                  setSelectedInspector(null);
                }
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Regions</option>
              {[...new Set(inspectors.map(i => i.region))].map(region => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left Half - Calendar */}
        <div className="flex-1">
          <InspectorCalendar
            selectedInspector={selectedInspector}
            selectedDate={selectedDate}
            onInspectorChange={setSelectedInspector}
            onDateChange={handleDateChange}
            onSelectTimeSlot={handleTimeSlotSelection}
            fullScreen={true}
            hoveredAppointment={hoveredAppointment}
            onAppointmentHover={handleAppointmentHover}
            onAppointmentLeave={handleAppointmentLeave}
          />
        </div>

        {/* Right Half - Map & Route Info */}
        <div className="w-1/2 flex flex-col gap-4">
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
          <div className="flex-1">
            <GoogleMapsView
              selectedInspector={selectedInspector}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              potentialBooking={potentialBooking}
              onDriveTimeCalculated={handleDriveTimeCalculated}
              hoveredAppointment={hoveredAppointment}
              onAppointmentHover={handleAppointmentHover}
              onAppointmentLeave={handleAppointmentLeave}
            />
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {format(selectedDate, 'MMM d')} Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-600">Appointments</div>
                <div className="font-semibold text-xl text-blue-600">{todaysActivities.length}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Inspectors</div>
                <div className="font-semibold text-xl text-green-600">
                  {new Set(todaysActivities.map(a => a.owner_id)).size}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <RoofInspectionBooking
          selectedSlot={selectedTimeSlot}
          onBookingConfirm={handleBookingConfirm}
          onCancel={handleBookingCancel}
          onLocationUpdate={handleLocationUpdate}
        />
      )}
    </div>
  );
};

export default InspectionDashboard;