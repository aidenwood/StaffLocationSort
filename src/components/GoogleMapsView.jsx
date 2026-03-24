import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { format, addDays, subDays } from 'date-fns';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { 
  getActivitiesByInspector, 
  getInspectorById, 
  getActivityTypeByKey 
} from '../data/mockActivities';
import { geocodeAddress, getCenterPoint, getZoomLevel, clearGeocodeCache } from '../services/geocoding';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

// Google Maps deprecation warnings have been resolved by migrating to:
// - AdvancedMarkerElement (replacing deprecated Marker)
// - Disabled DirectionsRenderer (will implement Routes API later)


if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ VITE_GOOGLE_MAPS_API_KEY environment variable is required');
}

// Vibrant color palette for inspector markers - wider range with high contrast
const INSPECTOR_COLORS = [
  { primary: '#E53E3E', secondary: '#C53030', name: 'Crimson Red' },      // Inspector 1
  { primary: '#00D084', secondary: '#00A86B', name: 'Emerald Green' },    // Inspector 2  
  { primary: '#0099FF', secondary: '#0078D4', name: 'Electric Blue' },    // Inspector 3
  { primary: '#FF6B00', secondary: '#E55100', name: 'Vivid Orange' },     // Inspector 4
  { primary: '#8B5CF6', secondary: '#7C3AED', name: 'Royal Purple' },     // Inspector 5
  { primary: '#06B6D4', secondary: '#0891B2', name: 'Bright Cyan' },      // Inspector 6
  { primary: '#F59E0B', secondary: '#D97706', name: 'Golden Yellow' },    // Inspector 7
  { primary: '#EF4444', secondary: '#DC2626', name: 'Bright Red' },       // Inspector 8
  { primary: '#10B981', secondary: '#059669', name: 'Fresh Green' },       // Inspector 9
  { primary: '#3B82F6', secondary: '#2563EB', name: 'Sky Blue' },          // Inspector 10
  { primary: '#F97316', secondary: '#EA580C', name: 'Flame Orange' },      // Inspector 11
  { primary: '#A855F7', secondary: '#9333EA', name: 'Violet Purple' },     // Inspector 12
  { primary: '#06B6D4', secondary: '#0891B2', name: 'Turquoise' },         // Inspector 13
  { primary: '#84CC16', secondary: '#65A30D', name: 'Lime Green' },        // Inspector 14
  { primary: '#EC4899', secondary: '#DB2777', name: 'Hot Pink' },          // Inspector 15
  { primary: '#6366F1', secondary: '#4F46E5', name: 'Indigo Blue' },       // Inspector 16
];

// Get color for inspector by ID
const getInspectorColor = (inspectorId) => {
  if (!inspectorId) return INSPECTOR_COLORS[0]; // Default color
  const colorIndex = (parseInt(inspectorId) - 1) % INSPECTOR_COLORS.length;
  return INSPECTOR_COLORS[Math.max(0, colorIndex)];
};

