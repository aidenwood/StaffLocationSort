import React, { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from 'date-fns';
import { MapPin, Clock, User, Phone, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import { 
  inspectors, 
  getActivitiesByInspectorAndDate,
  loganLocations 
} from '../data/mockActivities';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ VITE_GOOGLE_MAPS_API_KEY environment variable is required');
}

const ClientBooking = () => {
  const [step, setStep] = useState(1); // 1: Address, 2: Calendar
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(null); // Full place details
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    propertyType: 'House',
    specialRequests: ''
  });

  // Google Maps Autocomplete refs and state
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script already loading, wait for it
        const checkLoaded = () => {
          if (window.google && window.google.maps && window.google.maps.places) {
            setIsGoogleLoaded(true);
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsGoogleLoaded(true);
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Initialize autocomplete when Google is loaded and input is available
  useEffect(() => {
    if (isGoogleLoaded && addressInputRef.current && step === 1) {
      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'AU' },
        fields: ['formatted_address', 'geometry', 'address_components', 'place_id']
      });

      // Bias to Logan, QLD area
      const loganBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(-27.7500, 153.0000), // SW
        new window.google.maps.LatLng(-27.5000, 153.3000)  // NE
      );
      autocomplete.setBounds(loganBounds);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.geometry) {
          setAddress(place.formatted_address);
          setSelectedAddress({
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            place_id: place.place_id,
            address_components: place.address_components
          });
        }
      });

      autocompleteRef.current = autocomplete;
    }
  }, [isGoogleLoaded, step]);

  // Logan region inspectors only
  const loganInspectors = inspectors.filter(inspector => 
    inspector.region.toLowerCase().includes('logan')
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const timeSlots = [];
  for (let hour = 9; hour <= 16; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 16) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  // Get availability for Logan region (combine all inspectors)
  const getAvailabilityForDay = (date) => {
    const availability = {};
    
    timeSlots.forEach(timeSlot => {
      // Skip lunch hour
      if (timeSlot >= '12:00' && timeSlot < '13:00') {
        availability[timeSlot] = { available: false, reason: 'lunch' };
        return;
      }

      // Check if any inspector in Logan region is available
      const availableInspectors = loganInspectors.filter(inspector => {
        const activities = getActivitiesByInspectorAndDate(inspector.id, date);
        return !activities.find(activity => {
          const activityTime = activity.due_time.substring(0, 5);
          const endTime = calculateEndTime(activityTime, activity.duration.substring(0, 5));
          return timeSlot >= activityTime && timeSlot < endTime;
        });
      });

      availability[timeSlot] = {
        available: availableInspectors.length > 0,
        availableInspectors,
        reason: availableInspectors.length === 0 ? 'booked' : null
      };
    });

    return availability;
  };

  const calculateEndTime = (startTime, duration) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [durationHour, durationMin] = duration.split(':').map(Number);
    
    const totalMinutes = (startHour * 60 + startMin) + (durationHour * 60 + durationMin);
    const endHour = Math.floor(totalMinutes / 60);
    const endMin = totalMinutes % 60;
    
    return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (address.trim() && selectedAddress) {
      // Validate the address is in Logan/QLD area
      const isInLogan = selectedAddress.address_components.some(component => 
        component.types.includes('administrative_area_level_2') && 
        component.long_name.toLowerCase().includes('logan')
      ) || selectedAddress.address_components.some(component => 
        component.types.includes('locality') && 
        (component.long_name.toLowerCase().includes('logan') ||
         component.long_name.toLowerCase().includes('beenleigh') ||
         component.long_name.toLowerCase().includes('browns plains') ||
         component.long_name.toLowerCase().includes('springwood'))
      );

      if (!isInLogan) {
        alert('Sorry, we currently only service the Logan area. Please enter an address in Logan, QLD or surrounding areas.');
        return;
      }

      setStep(2);
    } else if (address.trim() && !selectedAddress) {
      alert('Please select a valid address from the dropdown suggestions.');
    }
  };

  const handleTimeSlotSelect = (day, timeSlot, availableInspectors) => {
    setSelectedDate(day);
    setSelectedTimeSlot({
      date: day,
      time: timeSlot,
      availableInspectors
    });
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    // Here would integrate with Pipedrive API
    const bookingData = {
      address: selectedAddress.formatted_address,
      location: {
        lat: selectedAddress.geometry.location.lat(),
        lng: selectedAddress.geometry.location.lng(),
        place_id: selectedAddress.place_id,
        address_components: selectedAddress.address_components
      },
      selectedTimeSlot,
      clientInfo,
      requestedDateTime: selectedTimeSlot.date,
      requestedTime: selectedTimeSlot.time,
      estimatedCost: 350,
      serviceType: 'roof_inspection'
    };
    
    console.log('Booking submitted with exact location:', bookingData);
    
    // Show success message
    alert(`Booking request submitted!\n\nAddress: ${selectedAddress.formatted_address}\nDate: ${format(selectedTimeSlot.date, 'EEEE, MMMM d, yyyy')}\nTime: ${selectedTimeSlot.time}\n\nWe will contact you shortly to confirm.`);
    
    // Reset form
    setStep(1);
    setAddress('');
    setSelectedAddress(null);
    setSelectedTimeSlot(null);
    setClientInfo({
      name: '',
      email: '',
      phone: '',
      propertyType: 'House',
      specialRequests: ''
    });
  };

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  if (step === 1) {
    // Address Input Step
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Book Your Roof Inspection
            </h1>
            <p className="text-gray-600">
              Professional roof inspections in Logan, QLD
            </p>
          </div>

          <form onSubmit={handleAddressSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Address
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    // Reset selected address if user is typing manually
                    if (selectedAddress && e.target.value !== selectedAddress.formatted_address) {
                      setSelectedAddress(null);
                    }
                  }}
                  placeholder={isGoogleLoaded ? "Start typing your address in Logan, QLD..." : "Loading address lookup..."}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    selectedAddress 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300'
                  }`}
                  disabled={!isGoogleLoaded}
                  required
                />
                {selectedAddress && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                )}
              </div>
              <p className={`text-xs mt-2 ${
                selectedAddress 
                  ? 'text-green-600' 
                  : 'text-gray-500'
              }`}>
                {selectedAddress 
                  ? '✓ Valid address selected' 
                  : 'We serve the greater Logan area including Logan Central, Beenleigh, and surrounding suburbs'
                }
              </p>
            </div>

            <button
              type="submit"
              disabled={!isGoogleLoaded || !selectedAddress}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {!isGoogleLoaded 
                ? 'Loading address lookup...' 
                : !selectedAddress 
                  ? 'Select an address from suggestions' 
                  : 'Find Available Times'
              }
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            <p>Standard roof inspection fee: <span className="font-semibold text-green-600">$350</span></p>
            <p className="mt-1">Typically takes 1 hour to complete</p>
          </div>
        </div>
      </div>
    );
  }

  // Calendar Selection Step
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Select Appointment Time</h1>
              <p className="text-gray-600 mt-1">
                <MapPin className="inline w-4 h-4 mr-1" />
                {address}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← Change Address
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Available Times</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigateWeek('prev')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-medium text-lg min-w-48 text-center">
                    {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                  </span>
                  <button 
                    onClick={() => navigateWeek('next')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="text-center">
                    <div className="font-semibold text-gray-900">
                      {format(day, 'EEE')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(day, 'MMM d')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const availability = getAvailabilityForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isPast = day < new Date() && !isToday;
                  
                  return (
                    <div key={day.toISOString()} className="space-y-1">
                      {timeSlots.map(timeSlot => {
                        const slot = availability[timeSlot];
                        const isAvailable = slot.available && !isPast;
                        const isSelected = selectedTimeSlot && 
                          isSameDay(selectedTimeSlot.date, day) && 
                          selectedTimeSlot.time === timeSlot;

                        return (
                          <button
                            key={timeSlot}
                            onClick={() => isAvailable ? handleTimeSlotSelect(day, timeSlot, slot.availableInspectors) : null}
                            disabled={!isAvailable}
                            className={`w-full p-2 text-xs rounded transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : isAvailable
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                  : slot.reason === 'lunch'
                                    ? 'bg-orange-50 text-orange-600 cursor-not-allowed'
                                    : isPast
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-red-50 text-red-600 cursor-not-allowed'
                            }`}
                            title={
                              isPast ? 'Past time slot' :
                              slot.reason === 'lunch' ? 'Lunch break' :
                              isAvailable ? `Available at ${timeSlot}` : 'Fully booked'
                            }
                          >
                            {timeSlot}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-sm mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded"></div>
                  <span>Lunch</span>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Details</h3>
            
            {selectedTimeSlot && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">Selected Time</span>
                </div>
                <p className="text-blue-700">
                  {format(selectedTimeSlot.date, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-blue-700 text-sm">
                  {selectedTimeSlot.time} (1 hour duration)
                </p>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo({...clientInfo, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({...clientInfo, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  value={clientInfo.propertyType}
                  onChange={(e) => setClientInfo({...clientInfo, propertyType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="House">House</option>
                  <option value="Unit">Unit</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requests
                </label>
                <textarea
                  value={clientInfo.specialRequests}
                  onChange={(e) => setClientInfo({...clientInfo, specialRequests: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any specific areas of concern or special requirements..."
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">Total Cost</p>
                  <p className="text-2xl font-bold text-green-600">$350</p>
                  <p className="text-sm text-gray-600">Payment due on completion</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedTimeSlot}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {selectedTimeSlot ? 'Book Inspection' : 'Select a time slot first'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientBooking;