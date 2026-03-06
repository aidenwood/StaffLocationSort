import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Phone, Home, DollarSign, X } from 'lucide-react';
import { 
  inspectors, 
  getActivitiesByInspectorAndDate, 
  getActivitiesByInspector,
  getActivityTypeByKey,
  getInspectorById 
} from '../data/mockActivities';

const InspectorCalendar = ({ 
  onSelectTimeSlot, 
  selectedInspector, 
  selectedDate, 
  onInspectorChange, 
  onDateChange, 
  fullScreen = false, 
  hoveredAppointment, 
  onAppointmentHover, 
  onAppointmentLeave,
  activities = null,
  inspectors = null,
  isLiveData = false,
  loading = false,
  isTimeout = false,
  error = null
}) => {
  const [currentWeek, setCurrentWeek] = useState(selectedDate || new Date());
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState(5); // 1, 3, or 5 days

  // Only use real Pipedrive data - no mock fallbacks
  const effectiveActivities = activities || [];
  const effectiveInspectors = inspectors || [];

  // Debug: log activity structure once when activities change
  React.useEffect(() => {
    if (effectiveActivities.length > 0 && selectedInspector) {
      const sample = effectiveActivities.slice(0, 5).map(a => ({
        due_date: a.due_date,
        due_time: a.due_time,
        owner_id: a.owner_id,
        subject: (a.subject || '').substring(0, 40),
        done: a.done
      }));
      const inspectorMatch = effectiveInspectors.find(i => i.id === selectedInspector);
      console.log('📅 CALENDAR DEBUG: activities count:', effectiveActivities.length, '| selectedInspector:', selectedInspector, '| inspector found:', !!inspectorMatch, '| sample:', sample);
      // Check how many fall in 8-17:30 range
      const inRange = effectiveActivities.filter(a => {
        const t = a.due_time?.substring(0, 5) || '';
        const [h, m] = t.split(':').map(Number);
        const mins = (h || 0) * 60 + (m || 0);
        return mins >= 8 * 60 && mins < 18 * 60; // 8:00 to 17:59
      });
      console.log('📅 CALENDAR DEBUG: activities in 8:00-18:00 range:', inRange.length, 'of', effectiveActivities.length);
    }
  }, [effectiveActivities.length, selectedInspector, effectiveInspectors]);

  // Update current time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync current week with selected date
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentWeek(selectedDate);
    }
  }, [selectedDate]);
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  
  // Calculate days to show based on viewMode (only weekdays)
  const getViewDays = () => {
    const days = [];
    const start = new Date(weekStart);
    
    // Find the first weekday (Monday) from current date
    const baseDate = selectedDate || currentWeek;
    const currentDay = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let startDate;
    if (currentDay === 0) { // Sunday
      startDate = addDays(baseDate, 1); // Move to Monday
    } else if (currentDay === 6) { // Saturday
      startDate = addDays(baseDate, 2); // Move to Monday
    } else {
      startDate = subDays(baseDate, currentDay - 1); // Move to Monday of current week
    }
    
    for (let i = 0; i < viewMode; i++) {
      const day = addDays(startDate, i);
      // Only add weekdays (Monday to Friday)
      if (day.getDay() >= 1 && day.getDay() <= 5) {
        days.push(day);
      }
    }
    
    return days.slice(0, viewMode);
  };
  
  const weekDays = getViewDays();

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setCurrentWeek(subDays(currentWeek, 7));
    } else {
      setCurrentWeek(addDays(currentWeek, 7));
    }
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 19; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 19) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  const getActivityForSlot = (inspector, date, timeSlot) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const activities = effectiveActivities.filter(activity => {
      // If inspector is provided, filter by inspector ID (handle number/string coercion)
      if (inspector && Number(activity.owner_id) !== Number(inspector.id)) return false;
      if (activity.due_date !== dateString) return false;
      if (activity.done) return false;
      // Must have a time (not 00:00:00 or empty)
      if (!activity.due_time || activity.due_time === '00:00:00') return false;
      // Skip follow-up tasks
      if (activity.subject && activity.subject.includes('Inspector ENG Follow up')) return false;
      return true;
    });
    
    
    return activities.find(activity => {
      const timeInfo = getPipedriveDateTime(activity.due_time, activity.due_date);
      if (!timeInfo) return false;
      
      const activityTime = timeInfo.time;
      const duration = activity.duration || '01:00:00';
      const activityEndTime = calculateEndTime(activityTime, duration.substring(0, 5));
      return timeSlot >= activityTime && timeSlot < activityEndTime;
    });
  };
  
  // Get all activities for a specific date and time slot across all inspectors
  const getAllActivitiesForSlot = (date, timeSlot) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return effectiveActivities.filter(activity => {
      if (activity.due_date !== dateString) return false;
      if (activity.done) return false;
      if (!activity.due_time || activity.due_time === '00:00:00') return false;
      if (activity.subject && activity.subject.includes('Inspector ENG Follow up')) return false;
      
      const timeInfo = getPipedriveDateTime(activity.due_time, activity.due_date);
      if (!timeInfo) return false;
      
      const activityTime = timeInfo.time;
      const duration = activity.duration || '01:00:00';
      const activityEndTime = calculateEndTime(activityTime, duration.substring(0, 5));
      return timeSlot >= activityTime && timeSlot < activityEndTime;
    });
  };

  const calculateEndTime = (startTime, duration) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [durationHour, durationMin] = duration.split(':').map(Number);
    
    const totalMinutes = (startHour * 60 + startMin) + (durationHour * 60 + durationMin);
    const endHour = Math.floor(totalMinutes / 60);
    const endMin = totalMinutes % 60;
    
    return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
  };

  const isSlotAvailable = (inspector, date, timeSlot) => {
    // Check if it's lunch time (12:00 - 13:00)
    if (timeSlot >= '12:00' && timeSlot < '13:00') {
      return false; // Lunch break - unavailable
    }
    
    const activity = getActivityForSlot(inspector, date, timeSlot);
    return !activity;
  };

  const isLunchBreak = (timeSlot) => {
    return timeSlot >= '12:00' && timeSlot < '13:00';
  };

  const handleSlotClick = (inspector, date, timeSlot) => {
    if (isSlotAvailable(inspector, date, timeSlot)) {
      onSelectTimeSlot({
        inspector,
        date,
        time: timeSlot,
        datetime: new Date(`${format(date, 'yyyy-MM-dd')}T${timeSlot}:00`)
      });
    }
  };

  const handleActivityClick = (activity, event) => {
    event.stopPropagation();
    setSelectedActivity(activity);
    setShowActivityModal(true);
  };

  const closeActivityModal = () => {
    setShowActivityModal(false);
    setSelectedActivity(null);
  };

  // Pipedrive API returns times in correct timezone already
  const getPipedriveDateTime = (timeString, dateString) => {
    if (!timeString || timeString === '00:00:00') return null;
    return {
      date: dateString,
      time: timeString.substring(0, 5) // Just HH:MM format
    };
  };

  const extractSuburb = (address) => {
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[1].trim(); // Get the suburb part
    }
    return address.split(' ').slice(-3, -2).join(' '); // Fallback
  };

  // Extract property address from Pipedrive subject lines
  const extractAddressFromPipedriveSubject = (subject) => {
    if (!subject) return null;
    
    // Look for address pattern after "- " and before " Inspector" or ending with "NSW/QLD/etc"
    const patterns = [
      // Pattern 1: "Name - Address, State" 
      /- ([^-]+(?:NSW|QLD|VIC|SA|WA|TAS|NT|ACT)[^-]*)/i,
      // Pattern 2: "Property Inspection - Ben W - address details"
      /Property Inspection[^-]*-[^-]*- ([^-]+)/i,
      // Pattern 3: After last person name, before "Inspector"
      /- ([^-]+) Inspector/i
    ];
    
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        let address = match[1].trim();
        // Clean up common suffixes
        address = address.replace(/, Australia$|, australia$/i, '');
        address = address.replace(/\s+Inspector ENG Follow up.*$/i, '');
        return address;
      }
    }
    
    return null;
  };

  // Extract suburb from address (works for both mock and Pipedrive)
  const getAddressInfo = (activity) => {
    // Mock data format
    if (activity.location && activity.location.value) {
      const fullAddress = activity.location.value;
      const suburb = extractSuburb(fullAddress);
      return { fullAddress, suburb };
    }
    
    // Pipedrive data format - extract from subject
    const extractedAddress = extractAddressFromPipedriveSubject(activity.subject);
    if (extractedAddress) {
      const suburb = extractSuburb(extractedAddress);
      return { 
        fullAddress: extractedAddress, 
        suburb: suburb || extractedAddress.split(' ').slice(-2).join(' ') // Fallback to last 2 words
      };
    }
    
    return { fullAddress: null, suburb: 'Inspection' };
  };

  const ActivityBlock = ({ activity, timeSlot }) => {
    const activityType = getActivityTypeByKey(activity.type);
    
    // Get inspector info for "All Inspectors" view
    const activityInspector = inspectors.find(inspector => 
      inspector.id === activity.owner_id || inspector.id === activity.creator_user_id
    );
    
    // Get Pipedrive datetime info
    const timeInfo = getPipedriveDateTime(activity.due_time, activity.due_date);
    if (!timeInfo) return null;
    
    const startTime = timeInfo.time;
    // Handle duration - default to 1 hour for Pipedrive activities
    const duration = activity.duration || '01:00:00';
    const endTime = calculateEndTime(startTime, duration.substring(0, 5));
    
    if (timeSlot !== startTime) {
      const isHovered = hoveredAppointment && hoveredAppointment.id === activity.id;
      return <div className={`absolute inset-0 ${isHovered ? 'bg-red-200 border-l-2 border-red-500' : 'bg-blue-200 border-l-2 border-blue-500'} opacity-50 transition-colors`}></div>;
    }

    const durationSlots = Math.ceil(
      (parseInt(duration.split(':')[0]) * 60 + parseInt(duration.split(':')[1])) / 30
    );

    // Get address info (works for both mock and Pipedrive)
    const addressInfo = getAddressInfo(activity);
    const isHovered = hoveredAppointment && hoveredAppointment.id === activity.id;

    return (
      <div 
        className={`absolute inset-0 p-1 text-xs overflow-hidden z-10 transition-colors cursor-pointer ${
          isHovered 
            ? 'bg-red-50 border-l-4 border-red-500 hover:bg-red-100' 
            : 'bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100'
        }`}
        style={{ height: `${durationSlots * 100}%` }}
        onClick={(e) => handleActivityClick(activity, e)}
        onMouseEnter={() => onAppointmentHover?.(activity)}
        onMouseLeave={() => onAppointmentLeave?.()}
        title="Click to view appointment details"
      >
        <div className={`font-semibold text-sm leading-tight mb-1 ${isHovered ? 'text-red-900' : 'text-blue-900'}`}>
          {addressInfo.suburb}
        </div>
        <div className={`text-xs leading-tight mb-1 ${isHovered ? 'text-red-700' : 'text-blue-700'}`}>
          {activityType?.name || 'Inspection'}
        </div>
        {/* Show inspector name in "All Inspectors" view */}
        {isAllInspectors && activityInspector && (
          <div className={`text-xs leading-tight mb-1 font-medium ${isHovered ? 'text-red-800' : 'text-blue-800'}`}>
            👤 {activityInspector.name.split(' ')[0]} {/* First name only */}
          </div>
        )}
        {/* Show property address if available */}
        {addressInfo.fullAddress && (
          <div className={`text-xs leading-tight mb-1 ${isHovered ? 'text-red-600' : 'text-blue-600'}`}>
            <MapPin className="w-2.5 h-2.5 inline mr-1" />
            <span className="truncate">{addressInfo.fullAddress}</span>
          </div>
        )}
        <div className={`text-xs leading-tight flex items-center gap-1 ${isHovered ? 'text-red-600' : 'text-blue-600'}`}>
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span>{startTime}</span>
        </div>
      </div>
    );
  };

  const ActivityModal = ({ activity, isOpen, onClose }) => {
    if (!activity || !isOpen) return null;

    const activityType = getActivityTypeByKey(activity.type);
    const startTime = activity.due_time.substring(0, 5);
    const endTime = calculateEndTime(startTime, activity.duration.substring(0, 5));
    const client = activity.attendees?.[0];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div 
          className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="space-y-4">
          {/* Header */}
          <div className="border-b border-gray-200 pb-2">
            <h4 className="font-semibold text-gray-900 leading-tight">
              {activity.subject}
            </h4>
            <div className="flex items-center gap-2 text-sm text-blue-600 mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>{activityType?.name || 'Inspection'}</span>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-700">
              {startTime} - {endTime} ({activity.duration.substring(0, 5)})
            </span>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">
                {extractSuburb(activity.location.value)}
              </div>
              <div className="text-gray-600 text-xs leading-relaxed">
                {activity.location.value}
              </div>
            </div>
          </div>

          {/* Property Type & Fee */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{activity.property_type}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="w-3 h-3" />
              <span>{activity.inspection_fee}</span>
            </div>
          </div>

          {/* Client */}
          {client && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-gray-900">{client.name}</span>
                {activity.client_contact && (
                  <div className="text-gray-600 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {activity.client_contact}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {activity.special_instructions && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <div className="font-medium text-amber-800 mb-1">Special Instructions:</div>
              <div className="text-amber-700">{activity.special_instructions}</div>
            </div>
          )}

          {/* Notes */}
          {activity.note && (
            <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
              <div className="font-medium text-gray-700 mb-1">Notes:</div>
              <div className="text-gray-600">{activity.note}</div>
            </div>
          )}
          </div>
        </div>
      </div>
    );
  };

  // Get current inspector or handle "all inspectors" view
  const isAllInspectors = selectedInspector === 'all';
  const currentInspector = isAllInspectors 
    ? null // No single inspector for "all" view
    : selectedInspector 
      ? inspectors.find(inspector => inspector.id === selectedInspector)
      : inspectors[0];
  
  // For "all inspectors" view, get all inspectors that have activities
  const visibleInspectors = isAllInspectors ? inspectors : (currentInspector ? [currentInspector] : []);
    

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Only show time indicator during work hours (8:00-18:00)
    if (hours < 8 || hours >= 18) return null;
    
    // Calculate position based on time slots (8:00 = 0%, 18:00 = 100%)
    const totalMinutes = (hours - 8) * 60 + minutes;
    const totalWorkMinutes = 10 * 60; // 10 hours (8:00-18:00)
    const percentage = (totalMinutes / totalWorkMinutes) * 100;
    
    return Math.min(100, Math.max(0, percentage));
  };

  const timePosition = getCurrentTimePosition();

  const containerClass = fullScreen 
    ? "h-screen flex flex-col bg-white" 
    : "bg-white rounded-lg shadow-lg";

  const contentClass = fullScreen
    ? "flex-1 flex flex-col min-h-0"
    : "p-6";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`${fullScreen ? 'p-6 pb-4' : ''} border-b border-gray-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Inspector Calendar
              {isAllInspectors && (
                <span className="ml-3 text-base font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                  🌐 All Inspectors View
                </span>
              )}
            </h2>
            {/* Inspector Dropdown */}
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-500" />
              <select
                value={selectedInspector || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    onInspectorChange?.('all');
                  } else if (value) {
                    onInspectorChange?.(parseInt(value));
                  } else {
                    onInspectorChange?.(null);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Inspectors</option>
                {inspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name} - {inspector.regionName || inspector.region}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Day View Buttons */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[1, 3, 5].map(days => (
                <button
                  key={days}
                  onClick={() => setViewMode(days)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === days
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-medium text-lg min-w-48 text-center">
              {weekDays.length > 0 && (
                `${format(weekDays[0], 'MMM d')} - ${format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}`
              )}
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

      <div className={contentClass}>
        <div className={`${fullScreen ? 'flex-1 min-h-0' : ''} overflow-auto`}>
          <div className="min-w-full">
            {/* Header Row */}
            <div className={`grid gap-px bg-gray-200 rounded-t-lg overflow-hidden ${
              viewMode === 1 ? 'grid-cols-1' : 
              viewMode === 3 ? 'grid-cols-3' : 'grid-cols-5'
            }`}>
              {weekDays.map(day => {
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`p-3 text-center cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => onDateChange?.(day)}
                  >
                    <div className="font-semibold">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-sm ${
                      isSelected ? 'text-blue-100' : 'text-gray-600'
                    }`}>
                      {format(day, 'MMM d')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Grid */}
            <div className="bg-gray-200 rounded-b-lg overflow-hidden">
              {(currentInspector || isAllInspectors) && (
                <div className="bg-white relative">
                  <div className={`grid gap-px bg-gray-200 ${
                    viewMode === 1 ? 'grid-cols-1' : 
                    viewMode === 3 ? 'grid-cols-3' : 'grid-cols-5'
                  }`}>

                    {/* Day Columns */}
                    {weekDays.map(day => {
                      const isToday = isSameDay(day, new Date());
                      
                      
                      return (
                        <div key={day.toISOString()} className="bg-white relative">
                          {/* Current Time Indicator */}
                          {isToday && timePosition !== null && (
                            <div 
                              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 shadow-lg"
                              style={{ top: `${timePosition}%` }}
                            >
                              <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                              <div className="absolute -right-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                          )}
                          <div className="min-h-96">
                            {timeSlots.map((timeSlot, slotIndex) => {
                              // Get activity for this slot - handle both single and all inspector views
                              const activity = isAllInspectors 
                                ? getAllActivitiesForSlot(day, timeSlot)[0] // Get first activity if multiple
                                : getActivityForSlot(currentInspector, day, timeSlot);
                              
                              const allActivities = isAllInspectors ? getAllActivitiesForSlot(day, timeSlot) : [];
                              const isAvailable = isAllInspectors 
                                ? allActivities.length === 0 && !isLunchBreak(timeSlot)
                                : isSlotAvailable(currentInspector, day, timeSlot) && !activity;
                              const isPast = day < new Date() && !isSameDay(day, new Date());
                              const isLunch = isLunchBreak(timeSlot);

                              return (
                                <div
                                  key={timeSlot}
                                  className={`h-8 border-b border-gray-100 relative cursor-pointer transition-all ${
                                    isPast 
                                      ? 'bg-gray-50' 
                                      : isLunch
                                        ? 'bg-orange-50 border-orange-200'
                                        : isAvailable 
                                          ? 'hover:bg-green-50 hover:border-green-200' 
                                          : ''
                                  } ${
                                    isToday ? 'border-l-2 border-l-blue-400' : ''
                                  } ${
                                    slotIndex % 2 === 0 ? 'border-r border-gray-200' : ''
                                  }`}
                                  onClick={() => !isPast && !isAllInspectors && handleSlotClick(currentInspector, day, timeSlot)}
                                  title={
                                    isPast 
                                      ? 'Past time slot'
                                      : isLunch
                                        ? 'Lunch Break (12:00-13:00)'
                                        : isAllInspectors && allActivities.length > 1
                                          ? `${allActivities.length} activities at ${timeSlot}`
                                        : isAvailable 
                                          ? `Available - Click to book at ${timeSlot}` 
                                          : activity?.subject
                                  }
                                >
                                  {activity && <ActivityBlock activity={activity} timeSlot={timeSlot} />}
                                  {!activity && !isPast && !isLunch && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                                      <div className="bg-green-500 text-white text-xs px-2 py-0.5 rounded font-medium">
                                        {timeSlot}
                                      </div>
                                    </div>
                                  )}
                                  {isLunch && !activity && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-orange-600 text-xs font-medium">
                                        🍽️
                                      </div>
                                    </div>
                                  )}
                                  {slotIndex % 2 === 0 && (
                                    <div className="absolute left-0 top-0 text-xs text-gray-400 px-1 leading-tight">
                                      {timeSlot}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className={`${fullScreen ? 'p-6 pt-4' : 'mt-6'} flex items-center justify-center gap-6 text-sm border-t border-gray-200`}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border-l-4 border-blue-500 rounded-sm"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded-sm"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded-sm flex items-center justify-center">
              <span className="text-xs">🍽️</span>
            </div>
            <span>Lunch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-300 rounded-sm"></div>
            <span>Past</span>
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      <ActivityModal 
        activity={selectedActivity} 
        isOpen={showActivityModal} 
        onClose={closeActivityModal} 
      />
    </div>
  );
};

export default InspectorCalendar;