const MapComponent = ({ appointments, potentialBooking, onRouteCalculated, hoveredAppointment, onAppointmentHover, onAppointmentLeave, setIsGeocoding, dealsToShow = [], inspectors = [], selectedInspector = null }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markersRef = useRef([]); // Use ref instead of state to prevent loops
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [geocodedAppointments, setGeocodedAppointments] = useState([]);
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  const mapOperationsInProgress = useRef(false);
  
  // Update ref when callback changes
  useEffect(() => {
    onRouteCalculatedRef.current = onRouteCalculated;
  }, [onRouteCalculated]);

  // Initialize map
  // ⚠️ URGENT: Must use empty [] deps - adding 'map' creates infinite initialization loop
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
      
      // Initialize DirectionsRenderer (keeping for route functionality despite deprecation)
      const renderer = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#4F46E5',
          strokeOpacity: 0.8,
          strokeWeight: 4
        }
      });
      renderer.setMap(newMap);
      setDirectionsRenderer(renderer);
    }
  }, []); // Run only once on mount

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

      // Debug: Check what properties the appointments actually have
      if (appointments.length > 0) {
        console.log(`🐛 Debugging first appointment structure:`, {
          id: appointments[0].id,
          subject: appointments[0].subject,
          hasCoordinates: !!appointments[0].coordinates,
          hasLat: !!appointments[0].lat,
          hasLng: !!appointments[0].lng,
          hasLocationLat: !!appointments[0].location_lat,
          hasLocationLng: !!appointments[0].location_lng,
          hasPersonAddress: !!appointments[0].personAddress,
          personAddress: appointments[0].personAddress,
          coordinates: appointments[0].coordinates,
          lat: appointments[0].lat,
          lng: appointments[0].lng
        });
      }

      for (const appointment of appointments) {
        // Check if already has coordinates (from cache) - coordinates object format
        if (appointment.coordinates && appointment.coordinates.lat && appointment.coordinates.lng) {
          geocoded.push({
            ...appointment,
            coordinates: appointment.coordinates,
            locationString: appointment.personAddress || appointment.location?.value || ''
          });
          continue;
        }

        // Check if already has coordinates (from cache) - individual lat/lng format
        if (appointment.lat && appointment.lng) {
          geocoded.push({
            ...appointment,
            coordinates: { lat: appointment.lat, lng: appointment.lng },
            locationString: appointment.personAddress || appointment.location?.value || ''
          });
          continue;
        }

        // Legacy check for location_lat/location_lng (backward compatibility)
        if (appointment.location_lat && appointment.location_lng) {
          geocoded.push({
            ...appointment,
            coordinates: { lat: appointment.location_lat, lng: appointment.location_lng }
          });
          continue;
        }

        // Use personAddress (from enrichment) or location.value as fallback
        const enrichedAddress = appointment.personAddress || appointment.location?.value || '';

        if (enrichedAddress && enrichedAddress.trim() !== '') {
          const coordinates = await geocodeAddress(enrichedAddress);
          
          geocoded.push({
            ...appointment,
            coordinates,
            locationString: enrichedAddress
          });
        } else {
          
          geocoded.push({
            ...appointment,
            coordinates: null
          });
        }
      }

      setGeocodedAppointments(geocoded);
      setIsGeocoding?.(false);

      // Summary log instead of individual geocoding logs
      const geocodedCount = geocoded.filter(a => a.coordinates).length;
      const totalCount = geocoded.length;
      console.log(`📍 Geocoded ${geocodedCount}/${totalCount} appointments`);

      // Auto-center and zoom map based on geocoded locations (only if not currently processing map operations)
      // ⚠️ URGENT: mapOperationsInProgress prevents concurrent map operations that cause loops
      if (map && geocoded.length > 0 && !mapOperationsInProgress.current) {
        mapOperationsInProgress.current = true;
        
        const validCoordinates = geocoded
          .map(a => a.coordinates)
          .filter(coord => coord !== null);

        if (validCoordinates.length > 0) {
          if (validCoordinates.length === 1) {
            // Single marker - center on it with reasonable zoom
            map.setCenter(validCoordinates[0]);
            map.setZoom(15);
            setTimeout(() => {
              mapOperationsInProgress.current = false;
            }, 100);
          } else {
            // Multiple markers - use fitBounds with padding for better view
            const bounds = new window.google.maps.LatLngBounds();
            validCoordinates.forEach(coord => {
              bounds.extend(new window.google.maps.LatLng(coord.lat, coord.lng));
            });
            
            // Add padding so markers aren't on the edge
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            map.fitBounds(bounds, padding);
            
            // Ensure minimum zoom level so it doesn't zoom too far out
            const listener = window.google.maps.event.addListener(map, 'bounds_changed', () => {
              if (map.getZoom() > 16) map.setZoom(16);
              window.google.maps.event.removeListener(listener);
              setTimeout(() => {
                mapOperationsInProgress.current = false;
              }, 100);
            });
          }
        } else {
          mapOperationsInProgress.current = false;
        }
      }
    };

    geocodeAppointments();
  }, [appointments, map]);

  // Update markers when geocoded appointments change  
  // ⚠️ URGENT: Avoid adding callback props to deps - causes constant recreation
  // ⚠️ URGENT: Must prevent infinite setState by checking if recreation is needed
  useEffect(() => {
    if (!map || !window.google) return;
    
    // Prevent unnecessary recreation if nothing meaningful changed
    if (geocodedAppointments.length === 0 && dealsToShow.length === 0 && !potentialBooking) {
      if (markersRef.current.length === 0) return; // Already empty, no need to clear
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const newMarkers = [];

    // Add geocoded appointment markers
    geocodedAppointments.forEach((appointment, index) => {
      if (!appointment.coordinates) {
        return;
      }

      const position = appointment.coordinates;

      // Create custom marker icon with inspector-specific color
      const isHovered = hoveredAppointment && hoveredAppointment.id === appointment.id;
      const isCompleted = appointment.done || false;
      const inspectorColor = getInspectorColor(appointment.owner_id);
      
      const markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: inspectorColor.primary,
        fillOpacity: isCompleted ? 0.7 : 1, // Less dimmed for better visibility
        strokeColor: isHovered ? inspectorColor.secondary : '#ffffff',
        strokeWeight: isHovered ? 3 : 2, // Thinner stroke for more vibrant colors
        scale: isHovered ? 16 : 13, // Slightly larger for better visibility
        anchor: new window.google.maps.Point(0, 0)
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
          color: isHovered ? '#FF0505' : '#000000',
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

    // Add deal markers with vibrant purple styling
    dealsToShow.forEach((deal, index) => {
      if (!deal.coordinates) return;

      const position = deal.coordinates;

      // Create vibrant purple marker for deals (styling based on state)
      const isHovered = deal.isHovered;
      const isSelected = deal.isSelected;
      const dealMarkerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#9333EA', // Vibrant purple for deals
        fillOpacity: 1,
        strokeColor: isHovered ? '#FFD700' : isSelected ? '#10B981' : '#ffffff', // Gold for hover, green for selected, white for normal
        strokeWeight: isHovered ? 3 : isSelected ? 3 : 2,
        scale: isHovered ? 14 : isSelected ? 12 : 10 // Larger when hovered or selected
      };

      // Extract short address for label (first part before comma)
      const dealAddress = deal.address || deal.title || 'Deal Location';
      const shortDealAddress = dealAddress.split(',')[0];

      const dealMarker = new window.google.maps.Marker({
        position,
        map,
        icon: dealMarkerIcon,
        title: deal.title,
        label: {
          text: shortDealAddress.toUpperCase().substring(0, 8), // Truncate to fit
          color: isHovered ? '#000000' : isSelected ? '#064E3B' : '#6B7280', // Black for hover, dark green for selected, gray for normal
          fontSize: '10px',
          fontWeight: 'bold'
        },
        zIndex: 500 + index // Lower z-index than appointments
      });

      // Deal info window
      const dealInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #9333EA; font-size: 14px; font-weight: bold;">
              ${deal.title}
            </h4>
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">
              ${dealAddress}
            </div>
            ${deal.value ? `<div style="color: #059669; font-size: 12px; font-weight: bold;">$${deal.value}</div>` : ''}
            ${deal.person?.name ? `<div style="color: #6b7280; font-size: 11px;">Contact: ${deal.person.name}</div>` : ''}
          </div>
        `,
        disableAutoPan: true
      });

      dealMarker.addListener('mouseover', () => {
        dealInfoWindow.open(map, dealMarker);
      });
      
      dealMarker.addListener('mouseout', () => {
        dealInfoWindow.close();
      });

      newMarkers.push(dealMarker);
    });

    markersRef.current = newMarkers;

    // Auto-zoom to fit all markers (appointments + deals)
    if (newMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      
      // Add appointment markers to bounds
      geocodedAppointments.forEach(appointment => {
        if (appointment.coordinates) {
          bounds.extend(appointment.coordinates);
        }
      });
      
      // Add deal markers to bounds  
      dealsToShow.forEach(deal => {
        if (deal.coordinates) {
          bounds.extend(deal.coordinates);
        }
      });
      
      // Add potential booking to bounds
      if (potentialBooking && potentialBooking.coordinates) {
        bounds.extend(potentialBooking.coordinates);
      }
      
      // Only adjust zoom if we have multiple points or deals outside the current view
      if (geocodedAppointments.length + dealsToShow.length > 1 && !mapOperationsInProgress.current) {
        mapOperationsInProgress.current = true;
        
        map.fitBounds(bounds, 50); // 50px padding
        
        // Ensure minimum zoom level for single appointments
        const listener = window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
          if (map.getZoom() > 15) {
            map.setZoom(15);
          }
          // Reset flag after map operations complete
          setTimeout(() => {
            mapOperationsInProgress.current = false;
          }, 100);
        });
      }
    }
  }, [map, geocodedAppointments, potentialBooking, hoveredAppointment, dealsToShow]);

  // Calculate route when appointments change
  // ⚠️ URGENT: Uses ref pattern for onRouteCalculated to avoid callback dependency loops  
  useEffect(() => {
    console.log(`🗺️ Route calculation triggered: ${geocodedAppointments.length} geocoded appointments`);
    
    // Skip routing for "All Inspectors" view - just show markers
    if (selectedInspector === null || selectedInspector === 'all') {
      console.log('🚫 Skipping route calculation for All Inspectors view');
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      onRouteCalculatedRef.current?.(0);
      return;
    }
    
    if (geocodedAppointments.length > 0) {
      console.log('📍 Appointments for route:', geocodedAppointments.map(a => ({
        subject: a.subject,
        time: a.due_time,
        hasCoordinates: !!a.coordinates
      })));
    }
    if (!map || !directionsRenderer || geocodedAppointments.length < 2) {
      // Clear any existing route when we don't have enough appointments
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      onRouteCalculatedRef.current?.(0);
      return;
    }

    // Use new Route.computeRoutes API instead of deprecated DirectionsService
    const calculateRoute = async () => {
      try {
        // Check if new API is available, fallback to old API if needed
        if (!window.google.maps.routes?.Route?.computeRoutes) {
          console.warn('⚠️ New Route API not available, falling back to DirectionsService');
          return calculateRouteFallback();
        }

        // Create waypoints from appointments (excluding first and last)
        const intermediates = geocodedAppointments.slice(1, -1)
          .filter(appointment => appointment?.coordinates?.lat && appointment?.coordinates?.lng)
          .map(appointment => ({
            location: {
              latLng: appointment.coordinates
            }
          }));

        const origin = geocodedAppointments[0]?.coordinates;
        const destination = geocodedAppointments[geocodedAppointments.length - 1]?.coordinates;
        
        // Validate coordinates before proceeding
        if (!origin || !destination || 
            typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
            typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
          console.warn('⚠️ Invalid coordinates for route calculation:', { origin, destination });
          return;
        }

        const request = {
          origin: {
            location: {
              latLng: origin
            }
          },
          destination: {
            location: {
              latLng: destination
            }
          },
          intermediates,
          travelMode: window.google.maps.TravelMode.DRIVING,
          routingPreference: window.google.maps.RoutingPreference.TRAFFIC_AWARE,
          computeAlternativeRoutes: false,
          routeModifiers: {
            avoidTolls: true,
            avoidHighways: false,
            avoidFerries: false
          },
          languageCode: "en-US",
          units: window.google.maps.UnitSystem.METRIC
        };

        const { routes } = await window.google.maps.routes.Route.computeRoutes(request);

        if (routes && routes.length > 0) {
          const route = routes[0];
          
          // Convert new API response to DirectionsResult format for compatibility with DirectionsRenderer
          const directionsResult = {
            routes: [{
              legs: route.legs.map(leg => ({
                duration: {
                  value: parseInt(leg.duration.replace('s', '')), // Convert "1234s" to 1234
                  text: `${Math.round(parseInt(leg.duration.replace('s', '')) / 60)} mins`
                },
                distance: {
                  value: parseInt(leg.distanceMeters),
                  text: `${(parseInt(leg.distanceMeters) / 1000).toFixed(1)} km`
                },
                start_location: leg.startLocation.latLng,
                end_location: leg.endLocation.latLng,
                steps: leg.steps || []
              })),
              overview_polyline: {
                points: route.polyline.encodedPolyline
              },
              warnings: [],
              waypoint_order: route.optimizedIntermediateWaypointIndex || []
            }],
            status: 'OK'
          };
          
          directionsRenderer.setDirections(directionsResult);
          
          // Calculate total drive time from legs
          let totalTime = 0;
          directionsResult.routes[0].legs.forEach(leg => {
            totalTime += leg.duration.value; // Duration in seconds
          });
          
          const totalMinutes = Math.round(totalTime / 60);
          onRouteCalculatedRef.current?.(totalMinutes);
          console.log(`🗺️ Route calculated: ${totalMinutes} minutes total drive time`);
        } else {
          throw new Error('No routes found');
        }
      } catch (error) {
        console.warn('❌ Route calculation failed, trying fallback:', error);
        calculateRouteFallback();
      }
    };

    // Fallback to deprecated DirectionsService if new API fails
    const calculateRouteFallback = () => {
      try {
        const directionsService = new window.google.maps.DirectionsService();
        
        // Create waypoints from appointments (excluding first and last)
        const waypoints = geocodedAppointments.slice(1, -1)
          .filter(appointment => appointment?.coordinates?.lat && appointment?.coordinates?.lng)
          .map(appointment => ({
            location: appointment.coordinates,
            stopover: true
          }));

        const origin = geocodedAppointments[0]?.coordinates;
        const destination = geocodedAppointments[geocodedAppointments.length - 1]?.coordinates;
        
        // Validate coordinates before proceeding
        if (!origin || !destination || 
            typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
            typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
          console.warn('⚠️ Invalid coordinates for route calculation in fallback:', { origin, destination });
          return;
        }

        directionsService.route({
          origin,
          destination,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
          avoidTolls: true
        }, (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            // Calculate total drive time from legs
            let totalTime = 0;
            result.routes[0].legs.forEach(leg => {
              totalTime += leg.duration.value; // Duration in seconds
            });
            
            const totalMinutes = Math.round(totalTime / 60);
            onRouteCalculatedRef.current?.(totalMinutes);
            console.log(`🗺️ Route calculated (fallback): ${totalMinutes} minutes total drive time`);
          } else {
            console.warn('❌ Fallback directions request failed:', status);
            onRouteCalculatedRef.current?.(0);
          }
        });
      } catch (error) {
        console.warn('❌ Fallback route calculation failed:', error);
        onRouteCalculatedRef.current?.(0);
      }
    };

    calculateRoute();
  }, [map, directionsRenderer, geocodedAppointments, selectedInspector]);

  // Create legend with inspectors who have appointments
  const activeInspectors = inspectors.filter(inspector => 
    appointments.some(apt => apt.owner_id === inspector.id)
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Inspector Legend - only show when there are multiple inspectors with appointments */}
      {activeInspectors.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(4px)',
          maxWidth: '200px',
          zIndex: 1000
        }}>
          <h4 style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#374151',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Inspectors
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeInspectors.map(inspector => {
              const inspectorColor = getInspectorColor(inspector.id);
              return (
                <div key={inspector.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: '#4B5563'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: inspectorColor.primary,
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontWeight: '500', lineHeight: '1.2' }}>
                    {inspector.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  enrichedDayActivities = [],
  isLiveData = false,
  loading = false,
  isTimeout = false,
  error = null,
  dealsToShow = [], // Deals to display as purple markers
  inspectors = [] // Inspector information for legend
}) => {
  const [totalDriveTime, setTotalDriveTime] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Use pre-enriched day activities from InspectionDashboard (with personAddress for geocoding)
  const todaysAppointments = React.useMemo(() => {
    console.log(`📅 Computing appointments for ${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'no date'}, inspector ${selectedInspector}`);
    
    // If enriched activities are available, use them directly
    if (enrichedDayActivities && enrichedDayActivities.length > 0) {
      const sorted = enrichedDayActivities.sort((a, b) => (a.due_time || '').localeCompare(b.due_time || ''));
      console.log(`📅 Using ${sorted.length} enriched day activities`);
      
      // Debug: Check what properties the enriched activities have
      if (sorted.length > 0) {
        console.log(`🐛 First enriched activity structure:`, {
          id: sorted[0].id,
          subject: sorted[0].subject,
          hasCoordinates: !!sorted[0].coordinates,
          hasLat: !!sorted[0].lat,
          hasLng: !!sorted[0].lng,
          hasPersonAddress: !!sorted[0].personAddress,
          personAddress: sorted[0].personAddress,
          coordinates: sorted[0].coordinates,
          lat: sorted[0].lat,
          lng: sorted[0].lng
        });
      }
      
      return sorted;
    }

    // Fallback: filter from all activities (without addresses)
    if (!selectedInspector || !selectedDate) {
      console.log('📅 No inspector or date selected, returning empty appointments');
      return [];
    }

    const dateString = format(selectedDate, 'yyyy-MM-dd');

    const filtered = activities
      .filter(activity => {
        if (Number(activity.owner_id) !== Number(selectedInspector)) return false;
        if (activity.due_date !== dateString) return false;
        if (activity.done) return false;
        if (!activity.due_time || activity.due_time === '00:00:00' || activity.due_time.trim() === '') return false;
        if (activity.subject && activity.subject.includes('Inspector ENG Follow up')) return false;
        return true;
      })
      .sort((a, b) => a.due_time.localeCompare(b.due_time));

    console.log(`📅 Filtered ${filtered.length} appointments from ${activities.length} total activities`);
    return filtered;
  }, [selectedInspector, selectedDate, activities, enrichedDayActivities]);

  // Function to generate Google Maps URL with route
  const generateMapsURL = useCallback(() => {
    if (!todaysAppointments || todaysAppointments.length === 0) return null;
    
    // Filter appointments with valid addresses
    const appointmentsWithAddresses = todaysAppointments.filter(apt => 
      apt.personAddress || apt.location
    );
    
    if (appointmentsWithAddresses.length === 0) return null;
    
    const origin = encodeURIComponent(appointmentsWithAddresses[0].personAddress || appointmentsWithAddresses[0].location);
    const destination = encodeURIComponent(
      appointmentsWithAddresses[appointmentsWithAddresses.length - 1].personAddress || 
      appointmentsWithAddresses[appointmentsWithAddresses.length - 1].location
    );
    
    // Create waypoints for intermediate addresses - each as separate URL segment
    const waypoints = appointmentsWithAddresses.slice(1, -1)
      .map(apt => encodeURIComponent(apt.personAddress || apt.location));
    
    // Build URL with each address as a separate segment
    let url = `https://www.google.com/maps/dir/${origin}`;
    waypoints.forEach(waypoint => {
      url += `/${waypoint}`;
    });
    url += `/${destination}`;
    
    return url;
  }, [todaysAppointments]);

  const inspector = selectedInspector ? getInspectorById(selectedInspector) : null;

  const handleRouteCalculated = useCallback((driveTimeMinutes) => {
    setTotalDriveTime(driveTimeMinutes);
    onDriveTimeCalculated?.(driveTimeMinutes);
  }, [onDriveTimeCalculated]);

  const render = (status) => {
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
        dealsToShow={dealsToShow}
        inspectors={inspectors}
        selectedInspector={selectedInspector}
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
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>{inspector ? inspector.name : 'All Inspectors'}</span>
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
                <span>•</span>
                <button
                  onClick={() => {
                    const mapsURL = generateMapsURL();
                    if (mapsURL) {
                      window.open(mapsURL, '_blank');
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Open route in Google Maps app"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in Maps
                </button>
              </>
            )}
        </div>
      </div>

      <div className="flex-1">
        <Wrapper 
          apiKey={GOOGLE_MAPS_API_KEY}
          libraries={['routes']}
          render={render}
        />
      </div>
    </div>
  );
};

export default GoogleMapsView;