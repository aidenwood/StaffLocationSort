import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { format, parseISO } from 'date-fns';
import L from 'leaflet';
import { Clock, MapPin, User, Car, Navigation } from 'lucide-react';
import { 
  getActivitiesByInspector, 
  getInspectorById, 
  getActivityTypeByKey 
} from '../data/mockActivities';

// Fix Leaflet default markers in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color, symbol) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">${symbol}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const appointmentIcon = createCustomIcon('#3B82F6', '📍');
const newBookingIcon = createCustomIcon('#EF4444', '🆕');
const inspectorHomeIcon = createCustomIcon('#10B981', '🏠');

// Mock geocoding function for addresses in Logan QLD
const geocodeAddress = async (address) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simple mock geocoding for Logan area
  const loganCenter = { lat: -27.6378, lng: 153.1094 };
  const randomOffset = () => (Math.random() - 0.5) * 0.05; // Small random offset
  
  return {
    lat: loganCenter.lat + randomOffset(),
    lng: loganCenter.lng + randomOffset(),
    address: address
  };
};

// Calculate drive time between two points (mock calculation)
const calculateDriveTime = (point1, point2) => {
  const distance = Math.sqrt(
    Math.pow(point1.lat - point2.lat, 2) + Math.pow(point1.lng - point2.lng, 2)
  );
  
  // Mock drive time calculation: roughly 2-3 minutes per km in urban area
  const driveTimeMinutes = Math.max(5, Math.round(distance * 100 * 2.5));
  return driveTimeMinutes;
};

// Format drive time for display
const formatDriveTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
};

