import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { format, addDays, subDays } from 'date-fns';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  getActivitiesByInspector, 
  getInspectorById, 
  getActivityTypeByKey 
} from '../data/mockActivities';

// Google Maps API Key - Must be set in environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Debug logging for troubleshooting
console.log('🗺️ Google Maps API Key Status:', {
  hasKey: !!GOOGLE_MAPS_API_KEY,
  keyLength: GOOGLE_MAPS_API_KEY?.length || 0,
  keyPreview: GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 'Not found',
  environment: import.meta.env.MODE
});

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ VITE_GOOGLE_MAPS_API_KEY environment variable is required');
}

const MapComponent = ({ appointments, potentialBooking, onRouteCalculated, hoveredAppointment, onAppointmentHover, onAppointmentLeave }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: -27.6378, lng: 153.1094 }, // Logan Central
        zoom: 12,
        styles: [
          {
            featureType: "all",
            elementType: "geometry.fill",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "all",
            elementType: "labels.text.fill",
            stylers: [{ color: "#616161" }]
          },
          {
            featureType: "all",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#ffffff" }]
          },
          {
            featureType: "road",
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#c9c9c9" }]
          },
          {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9e9e9e" }]
          },
          {
            featureType: "poi",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }]
          }
        ],
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM
        }
      });

      setMap(newMap);
      
      // Initialize DirectionsRenderer for routes
      const renderer = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3B82F6',
          strokeWeight: 3,
          strokeOpacity: 0.7
        }
      });
      renderer.setMap(newMap);
      setDirectionsRenderer(renderer);
    }
  }, [map]);

  // Update markers when appointments change
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    const newMarkers = [];

    // Add appointment markers
    appointments.forEach((appointment, index) => {
      if (!appointment.location_lat || !appointment.location_lng) return;

      const position = {
        lat: appointment.location_lat,
        lng: appointment.location_lng
      };

      // Create custom marker icon
      const isHovered = hoveredAppointment && hoveredAppointment.id === appointment.id;
      const markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: isHovered ? '#EF4444' : '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: isHovered ? 4 : 3,
        scale: isHovered ? 15 : 12
      };

      const marker = new window.google.maps.Marker({
        position,
        map,
        icon: markerIcon,
        title: appointment.subject,
        zIndex: 1000 + index
      });

      // Create info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 300px;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
              ${appointment.subject}
            </h4>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; color: #6b7280; font-size: 12px;">
              <span>🕐</span>
              <span>${appointment.due_time.substring(0, 5)} (${appointment.duration.substring(0, 5)})</span>
            </div>
            <div style="display: flex; align-items: start; gap: 6px; margin-bottom: 8px; color: #6b7280; font-size: 12px;">
              <span>📍</span>
              <span>${appointment.location.value}</span>
            </div>
            <div style="display: flex; justify-content: between; align-items: center;">
              <span style="color: #059669; font-weight: 600; font-size: 12px;">
                $${appointment.inspection_fee}
              </span>
              <span style="color: #6b7280; font-size: 11px; margin-left: 8px;">
                ${appointment.roof_type || 'Metal Roof'}
              </span>
            </div>
          </div>
        `
      });

      marker.addListener('mouseover', () => {
        infoWindow.open(map, marker);
        onAppointmentHover?.(appointment);
      });
      
      marker.addListener('mouseout', () => {
        infoWindow.close();
        onAppointmentLeave?.();
      });

      newMarkers.push(marker);
    });

    // Add potential booking marker
    if (potentialBooking && potentialBooking.location) {
      const marker = new window.google.maps.Marker({
        position: potentialBooking.location,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 12
        },
        title: 'Potential Booking',
        zIndex: 2000
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">
              Potential Booking
            </h4>
            <div style="color: #6b7280; font-size: 12px;">
              ${format(potentialBooking.datetime, 'HH:mm')} - Roof Inspection
            </div>
          </div>
        `
      });

      marker.addListener('mouseover', () => {
        infoWindow.open(map, marker);
      });
      
      marker.addListener('mouseout', () => {
        infoWindow.close();
      });

      newMarkers.push(marker);
    }

    setMarkers(newMarkers);
  }, [map, appointments, potentialBooking, hoveredAppointment]);

  // Calculate and display route
  useEffect(() => {
    if (!map || !directionsRenderer || appointments.length < 2) {
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      return;
    }

    const waypoints = appointments.slice(1, -1).map(appointment => ({
      location: {
        lat: appointment.location_lat,
        lng: appointment.location_lng
      },
      stopover: true
    }));

    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route({
      origin: {
        lat: appointments[0].location_lat,
        lng: appointments[0].location_lng
      },
      destination: {
        lat: appointments[appointments.length - 1].location_lat,
        lng: appointments[appointments.length - 1].location_lng
      },
      waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false // Keep in time order
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        
        // Calculate total drive time
        let totalDuration = 0;
        result.routes[0].legs.forEach(leg => {
          totalDuration += leg.duration.value;
        });

        onRouteCalculated?.(Math.ceil(totalDuration / 60)); // Convert to minutes
      }
    });
  }, [map, directionsRenderer, appointments, onRouteCalculated]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

