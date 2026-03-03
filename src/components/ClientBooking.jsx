import React, { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from 'date-fns';
import { MapPin, Clock, User, Phone, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { 
  inspectors, 
  getActivitiesByInspectorAndDate,
  loganLocations 
} from '../data/mockActivities';
import { 
  realInspectors,
  realRoofInspectors,
  regionBreakdown 
} from '../data/realInspectorData';
import { 
  validateAddressInServiceArea, 
  getInspectorsByRegion, 
  calculateInspectorDriveTimes, 
  findBestInspectorMatches 
} from '../utils/regionValidation';
import { 
  validatePhoneNumber, 
  normalizePhoneNumber,
  getPhoneSearchVariations 
} from '../utils/phoneValidation';
import { getPersonAndDealsByPhoneNumber, getPersonAndDealsByEmail } from '../api/pipedriveRead';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCMzl7FEizPoEordMy_wHwbnBVeh2XcPfk';

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ VITE_GOOGLE_MAPS_API_KEY environment variable is required');
}

const ClientBookingForm = ({ selectedAddress }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    propertyType: 'House',
    roofType: '',
    specialRequests: ''
  });
  
  // Progressive form state
  const [formStep, setFormStep] = useState('phone'); // 'phone' -> 'email' -> 'details'
  const [customerSearch, setCustomerSearch] = useState({
    phoneSearch: { isSearching: false, hasSearched: false, found: false, data: null, error: null },
    emailSearch: { isSearching: false, hasSearched: false, found: false, data: null, error: null }
  });
  const [existingCustomer, setExistingCustomer] = useState(null);

  const address = selectedAddress?.formatted_address || 'Selected Address';

  // Handle phone number search
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    const phoneValidation = validatePhoneNumber(clientInfo.phone);
    if (!phoneValidation.isValid) {
      alert('Please enter a valid Australian phone number');
      return;
    }
    
    setCustomerSearch(prev => ({
      ...prev,
      phoneSearch: { ...prev.phoneSearch, isSearching: true }
    }));
    
    try {
      console.log('🔍 Searching for customer with phone:', clientInfo.phone);
      
      const searchResults = await getPersonAndDealsByPhoneNumber(phoneValidation.normalized);
      
      if (searchResults.mainPerson) {
        console.log('✅ Found existing customer:', searchResults.mainPerson.name);
        
        setExistingCustomer(searchResults.mainPerson);
        setClientInfo(prev => ({
          ...prev,
          name: searchResults.mainPerson.name || prev.name,
          email: searchResults.mainPerson.email?.[0]?.value || prev.email,
          phone: phoneValidation.formatted
        }));
        
        setCustomerSearch(prev => ({
          ...prev,
          phoneSearch: { isSearching: false, hasSearched: true, found: true, data: searchResults.mainPerson, error: null }
        }));
        
        // Skip to details form since we found customer
        setFormStep('details');
        
      } else {
        console.log('📞 No customer found, proceeding to email search');
        
        setCustomerSearch(prev => ({
          ...prev,
          phoneSearch: { isSearching: false, hasSearched: true, found: false, data: null, error: null }
        }));
        
        setFormStep('email');
      }
      
    } catch (error) {
      console.error('❌ Error searching for customer:', error.message);
      
      setCustomerSearch(prev => ({
        ...prev,
        phoneSearch: { isSearching: false, hasSearched: true, found: false, data: null, error: error.message }
      }));
      
      setFormStep('email');
    }
  };

  // Handle email search
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!clientInfo.email || !clientInfo.email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    
    setCustomerSearch(prev => ({
      ...prev,
      emailSearch: { ...prev.emailSearch, isSearching: true }
    }));
    
    try {
      console.log('🔍 Searching for customer with email:', clientInfo.email);
      
      const searchResults = await getPersonAndDealsByEmail(clientInfo.email);
      
      if (searchResults.mainPerson) {
        console.log('✅ Found existing customer:', searchResults.mainPerson.name);
        
        setExistingCustomer(searchResults.mainPerson);
        setClientInfo(prev => ({
          ...prev,
          name: searchResults.mainPerson.name || prev.name
        }));
        
        setCustomerSearch(prev => ({
          ...prev,
          emailSearch: { isSearching: false, hasSearched: true, found: true, data: searchResults.mainPerson, error: null }
        }));
        
        setFormStep('details');
        
      } else {
        console.log('📧 No customer found, proceeding to full form');
        
        setCustomerSearch(prev => ({
          ...prev,
          emailSearch: { isSearching: false, hasSearched: true, found: false, data: null, error: null }
        }));
        
        setFormStep('details');
      }
      
    } catch (error) {
      console.error('❌ Error searching for customer:', error.message);
      
      setCustomerSearch(prev => ({
        ...prev,
        emailSearch: { isSearching: false, hasSearched: true, found: false, data: null, error: error.message }
      }));
      
      setFormStep('details');
    }
  };

  // Logan region inspectors only
  const loganInspectors = inspectors.filter(inspector => 
    inspector.region.toLowerCase().includes('logan')
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const timeSlots = ['09:00', '11:00', '13:00', '15:00'];
  
  // Helper function to format time slots as ranges
  const formatTimeSlot = (timeSlot) => {
    const timeSlotMap = {
      '09:00': '9:00 AM - 10:00 AM',
      '11:00': '11:00 AM - 12:00 PM', 
      '13:00': '1:00 PM - 2:00 PM',
      '15:00': '3:00 PM - 4:00 PM'
    };
    return timeSlotMap[timeSlot] || timeSlot;
  };

  // Get availability for Logan region (combine all inspectors)
  const getAvailabilityForDay = (date) => {
    const availability = {};
    
    // Check if it's a weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    timeSlots.forEach(timeSlot => {
      // Skip weekends
      if (isWeekend) {
        availability[timeSlot] = { available: false, reason: 'weekend' };
        return;
      }
      
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
      address: selectedAddress?.formatted_address || address,
      location: selectedAddress ? {
        lat: selectedAddress.geometry.location.lat(),
        lng: selectedAddress.geometry.location.lng(),
        place_id: selectedAddress.place_id,
        address_components: selectedAddress.address_components
      } : null,
      selectedTimeSlot,
      clientInfo,
      requestedDateTime: selectedTimeSlot.date,
      requestedTime: selectedTimeSlot.time,
      estimatedCost: 350,
      serviceType: 'roof_inspection'
    };
    
    console.log('Booking submitted with exact location:', bookingData);
    
    // Show success message
    alert(`Booking request submitted!\n\nAddress: ${address}\nDate: ${format(selectedTimeSlot.date, 'EEEE, MMMM d, yyyy')}\nTime: ${formatTimeSlot(selectedTimeSlot.time)}\n\nWe will contact you shortly to confirm.`);
    
    // Reset form - go back to step 1
    window.location.hash = '#book';
    window.location.reload();
  };

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };


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
              onClick={() => {
                window.location.hash = '#book';
                window.location.reload();
              }}
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
                              slot.reason === 'weekend' ? 'Weekends not available' :
                              slot.reason === 'lunch' ? 'Lunch break' :
                              isAvailable ? `Available ${formatTimeSlot(timeSlot)}` : 'Fully booked'
                            }
                          >
                            {formatTimeSlot(timeSlot)}
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

          {/* Progressive Customer Form */}
          <div className="bg-white rounded-lg shadow p-6">
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
                  {formatTimeSlot(selectedTimeSlot.time)} (1 hour duration)
                </p>
              </div>
            )}

            {/* Step 1: Phone Number */}
            {formStep === 'phone' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Let's start with your phone number</h3>
                <p className="text-sm text-gray-600 mb-4">We'll check if you're an existing customer to save you time</p>
                
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo({...clientInfo, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0400 000 000"
                        required
                      />
                      {customerSearch.phoneSearch.isSearching && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={customerSearch.phoneSearch.isSearching}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {customerSearch.phoneSearch.isSearching ? 'Searching...' : 'Continue'}
                  </button>
                </form>
              </div>
            )}

            {/* Step 2: Email Address */}
            {formStep === 'email' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Now your email address</h3>
                <p className="text-sm text-gray-600 mb-4">We'll check if you have any existing quotes or deals with us</p>
                
                {/* Show phone number was not found */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="text-sm text-yellow-700">
                    Phone number {clientInfo.phone} not found in our records
                  </div>
                </div>
                
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={clientInfo.email}
                        onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="john@example.com"
                        required
                      />
                      {customerSearch.emailSearch.isSearching && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormStep('phone')}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={customerSearch.emailSearch.isSearching}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {customerSearch.emailSearch.isSearching ? 'Searching...' : 'Continue'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Full Details */}
            {formStep === 'details' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {existingCustomer ? `Welcome back, ${existingCustomer.name}!` : 'Complete your details'}
                </h3>
                
                {existingCustomer && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <User className="w-4 h-4" />
                      <span className="font-medium">Existing customer found!</span>
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      Your details have been pre-filled from our records
                    </div>
                  </div>
                )}
                
                {!existingCustomer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="text-sm text-blue-700">
                      New customer - please complete your details below
                    </div>
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
                      Property Type *
                    </label>
                    <select
                      value={clientInfo.propertyType}
                      onChange={(e) => setClientInfo({...clientInfo, propertyType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select property type</option>
                      <option value="House">House</option>
                      <option value="Unit">Unit</option>
                      <option value="Townhouse">Townhouse</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Roof Type *
                    </label>
                    <select
                      value={clientInfo.roofType}
                      onChange={(e) => setClientInfo({...clientInfo, roofType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select roof type</option>
                      <option value="metal">Metal Roof</option>
                      <option value="tile">Tile Roof</option>
                      <option value="decramastic">Decramastic Tiles</option>
                      <option value="asbestos">Asbestos Roof</option>
                    </select>
                    
                    {clientInfo.roofType && clientInfo.roofType !== 'metal' && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800">
                          <span className="font-medium">⚠️ Sorry, we only inspect metal roofs</span>
                        </div>
                        <div className="text-sm text-red-700 mt-1">
                          Our inspection services are specialized for metal roofing systems only. 
                          For other roof types, please contact us directly for recommendations.
                        </div>
                      </div>
                    )}
                  </div>

                  {clientInfo.roofType === 'metal' && (
                    <>
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
                          <p className="text-lg font-semibold text-gray-900">Inspection Cost</p>
                          <p className="text-2xl font-bold text-green-600">Free</p>
                          <p className="text-sm text-gray-600">No cost - completely free service</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormStep(customerSearch.phoneSearch.found ? 'phone' : 'email')}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedTimeSlot || !clientInfo.roofType || clientInfo.roofType !== 'metal'}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {!selectedTimeSlot 
                        ? 'Select a time slot first' 
                        : clientInfo.roofType !== 'metal' && clientInfo.roofType
                          ? 'Only metal roofs available'
                          : 'Book Free Inspection'
                      }
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component that handles Google Maps loading with manual script loading and timeout
const AddressStep = () => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  
  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if Google Maps with Places is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google Maps Places already loaded');
        setGoogleMapsLoaded(true);
        setLoading(false);
        return;
      }

      // Set a timeout to fall back after 15 seconds
      const timeoutId = setTimeout(() => {
        console.log('Google Maps loading timed out, using fallback');
        setLoadTimeout(true);
        setLoading(false);
        setGoogleMapsLoaded(false);
      }, 15000);

      // Check if script is already being loaded - but be more permissive
      let existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript && !existingScript.src.includes('places')) {
        console.log('Google Maps script exists but without places, loading new one');
        // Continue to load our own script
      } else if (existingScript && existingScript.src.includes('places')) {
        console.log('Google Maps script with places already exists, waiting for load');
        const checkLoaded = () => {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('Google Maps Places loaded successfully');
            clearTimeout(timeoutId);
            setGoogleMapsLoaded(true);
            setLoading(false);
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
        return;
      }

      // Load the script manually with places library
      console.log('Loading Google Maps with Places API');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      
      script.onload = () => {
        console.log('Google Maps script loaded, checking for Places API');
        const checkPlaces = () => {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('Google Maps Places API ready');
            clearTimeout(timeoutId);
            setGoogleMapsLoaded(true);
            setLoading(false);
          } else {
            setTimeout(checkPlaces, 100);
          }
        };
        checkPlaces();
      };
      
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
        clearTimeout(timeoutId);
        setLoading(false);
        setGoogleMapsLoaded(false);
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-sm text-gray-600">Loading address autocomplete...</div>
          <div className="text-xs text-gray-500 mt-2">
            {loadTimeout ? 'Taking longer than expected...' : 'This may take a moment'}
          </div>
        </div>
      </div>
    );
  }

  if (googleMapsLoaded) {
    console.log('Rendering AddressStepWithMaps');
    return <AddressStepWithMaps />;
  } else {
    console.log('Google Maps failed to load or timed out, using fallback');
    return <AddressStepFallback />;
  }
}

// Fallback version without Google Maps
const AddressStepFallback = () => {
  const [address, setAddress] = useState('');
  const [step, setStep] = useState(1);

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (address.trim()) {
      // Enhanced validation for all service regions
      const lowerAddress = address.toLowerCase();
      
      // Check if address contains any service area keywords
      const serviceAreaKeywords = [
        // R01 - Brisbane/Gold Coast/Logan/Ipswich
        'brisbane', 'logan', 'gold coast', 'ipswich', 'beaudesert',
        // R02 - Gympie/Maryborough  
        'gympie', 'maryborough', 'tin can bay',
        // R03 - Sunshine Coast
        'sunshine coast', 'moreton region',
        // R04 - Gatton/Toowoomba
        'gatton', 'toowoomba', 'oakey', 'stanthorpe', 'tara', 'warwick', 'texas',
        // R05 - Wide Service Territory
        'emerald', 'rockhampton', 'roma',
        // R06 - Regional East
        'grafton', 'port macquarie', 'coffs harbour',
        // R07 - Grafton/Port Macquarie
        'tamworth', 'armidale', 'glen innes',
        // R08 - Greater Armidale (duplicate locations from R06)
        // R09 - Newcastle Region
        'aberglasslyn', 'rutherford', 'maitland', 'newcastle', 'mereweather', 
        'gwandalan', 'port stephens', 'cessnock', 'lake macquarie', 'central coast',
        // State identifiers
        'qld', 'nsw'
      ];
      
      const hasServiceArea = serviceAreaKeywords.some(keyword => 
        lowerAddress.includes(keyword)
      );
      
      if (hasServiceArea) {
        // For fallback addresses, estimate coordinates based on address text
        let estimatedCoords = null;
        let validationResult = { inServiceArea: true, closestRegion: null };
        
        // Enhanced coordinate estimation for all service regions
        if (lowerAddress.includes('brisbane') || lowerAddress.includes('gold coast') || lowerAddress.includes('ipswich')) {
          estimatedCoords = { lat: -27.4698, lng: 153.0251 }; // R01 - BGCI
        } else if (lowerAddress.includes('logan') || lowerAddress.includes('beaudesert')) {
          estimatedCoords = { lat: -27.6386, lng: 153.1100 }; // R01 - Logan area
        } else if (lowerAddress.includes('gympie') || lowerAddress.includes('maryborough')) {
          estimatedCoords = { lat: -25.9500, lng: 152.7000 }; // R02 - GM
        } else if (lowerAddress.includes('sunshine coast') || lowerAddress.includes('noosa') || lowerAddress.includes('caloundra')) {
          estimatedCoords = { lat: -26.6500, lng: 153.0667 }; // R03 - SC
        } else if (lowerAddress.includes('toowoomba') || lowerAddress.includes('gatton') || lowerAddress.includes('warwick')) {
          estimatedCoords = { lat: -27.5598, lng: 151.9507 }; // R04 - GT
        } else if (lowerAddress.includes('emerald') || lowerAddress.includes('rockhampton') || lowerAddress.includes('roma')) {
          estimatedCoords = { lat: -23.8000, lng: 150.5000 }; // R05 - WST
        } else if (lowerAddress.includes('grafton') || lowerAddress.includes('port macquarie') || lowerAddress.includes('coffs harbour')) {
          estimatedCoords = { lat: -29.6891, lng: 152.9279 }; // R06 - RER
        } else if (lowerAddress.includes('tamworth') || lowerAddress.includes('armidale') || lowerAddress.includes('glen innes')) {
          estimatedCoords = { lat: -30.5000, lng: 151.6500 }; // R07 - GPM
        } else if (lowerAddress.includes('newcastle') || lowerAddress.includes('maitland') || lowerAddress.includes('central coast')) {
          estimatedCoords = { lat: -32.9283, lng: 151.7817 }; // R09 - NR
        } else if (lowerAddress.includes('qld')) {
          estimatedCoords = { lat: -27.4698, lng: 153.0251 }; // Default to Brisbane for QLD
        } else if (lowerAddress.includes('nsw')) {
          estimatedCoords = { lat: -32.9283, lng: 151.7817 }; // Default to Newcastle for NSW
        }
        
        if (estimatedCoords) {
          validationResult = validateAddressInServiceArea(estimatedCoords.lat, estimatedCoords.lng);
        }
        
        window.dispatchEvent(new CustomEvent('addressValidated', { 
          detail: { 
            formatted_address: address,
            geometry: null,
            place_id: null,
            address_components: [],
            coordinates: estimatedCoords,
            validation: validationResult
          } 
        }));
      } else {
        alert('Please enter an address in one of our service areas: QLD (Brisbane, Logan, Gold Coast, Sunshine Coast, Toowoomba, etc.) or NSW (Newcastle, Maitland, Central Coast, etc.)');
      }
    }
  };

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
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your full address in Logan, QLD..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <p className="text-xs mt-2 text-gray-500">
              We serve the greater Logan area including Logan Central, Beenleigh, and surrounding suburbs
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Find Available Times
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Our roof inspections are completely <span className="font-semibold text-green-600">free of charge</span></p>
          <p className="mt-1">Typically takes 1 hour to complete</p>
        </div>
      </div>
    </div>
  );
}

// Address step with Google Maps
const AddressStepWithMaps = () => {
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const initializeAutocomplete = () => {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.log('Google Maps Places API not ready yet');
        return false;
      }

      if (!addressInputRef.current) {
        console.log('Address input ref not ready yet');
        return false;
      }

      try {
        console.log('Initializing Google Places Autocomplete...');
        
        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'AU' },
          fields: ['formatted_address', 'geometry', 'address_components', 'place_id']
        });

        // Bias to Logan, QLD area
        const loganBounds = {
          north: -27.5000,
          south: -27.7500, 
          east: 153.3000,
          west: 153.0000
        };
        autocomplete.setBounds(loganBounds);

        autocomplete.addListener('place_changed', () => {
          console.log('Place changed event fired');
          const place = autocomplete.getPlace();
          console.log('Selected place:', place);
          
          if (place.formatted_address && place.geometry) {
            setAddress(place.formatted_address);
            setSelectedAddress({
              formatted_address: place.formatted_address,
              geometry: place.geometry,
              place_id: place.place_id,
              address_components: place.address_components
            });
            console.log('Address set:', place.formatted_address);
          }
        });

        autocompleteRef.current = autocomplete;
        console.log('✅ Google Places Autocomplete initialized successfully');
        return true;
      } catch (error) {
        console.error('Failed to initialize Google Places Autocomplete:', error);
        return false;
      }
    };

    // Try to initialize, if it fails, retry
    if (!initializeAutocomplete()) {
      const retryInterval = setInterval(() => {
        if (initializeAutocomplete()) {
          clearInterval(retryInterval);
        }
      }, 100);

      // Stop retrying after 10 seconds
      setTimeout(() => {
        clearInterval(retryInterval);
        console.log('Gave up trying to initialize Google Places Autocomplete');
      }, 10000);
    }
  }, []);

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (address.trim() && selectedAddress) {
      // Validate if address is in service area using comprehensive regions
      if (selectedAddress.geometry) {
        const addressLat = selectedAddress.geometry.location.lat();
        const addressLng = selectedAddress.geometry.location.lng();
        
        const validationResult = validateAddressInServiceArea(addressLat, addressLng);
        
        // Add validation result to address data
        const addressWithValidation = {
          ...selectedAddress,
          validation: validationResult,
          coordinates: { lat: addressLat, lng: addressLng }
        };
        
        // Navigate to region confirmation step
        window.dispatchEvent(new CustomEvent('addressValidated', { detail: addressWithValidation }));
      } else {
        // Fallback for addresses without geometry
        window.dispatchEvent(new CustomEvent('addressSelected', { detail: selectedAddress }));
      }
    } else if (address.trim() && !selectedAddress) {
      alert('Please select a valid address from the dropdown suggestions.');
    }
  };

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
                  if (selectedAddress && e.target.value !== selectedAddress.formatted_address) {
                    setSelectedAddress(null);
                  }
                }}
                placeholder="Start typing your address in Logan, QLD..."
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  selectedAddress 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300'
                }`}
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
            disabled={!selectedAddress}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {!selectedAddress 
              ? 'Select an address from suggestions' 
              : 'Find Available Times'
            }
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Our roof inspections are completely <span className="font-semibold text-green-600">free of charge</span></p>
          <p className="mt-1">Typically takes 1 hour to complete</p>
        </div>
      </div>
    </div>
  );
}

// Region confirmation component
const RegionConfirmationStep = ({ addressData, onConfirm, onBack }) => {
  const { validation, formatted_address } = addressData;
  const { inServiceArea, closestRegion } = validation;

  if (!inServiceArea) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Address Out of Service Area
            </h1>
            <p className="text-gray-600">
              Sorry, we don't currently service this location
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 mb-2">
              <strong>Address:</strong> {formatted_address}
            </p>
            <p className="text-sm text-red-800">
              <strong>Distance to closest service area:</strong> {closestRegion?.distance}km from {closestRegion?.name}
            </p>
            <p className="text-xs text-red-600 mt-2">
              We currently only service addresses within 75km of our inspector regions.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={onBack}
              className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              ← Try Different Address
            </button>
            
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Need service in this area? Contact us to discuss options.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-green-600 text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Service Area Confirmed
          </h1>
          <p className="text-gray-600">
            We have inspectors in your area
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 mb-2">
            <strong>Address:</strong> {formatted_address}
          </p>
          <p className="text-sm text-green-800 mb-2">
            <strong>Service Region:</strong> {closestRegion?.name}
          </p>
          <p className="text-sm text-green-800">
            <strong>Distance:</strong> {closestRegion?.distance}km from region center
          </p>
          
          <div className="mt-3">
            <p className="text-xs text-green-700 font-medium mb-1">Areas we serve in this region:</p>
            <p className="text-xs text-green-600">
              {closestRegion?.locations?.join(', ')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onConfirm(addressData)}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Find Available Inspectors →
          </button>
          
          <button
            onClick={onBack}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            ← Change Address
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            All roof inspections are completely <span className="font-semibold text-green-600">free</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            No cost - completely free service
          </p>
        </div>
      </div>
    </div>
  );
};

// Inspector selection component
const InspectorSelectionStep = ({ confirmedAddress, onBack, onInspectorSelect }) => {
  const [loading, setLoading] = useState(true);
  const [inspectorOptions, setInspectorOptions] = useState([]);
  
  useEffect(() => {
    const findBestInspectors = async () => {
      setLoading(true);
      
      const { validation, coordinates } = confirmedAddress;
      const { closestRegion } = validation;
      
      // Get inspectors in the region - use real inspector data
      const regionInspectors = getInspectorsByRegion(realInspectors, closestRegion.code);
      
      if (regionInspectors.length === 0) {
        setInspectorOptions([]);
        setLoading(false);
        return;
      }
      
      // Calculate drive times for each inspector
      const inspectorDriveTimes = await calculateInspectorDriveTimes(regionInspectors, coordinates);
      
      // Find the 3 best matches
      const bestMatches = findBestInspectorMatches(inspectorDriveTimes);
      
      setInspectorOptions(bestMatches);
      setLoading(false);
    };
    
    if (confirmedAddress) {
      findBestInspectors();
    }
  }, [confirmedAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-sm text-gray-600">Finding available inspectors...</div>
        </div>
      </div>
    );
  }

  if (inspectorOptions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-yellow-600 text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              No Inspectors Available
            </h1>
            <p className="text-gray-600">
              No inspectors found in the {confirmedAddress.validation.closestRegion?.name} region
            </p>
          </div>
          
          <button
            onClick={onBack}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Select Your Inspector</h1>
              <p className="text-gray-600 mt-1">
                <MapPin className="inline w-4 h-4 mr-1" />
                {confirmedAddress.formatted_address}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Showing {inspectorOptions.length} available inspector{inspectorOptions.length !== 1 ? 's' : ''} in {confirmedAddress.validation.closestRegion?.name}
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← Change Region
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {inspectorOptions.map((option, index) => {
            const { inspector, distance, estimatedDriveTime, driveTimeAddition } = option;
            
            return (
              <div key={inspector.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-green-600' : index === 1 ? 'bg-blue-600' : 'bg-orange-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{inspector.name}</h3>
                          <p className="text-sm text-gray-600">{inspector.jobTitle}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Region</p>
                          <p className="font-medium">{inspector.region}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Location</p>
                          <p className="font-medium">{inspector.location}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Distance</p>
                          <p className="font-medium">{distance}km</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Travel Time</p>
                          <p className="font-medium">{estimatedDriveTime} min</p>
                        </div>
                      </div>
                      
                      {index === 0 && (
                        <div className="mt-3 inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          ⭐ Closest Match
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => onInspectorSelect(inspector)}
                      className={`ml-4 px-6 py-3 rounded-lg font-medium transition-colors ${
                        index === 0 
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Select {inspector.name.split(' ')[0]}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 text-lg">ℹ️</div>
            <div>
              <p className="text-blue-800 font-medium mb-1">About Inspector Selection</p>
              <p className="text-blue-700 text-sm">
                Inspectors are ranked by travel efficiency to minimize scheduling impact. 
                Selecting the closest inspector may result in earlier availability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientBooking = () => {
  const [step, setStep] = useState(1); // 1: Address, 2: Region Confirmation, 3: Inspector Selection, 4: Calendar
  const [addressData, setAddressData] = useState(null);
  const [confirmedAddress, setConfirmedAddress] = useState(null);

  useEffect(() => {
    const handleAddressValidated = (event) => {
      setAddressData(event.detail);
      setStep(2); // Go to region confirmation
    };

    const handleAddressSelected = (event) => {
      // For fallback addresses without coordinates
      setAddressData(event.detail);
      setStep(2);
    };

    window.addEventListener('addressValidated', handleAddressValidated);
    window.addEventListener('addressSelected', handleAddressSelected);
    
    return () => {
      window.removeEventListener('addressValidated', handleAddressValidated);
      window.removeEventListener('addressSelected', handleAddressSelected);
    };
  }, []);

  const handleRegionConfirm = (addressData) => {
    setConfirmedAddress(addressData);
    setStep(3); // Go to inspector selection
  };

  const handleBackToAddress = () => {
    setStep(1);
    setAddressData(null);
    setConfirmedAddress(null);
  };

  if (step === 1) {
    return <AddressStep />;
  }

  if (step === 2) {
    return (
      <RegionConfirmationStep 
        addressData={addressData}
        onConfirm={handleRegionConfirm}
        onBack={handleBackToAddress}
      />
    );
  }

  if (step === 3) {
    return <InspectorSelectionStep confirmedAddress={confirmedAddress} onBack={() => setStep(2)} onInspectorSelect={(inspector) => setStep(4)} />;
  }

  // Calendar step - pass the confirmed address
  return <ClientBookingForm selectedAddress={confirmedAddress} />;
}

export default ClientBooking;