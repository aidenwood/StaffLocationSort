import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { format, addDays, subDays } from 'date-fns';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  getActivitiesByInspector, 
  getInspectorById, 
  getActivityTypeByKey 
} from '../data/mockActivities';
import { geocodeAddress, getCenterPoint, getZoomLevel, clearGeocodeCache } from '../services/geocoding';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

// TEMPORARY: Suppress DirectionsService deprecation spam to see Pipedrive logs
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('DirectionsService is deprecated') || 
      message.includes('google.maps.routes.Route.computeRoutes')) {
    return; // Skip DirectionsService warnings
  }
  originalWarn.apply(console, args);
};

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

const MapComponent = ({ appointments, potentialBooking, onRouteCalculated, hoveredAppointment, onAppointmentHover, onAppointmentLeave, setIsGeocoding }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [geocodedAppointments, setGeocodedAppointments] = useState([]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: -27.6378, lng: 153.1094 }, // Logan Central
        zoom: 12,
        gestureHandling: 'cooperative', // Prevent accidental panning
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
        suppressInfoWindows: true,
        preserveViewport: true, // Don't auto-fit the route to viewport
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

  // Geocode appointments when they change
  useEffect(() => {
    const geocodeAppointments = async () => {
      if (!appointments || appointments.length === 0) {
        setGeocodedAppointments([]);
        return;
      }

      setIsGeocoding?.(true);
      
      // Note: Cache cleared on first load to ensure fresh geocoding
      
      const geocoded = [];

      for (const appointment of appointments) {
        // Check if already has coordinates
        if (appointment.location_lat && appointment.location_lng) {
          geocoded.push({
            ...appointment,
            coordinates: { lat: appointment.location_lat, lng: appointment.location_lng }
          });
          continue;
        }

        // Extract address from Pipedrive subject format: "Name - Address NSW/QLD Inspector..."
        let locationString = appointment.subject || appointment.location?.value || appointment.location || '';
        let extractedAddress = '';
        
        // Parse address from subject field
        if (locationString.includes(' - ') && (locationString.includes('NSW') || locationString.includes('QLD'))) {
          // Split by ' - ' and find the part with NSW/QLD
          const parts = locationString.split(' - ');
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.includes('NSW') || part.includes('QLD')) {
              // Extract address up to state, before any additional text like "Inspector"
              const beforeInspector = part.split(' Inspector')[0];
              const beforeAustralia = beforeInspector.split(', Australia')[0];
              extractedAddress = beforeAustralia.trim();
              break;
            }
          }
        }
        
        if (extractedAddress && (extractedAddress.includes('NSW') || extractedAddress.includes('QLD'))) {
          console.log(`📍 Geocoding: ${appointment.subject.split(' - ')[0]}`);
          console.log(`   Full subject: "${appointment.subject}"`);
          console.log(`   Extracted address: "${extractedAddress}"`);
          const coordinates = await geocodeAddress(extractedAddress);
          
          console.log(`   Geocoding result:`, coordinates);
          
          geocoded.push({
            ...appointment,
            coordinates,
            locationString: extractedAddress
          });
        } else {
          console.warn(`⚠️ No location data for appointment: ${appointment.subject}`);
          geocoded.push({
            ...appointment,
            coordinates: null
          });
        }
      }

      setGeocodedAppointments(geocoded);
      setIsGeocoding?.(false);

      // Auto-center and zoom map based on geocoded locations
      if (map && geocoded.length > 0) {
        const validCoordinates = geocoded
          .map(a => a.coordinates)
          .filter(coord => coord !== null);

        if (validCoordinates.length > 0) {
          const center = getCenterPoint(validCoordinates);
          const zoom = getZoomLevel(validCoordinates);
          
          console.log(`🗺️ Auto-centering map:`, { center, zoom, locations: validCoordinates.length });
          map.setCenter(center);
          map.setZoom(zoom);
        }
      }
    };

    geocodeAppointments();
  }, [appointments, map]);

  // Update markers when geocoded appointments change
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    const newMarkers = [];

    // Add geocoded appointment markers
    geocodedAppointments.forEach((appointment, index) => {
      if (!appointment.coordinates) {
        console.log(`⚠️ No coordinates for: ${appointment.subject.substring(0, 50)}...`);
        return;
      }

      const position = appointment.coordinates;

      // Create custom marker icon
      const isHovered = hoveredAppointment && hoveredAppointment.id === appointment.id;
      const markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#00D3DD', // Cyan color for markers
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: isHovered ? 4 : 3,
        scale: isHovered ? 15 : 12
      };

      // Extract short address for label (first part before comma)
      const locationText = appointment.locationString || appointment.location?.value || 'Location';
      const shortAddress = locationText.split(',')[0];
      
      const marker = new window.google.maps.Marker({
        position,
        map,
        icon: markerIcon,
        title: appointment.subject,
        label: {
          text: shortAddress.toUpperCase(),
          color: isHovered ? '#FF0505' : '#000000', // Red when hovered, black normally
          fontSize: '11px',
          fontWeight: 'bold',
          className: 'marker-label'
        },
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
              <span>${appointment.due_time?.substring(0, 5) || 'Time TBA'}${appointment.duration ? ` (${appointment.duration.substring(0, 5)})` : ''}</span>
            </div>
            <div style="display: flex; align-items: start; gap: 6px; margin-bottom: 8px; color: #6b7280; font-size: 12px;">
              <span>📍</span>
              <span>${locationText}</span>
            </div>
            <div style="display: flex; justify-content: between; align-items: center;">
              <span style="color: #059669; font-weight: 600; font-size: 12px;">
                ${appointment.inspection_fee ? `$${appointment.inspection_fee}` : 'Fee TBA'}
              </span>
              <span style="color: #6b7280; font-size: 11px; margin-left: 8px;">
                ${appointment.roof_type || appointment.type || 'Property Inspection'}
              </span>
            </div>
          </div>
        `,
        disableAutoPan: true
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
          fillColor: '#FF0505', // Red for potential booking
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
        `,
        disableAutoPan: true
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
  }, [map, geocodedAppointments, potentialBooking, hoveredAppointment]);

  // Calculate and display route
  useEffect(() => {
    if (!map || !directionsRenderer || geocodedAppointments.length < 2) {
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      return;
    }

    // Filter to appointments with valid coordinates
    const validAppointments = geocodedAppointments.filter(appointment => 
      appointment.coordinates && 
      typeof appointment.coordinates.lat === 'number' && 
      typeof appointment.coordinates.lng === 'number'
    );

    if (validAppointments.length < 2) {
      console.log('⚠️ Not enough appointments with valid coordinates for route calculation');
      console.log(`Valid: ${validAppointments.length}, Total: ${geocodedAppointments.length}`);
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      return;
    }

    const waypoints = validAppointments.slice(1, -1).map(appointment => ({
      location: appointment.coordinates,
      stopover: true
    }));

    // TODO: URGENT - Migrate to google.maps.routes.Route.computeRoutes
    // DirectionsService is deprecated as of Feb 25, 2026
    // See: https://developers.google.com/maps/documentation/javascript/routes/routes-js-migration
    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route({
      origin: validAppointments[0].coordinates,
      destination: validAppointments[validAppointments.length - 1].coordinates,
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
  }, [map, directionsRenderer, geocodedAppointments, onRouteCalculated]);

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

const GoogleMapsView = ({ 
  selectedInspector, 
  selectedDate, 
  onDateChange, 
  potentialBooking, 
  onDriveTimeCalculated, 
  hoveredAppointment, 
  onAppointmentHover, 
  onAppointmentLeave,
  activities = [],
  isLiveData = false,
  loading = false,
  isTimeout = false,
  error = null
}) => {
  const [totalDriveTime, setTotalDriveTime] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Get today's appointments for the selected inspector from passed Pipedrive activities
  const todaysAppointments = React.useMemo(() => {
    if (!selectedInspector || !selectedDate) return [];
    
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    // TEMP: Show all activities to debug time filtering
    const allActivities = activities
      .filter(activity => 
        Number(activity.owner_id) === Number(selectedInspector) && 
        activity.due_date === dateString && 
        !activity.done
      )
      .sort((a, b) => (a.due_time || '').localeCompare(b.due_time || ''));
      
    // TEMP: More permissive filter to see what we have
    const filtered = activities
      .filter(activity => {
        // Basic filters (Number() handles number/string coercion)
        if (Number(activity.owner_id) !== Number(selectedInspector)) return false;
        if (activity.due_date !== dateString) return false;
        if (activity.done) return false;
        if (!activity.due_time || activity.due_time === '00:00:00' || activity.due_time.trim() === '') return false;
        
        // Exclude follow-up tasks (keep this)
        if (activity.subject && activity.subject.includes('Inspector ENG Follow up')) return false;
        
        // TEMP: Allow all hours to see what times we have
        // const timeHour = parseInt(activity.due_time.split(':')[0]);
        // if (timeHour < 9 || timeHour >= 17) return false;
        
        // TEMP: Allow all activities with times (not just inspections)
        return true;
      })
      .sort((a, b) => a.due_time.localeCompare(b.due_time));
    
    console.log(`🏗️ Found ${filtered.length} property inspections for ${dateString} (filtered out ${allActivities.length - filtered.length} follow-ups/general tasks)`);
    
    // Debug: Show what we're filtering
    if (allActivities.length > 0) {
      console.log('📋 All activities for debugging:', allActivities.map(a => ({
        subject: a.subject,
        due_time: a.due_time,
        timeHour: a.due_time ? parseInt(a.due_time.split(':')[0]) : 'no-time',
        isFollowUp: a.subject?.includes('Inspector ENG Follow up'),
        isPropertyInspection: a.subject?.includes('Property Inspection'),
        hasInspectionKeyword: a.subject?.toLowerCase().includes('inspection')
      })));
    }
    
    // Return only timed appointments (filter out general tasks)
    return filtered;
  }, [selectedInspector, selectedDate, activities, isLiveData]);

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
        setIsGeocoding={setIsGeocoding}
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
            {isGeocoding && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                  <span>Loading locations...</span>
                </div>
              </>
            )}
            {!isGeocoding && totalDriveTime > 0 && (
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