const LoadingComponent = () => (
  <div className="flex items-center justify-center h-full bg-gray-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
      <div className="text-sm text-gray-600">Loading Google Maps...</div>
    </div>
  </div>
);

const ErrorComponent = ({ status }) => (
  <div className="flex items-center justify-center h-full bg-gray-100">
    <div className="text-center p-6">
      <div className="text-red-600 mb-2">⚠️</div>
      <div className="text-sm text-gray-700">
        {status === Status.FAILURE ? 'Failed to load Google Maps' : 'Google Maps error'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Status: {status}
      </div>
      <div className="text-xs text-gray-500">
        API Key Available: {GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY_HERE' ? 'Yes' : 'No'}
      </div>
      <div className="text-xs text-gray-500">
        Please check your API key configuration in .env
      </div>
    </div>
  </div>
);

const GoogleMapsView = ({ selectedInspector, selectedDate, onDateChange, potentialBooking, onDriveTimeCalculated, hoveredAppointment, onAppointmentHover, onAppointmentLeave }) => {
  const [totalDriveTime, setTotalDriveTime] = useState(0);

  // Get today's appointments for the selected inspector
  const todaysAppointments = React.useMemo(() => {
    if (!selectedInspector || !selectedDate) return [];
    
    const activities = getActivitiesByInspector(selectedInspector);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    const filtered = activities
      .filter(activity => activity.due_date === dateString && !activity.done)
      .sort((a, b) => a.due_time.localeCompare(b.due_time));
    
    console.log('GoogleMapsView - Inspector:', selectedInspector);
    console.log('GoogleMapsView - Date:', dateString);
    console.log('GoogleMapsView - Total activities for inspector:', activities.length);
    console.log('GoogleMapsView - Today\'s appointments:', filtered.length);
    console.log('GoogleMapsView - Appointments:', filtered);
    
    return filtered;
  }, [selectedInspector, selectedDate]);

  const inspector = selectedInspector ? getInspectorById(selectedInspector) : null;

  const handleRouteCalculated = useCallback((driveTimeMinutes) => {
    setTotalDriveTime(driveTimeMinutes);
    onDriveTimeCalculated?.(driveTimeMinutes);
  }, [onDriveTimeCalculated]);

  const render = (status) => {
    console.log('Google Maps Wrapper Status:', status);
    console.log('Available statuses:', Object.values(Status));
    if (status === Status.LOADING) return <LoadingComponent />;
    if (status === Status.FAILURE) return <ErrorComponent status={status} />;
    
    return (
      <MapComponent 
        appointments={todaysAppointments}
        potentialBooking={potentialBooking}
        onRouteCalculated={handleRouteCalculated}
        hoveredAppointment={hoveredAppointment}
        onAppointmentHover={onAppointmentHover}
        onAppointmentLeave={onAppointmentLeave}
      />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
          {selectedDate && onDateChange && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onDateChange(subDays(selectedDate, 1))}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm text-gray-600 min-w-max">
                {format(selectedDate, 'EEEE, MMM d')}
              </span>
              <button 
                onClick={() => onDateChange(addDays(selectedDate, 1))}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
        
        {inspector && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span>{inspector.name}</span>
            </div>
            <span>•</span>
            <span>{todaysAppointments.length} appointments</span>
            {totalDriveTime > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  <span>{Math.floor(totalDriveTime / 60)}h {totalDriveTime % 60}m drive time</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1">
        <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={render} />
      </div>
    </div>
  );
};

export default GoogleMapsView;