const AppointmentMap = ({ selectedInspector, selectedDate, potentialBooking, onDriveTimeCalculated }) => {
  const [mapCenter] = useState([-27.6378, 153.1094]); // Logan Central
  const [potentialBookingLocation, setPotentialBookingLocation] = useState(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

  // Get today's appointments for the selected inspector
  const todaysAppointments = useMemo(() => {
    if (!selectedInspector || !selectedDate) return [];
    
    const activities = getActivitiesByInspector(selectedInspector);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    return activities
      .filter(activity => activity.due_date === dateString && !activity.done)
      .sort((a, b) => a.due_time.localeCompare(b.due_time));
  }, [selectedInspector, selectedDate]);

  // Convert activities to map markers with coordinates
  const appointmentMarkers = useMemo(() => {
    return todaysAppointments.map((activity, index) => {
      // Extract coordinates from mock data or use default Logan locations
      const lat = activity.location_lat || (-27.6378 + (index * 0.01));
      const lng = activity.location_lng || (153.1094 + (index * 0.01));
      
      return {
        id: activity.id,
        position: [lat, lng],
        activity,
        driveTimeToNext: null // Will be calculated
      };
    });
  }, [todaysAppointments]);

  // Calculate drive times between consecutive appointments
  const appointmentsWithDriveTimes = useMemo(() => {
    const markers = [...appointmentMarkers];
    
    for (let i = 0; i < markers.length - 1; i++) {
      const current = markers[i];
      const next = markers[i + 1];
      
      const driveTime = calculateDriveTime(
        { lat: current.position[0], lng: current.position[1] },
        { lat: next.position[0], lng: next.position[1] }
      );
      
      current.driveTimeToNext = driveTime;
    }
    
    return markers;
  }, [appointmentMarkers]);

  // Create route polylines between appointments
  const routeLines = useMemo(() => {
    const lines = [];
    
    for (let i = 0; i < appointmentsWithDriveTimes.length - 1; i++) {
      const current = appointmentsWithDriveTimes[i];
      const next = appointmentsWithDriveTimes[i + 1];
      
      lines.push({
        positions: [current.position, next.position],
        driveTime: current.driveTimeToNext,
        color: '#3B82F6'
      });
    }
    
    return lines;
  }, [appointmentsWithDriveTimes]);

  // Calculate potential booking impact
  const potentialBookingImpact = useMemo(() => {
    if (!potentialBooking || !potentialBookingLocation || appointmentsWithDriveTimes.length === 0) {
      return null;
    }

    const bookingTime = potentialBooking.datetime;
    let insertIndex = 0;
    let prevAppointment = null;
    let nextAppointment = null;

    // Find where the new booking fits in the schedule
    for (let i = 0; i < appointmentsWithDriveTimes.length; i++) {
      const appointment = appointmentsWithDriveTimes[i];
      const appointmentTime = new Date(`${appointment.activity.due_date}T${appointment.activity.due_time}`);
      
      if (bookingTime < appointmentTime) {
        insertIndex = i;
        nextAppointment = appointment;
        if (i > 0) {
          prevAppointment = appointmentsWithDriveTimes[i - 1];
        }
        break;
      }
    }

    // If booking is after all appointments
    if (insertIndex === 0 && appointmentsWithDriveTimes.length > 0) {
      const lastAppointment = appointmentsWithDriveTimes[appointmentsWithDriveTimes.length - 1];
      const lastAppointmentTime = new Date(`${lastAppointment.activity.due_date}T${lastAppointment.activity.due_time}`);
      
      if (bookingTime > lastAppointmentTime) {
        prevAppointment = lastAppointment;
        insertIndex = appointmentsWithDriveTimes.length;
      }
    }

    const impact = {
      insertIndex,
      prevAppointment,
      nextAppointment,
      driveTimeToPrev: prevAppointment ? calculateDriveTime(
        { lat: prevAppointment.position[0], lng: prevAppointment.position[1] },
        potentialBookingLocation
      ) : null,
      driveTimeToNext: nextAppointment ? calculateDriveTime(
        potentialBookingLocation,
        { lat: nextAppointment.position[0], lng: nextAppointment.position[1] }
      ) : null
    };

    // Calculate total drive time change
    let originalDriveTime = 0;
    let newDriveTime = 0;

    if (prevAppointment && nextAppointment) {
      originalDriveTime = calculateDriveTime(
        { lat: prevAppointment.position[0], lng: prevAppointment.position[1] },
        { lat: nextAppointment.position[0], lng: nextAppointment.position[1] }
      );
      newDriveTime = impact.driveTimeToPrev + impact.driveTimeToNext;
    } else if (prevAppointment) {
      newDriveTime = impact.driveTimeToPrev;
    } else if (nextAppointment) {
      newDriveTime = impact.driveTimeToNext;
    }

    impact.totalDriveTimeChange = newDriveTime - originalDriveTime;
    
    // Notify parent component
    onDriveTimeCalculated?.(impact);

    return impact;
  }, [potentialBooking, potentialBookingLocation, appointmentsWithDriveTimes, onDriveTimeCalculated]);

  // Geocode potential booking address
  useEffect(() => {
    if (potentialBooking?.property_address && !potentialBookingLocation) {
      setIsGeocodingAddress(true);
      geocodeAddress(potentialBooking.property_address)
        .then(result => {
          setPotentialBookingLocation({
            lat: result.lat,
            lng: result.lng
          });
        })
        .catch(error => {
          console.error('Geocoding failed:', error);
        })
        .finally(() => {
          setIsGeocodingAddress(false);
        });
    }
  }, [potentialBooking?.property_address, potentialBookingLocation]);

  // Reset potential booking location when booking changes
  useEffect(() => {
    if (!potentialBooking) {
      setPotentialBookingLocation(null);
    }
  }, [potentialBooking]);

  const inspector = selectedInspector ? getInspectorById(selectedInspector) : null;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Route Visualization</h3>
          {selectedDate && (
            <span className="text-sm text-gray-600">
              {format(selectedDate, 'EEEE, MMM d, yyyy')}
            </span>
          )}
        </div>
        
        {inspector && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>{inspector.name}</span>
            <span className="text-gray-400">•</span>
            <span>{appointmentsWithDriveTimes.length} appointments</span>
            {potentialBooking && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-red-600">+1 potential booking</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative h-96">
        {isGeocodingAddress && (
          <div className="absolute top-4 right-4 z-10 bg-blue-100 text-blue-800 px-3 py-2 rounded-md text-sm">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              Locating address...
            </div>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Current appointments */}
          {appointmentsWithDriveTimes.map((marker, index) => {
            const activityType = getActivityTypeByKey(marker.activity.type);
            return (
              <Marker
                key={marker.id}
                position={marker.position}
                icon={appointmentIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h4 className="font-medium text-gray-900 mb-2">
                      {marker.activity.subject}
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-3 h-3" />
                        <span>{marker.activity.due_time.substring(0, 5)}</span>
                        <span>({marker.activity.duration.substring(0, 5)})</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {marker.activity.location.value}
                        </span>
                      </div>
                      {marker.activity.property_type && (
                        <div className="text-gray-500">
                          {marker.activity.property_type} • ${marker.activity.inspection_fee}
                        </div>
                      )}
                      {marker.driveTimeToNext && (
                        <div className="flex items-center gap-2 text-blue-600 font-medium">
                          <Car className="w-3 h-3" />
                          <span>{formatDriveTime(marker.driveTimeToNext)} to next</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Route lines between appointments */}
          {routeLines.map((line, index) => (
            <Polyline
              key={index}
              positions={line.positions}
              pathOptions={{ 
                color: line.color,
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 5'
              }}
            />
          ))}

          {/* Potential new booking */}
          {potentialBooking && potentialBookingLocation && (
            <Marker
              position={[potentialBookingLocation.lat, potentialBookingLocation.lng]}
              icon={newBookingIcon}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-medium text-red-900 mb-2">
                    Potential Booking
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{format(potentialBooking.datetime, 'HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">
                        {potentialBooking.property_address}
                      </span>
                    </div>
                    {potentialBookingImpact && (
                      <div className="border-t pt-2 mt-2">
                        <div className="text-xs text-gray-500 mb-1">Drive Time Impact:</div>
                        {potentialBookingImpact.driveTimeToPrev && (
                          <div className="flex items-center gap-2 text-blue-600 text-xs">
                            <Navigation className="w-3 h-3" />
                            <span>From previous: {formatDriveTime(potentialBookingImpact.driveTimeToPrev)}</span>
                          </div>
                        )}
                        {potentialBookingImpact.driveTimeToNext && (
                          <div className="flex items-center gap-2 text-blue-600 text-xs">
                            <Navigation className="w-3 h-3" />
                            <span>To next: {formatDriveTime(potentialBookingImpact.driveTimeToNext)}</span>
                          </div>
                        )}
                        <div className={`text-xs font-medium ${
                          potentialBookingImpact.totalDriveTimeChange > 0 
                            ? 'text-red-600' 
                            : potentialBookingImpact.totalDriveTimeChange < 0 
                              ? 'text-green-600' 
                              : 'text-gray-600'
                        }`}>
                          Total change: {potentialBookingImpact.totalDriveTimeChange >= 0 ? '+' : ''}
                          {formatDriveTime(Math.abs(potentialBookingImpact.totalDriveTimeChange))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route lines with potential booking */}
          {potentialBooking && potentialBookingLocation && potentialBookingImpact && (
            <>
              {potentialBookingImpact.prevAppointment && (
                <Polyline
                  positions={[
                    potentialBookingImpact.prevAppointment.position,
                    [potentialBookingLocation.lat, potentialBookingLocation.lng]
                  ]}
                  pathOptions={{ 
                    color: '#EF4444',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 5'
                  }}
                />
              )}
              {potentialBookingImpact.nextAppointment && (
                <Polyline
                  positions={[
                    [potentialBookingLocation.lat, potentialBookingLocation.lng],
                    potentialBookingImpact.nextAppointment.position
                  ]}
                  pathOptions={{ 
                    color: '#EF4444',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 5'
                  }}
                />
              )}
            </>
          )}
        </MapContainer>
      </div>

      {/* Drive time summary */}
      {appointmentsWithDriveTimes.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Total daily drive time:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatDriveTime(
                  appointmentsWithDriveTimes.reduce((total, marker) => 
                    total + (marker.driveTimeToNext || 0), 0
                  ) + (potentialBookingImpact?.totalDriveTimeChange || 0)
                )}
              </span>
            </div>
            {potentialBookingImpact && potentialBookingImpact.totalDriveTimeChange !== 0 && (
              <div className={`text-sm ${
                potentialBookingImpact.totalDriveTimeChange > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {potentialBookingImpact.totalDriveTimeChange > 0 ? '+' : ''}
                {formatDriveTime(Math.abs(potentialBookingImpact.totalDriveTimeChange))} with new booking
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentMap;