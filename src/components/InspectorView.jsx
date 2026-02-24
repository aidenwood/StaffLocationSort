import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, 
  MapPin, 
  Clock,
  User,
  ArrowLeft,
  Navigation,
  Phone,
  Mail
} from 'lucide-react';
import InspectorCalendar from './InspectorCalendar';
import GoogleMapsView from './GoogleMapsView';
import { inspectors, getActivitiesByInspectorAndDate, getInspectorById } from '../data/mockActivities';

const InspectorView = ({ inspectorId, onBack }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const inspector = getInspectorById(inspectorId);
  const todaysAppointments = getActivitiesByInspectorAndDate(inspectorId, selectedDate);

  if (!inspector) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Inspector Not Found</h2>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Calculate daily stats
  const totalDriveTime = todaysAppointments.reduce((total, appointment, index) => {
    if (index < todaysAppointments.length - 1) {
      const current = { lat: appointment.location_lat, lng: appointment.location_lng };
      const next = { 
        lat: todaysAppointments[index + 1].location_lat, 
        lng: todaysAppointments[index + 1].location_lng 
      };
      
      // Simple drive time calculation
      const distance = Math.sqrt(
        Math.pow(current.lat - next.lat, 2) + Math.pow(current.lng - next.lng, 2)
      );
      return total + Math.max(5, Math.round(distance * 100 * 2.5));
    }
    return total;
  }, 0);

  const totalRevenue = todaysAppointments.reduce((sum, appointment) => 
    sum + (appointment.inspection_fee || 0), 0);

  const formatDriveTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {inspector.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {inspector.email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {inspector.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Date Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Today's Appointments</div>
              <div className="font-semibold text-gray-900">{todaysAppointments.length}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Navigation className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Total Drive Time</div>
              <div className="font-semibold text-gray-900">{formatDriveTime(totalDriveTime)}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-semibold text-xs">$</span>
            </div>
            <div>
              <div className="text-xs text-gray-500">Expected Revenue</div>
              <div className="font-semibold text-gray-900">${totalRevenue}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Working Hours</div>
              <div className="font-semibold text-gray-900">
                {todaysAppointments.length > 0 
                  ? `${todaysAppointments[0]?.due_time?.substring(0, 5)} - ${
                      todaysAppointments[todaysAppointments.length - 1]?.due_time?.substring(0, 5)
                    }`
                  : 'No appointments'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left Side - Calendar */}
        <div className="flex-1">
          <InspectorCalendar
            selectedInspector={inspectorId}
            onSelectTimeSlot={() => {}} // Read-only for inspector view
            fullScreen={true}
          />
        </div>

        {/* Right Side - Map & Appointments */}
        <div className="w-1/3 flex flex-col gap-4">
          {/* Today's Route Map */}
          <div className="flex-1">
            <GoogleMapsView
              selectedInspector={inspectorId}
              selectedDate={selectedDate}
              potentialBooking={null}
              onDriveTimeCalculated={() => {}}
            />
          </div>

          {/* Today's Schedule List */}
          <div className="bg-white rounded-lg shadow-lg max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg">
              <h3 className="font-semibold text-gray-900">
                {format(selectedDate, "EEEE, MMM d")} Schedule
              </h3>
            </div>
            
            <div className="p-2">
              {todaysAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No appointments scheduled</p>
                  <p className="text-sm">Enjoy your day off!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaysAppointments.map((appointment, index) => {
                    const nextAppointment = todaysAppointments[index + 1];
                    let driveTime = null;
                    
                    if (nextAppointment) {
                      const current = { lat: appointment.location_lat, lng: appointment.location_lng };
                      const next = { lat: nextAppointment.location_lat, lng: nextAppointment.location_lng };
                      const distance = Math.sqrt(
                        Math.pow(current.lat - next.lat, 2) + Math.pow(current.lng - next.lng, 2)
                      );
                      driveTime = Math.max(5, Math.round(distance * 100 * 2.5));
                    }

                    return (
                      <div key={appointment.id} className="space-y-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:bg-blue-100 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-blue-900 mb-1">
                                {appointment.subject}
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex items-center gap-2 text-blue-700">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {appointment.due_time.substring(0, 5)} 
                                    ({appointment.duration.substring(0, 5)})
                                  </span>
                                </div>
                                <div className="flex items-start gap-2 text-blue-700">
                                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs leading-relaxed">
                                    {appointment.location.value}
                                  </span>
                                </div>
                                {appointment.attendees?.[0] && (
                                  <div className="flex items-center gap-2 text-blue-600">
                                    <User className="w-3 h-3" />
                                    <span className="text-xs">
                                      {appointment.attendees[0].name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">
                                ${appointment.inspection_fee}
                              </div>
                              <div className="text-xs text-gray-500">
                                {appointment.property_type}
                              </div>
                            </div>
                          </div>
                          
                          {appointment.special_instructions && (
                            <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
                              <strong className="text-amber-800">Note:</strong>
                              <span className="text-amber-700 ml-1">
                                {appointment.special_instructions}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {driveTime && (
                          <div className="flex items-center justify-center py-1">
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                              <Navigation className="w-3 h-3" />
                              <span>{formatDriveTime(driveTime)} drive</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectorView;