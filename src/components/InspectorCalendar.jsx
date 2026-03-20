import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Phone, Home, DollarSign, X, Target, ExternalLink } from 'lucide-react';
import { getActivityTypeByKey } from '../data/mockActivities';
import { convertToAustralianTime } from '../utils/timezone';

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
  error = null,
  hideNavigation = false,
  enableOpportunities = false,
  onShowDealsDebugConsole = null,
  timeSlotDealCounts = {}
}) => {
  const [currentWeek, setCurrentWeek] = useState(selectedDate || new Date());
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState(5); // 1, 3, or 5 days
  const [showOpportunities, setShowOpportunities] = useState(false);

  // Only use real Pipedrive data - no mock fallbacks
  const effectiveActivities = activities || [];
  const effectiveInspectors = inspectors || [];
  
  // Get current inspector or handle "all inspectors" view
  const isAllInspectors = selectedInspector === 'all';
  const displayInspector = isAllInspectors 
    ? null // No single inspector for "all" view
    : selectedInspector 
      ? inspectors.find(inspector => inspector.id === selectedInspector)
      : inspectors[0];
  
  // For "all inspectors" view, get all inspectors that have activities
  const visibleInspectors = isAllInspectors ? inspectors : (displayInspector ? [displayInspector] : []);

  // Debug: log activity structure when activities change (reduced logging)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const benActivities = effectiveActivities.filter(a => a.owner_id === 2 || a.owner_id === '2');
      if (benActivities.length > 0) {
        console.log('📅 CALENDAR: Ben W activities found:', benActivities.length);
      }
    }
  }, [effectiveActivities, selectedInspector]);

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
    const newDate = direction === 'prev' ? subDays(currentWeek, 7) : addDays(currentWeek, 7);
    setCurrentWeek(newDate);
    onDateChange?.(newDate);
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

  // Get Pipedrive datetime with corrected Australian timezone
  const getPipedriveDateTime = (timeString, dateString) => {
    if (!timeString || timeString === '00:00:00') return null;
    
    const converted = convertToAustralianTime(timeString, 'QLD');
    
    return {
      date: dateString,
      time: converted.time // 24-hour format for calendar use
    };
  };

  const extractSuburb = (address) => {
    if (!address || typeof address !== 'string') {
      return 'Unknown Location';
    }
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[1].trim(); // Get the suburb part
    }
    return address.split(' ').slice(-3, -2).join(' ') || 'Unknown Location'; // Fallback
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
    // Use enriched person address or fallback to activity location
    const address = activity.personAddress || activity.location?.value || activity.location;
    if (address && typeof address === 'string') {
      const fullAddress = address;
      const suburb = extractSuburb(fullAddress);
      return { fullAddress, suburb };
    }
    
    // Pipedrive data format - extract from subject
    const extractedAddress = extractAddressFromPipedriveSubject(activity.subject);
    if (extractedAddress && typeof extractedAddress === 'string') {
      const suburb = extractSuburb(extractedAddress);
      return { 
        fullAddress: extractedAddress, 
        suburb: suburb
      };
    }
    
    return { fullAddress: null, suburb: 'Loading address...' };
  };

  const ActivityBlock = ({ activity, timeSlot }) => {
    const activityType = getActivityTypeByKey(activity.type);
    
    // Get inspector info for "All Inspectors" view
    const activityInspector = inspectors.find(inspector => 
      inspector.id === activity.owner_id || inspector.id === activity.creator_user_id
    );
    
    // Get Pipedrive datetime info with timezone conversion
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
        className={`absolute inset-0 p-1 text-xs overflow-hidden z-0 transition-colors cursor-pointer ${
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
        <div className={`font-medium leading-tight ${isHovered ? 'text-red-900' : 'text-blue-900'}`} style={{ fontSize: '9px' }}>
          {addressInfo.fullAddress || addressInfo.suburb}
        </div>
        {isAllInspectors && activityInspector && (
          <div className={`leading-none font-medium ${isHovered ? 'text-red-800' : 'text-blue-800'}`} style={{ fontSize: '8px' }}>
            {activityInspector.name.split(' ')[0]}
          </div>
        )}
        <div className={`leading-none flex items-center gap-0.5 ${isHovered ? 'text-red-600' : 'text-blue-600'}`} style={{ fontSize: '10px' }}>
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span>{startTime}</span>
        </div>
      </div>
    );
  };

  const ActivityModal = ({ activity, isOpen, onClose }) => {
    if (!activity || !isOpen) return null;

    const activityType = getActivityTypeByKey(activity.type);
    const startTime = (activity.due_time || '09:00:00').substring(0, 5);
    const duration = activity.duration || '01:00:00';
    const endTime = calculateEndTime(startTime, duration.substring(0, 5));
    const addressInfo = getAddressInfo(activity);

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
              {startTime} - {endTime} ({duration.substring(0, 5)})
            </span>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">
                {addressInfo.suburb}
              </div>
              {addressInfo.fullAddress && (
                <div className="text-gray-600 text-xs leading-relaxed">
                  {addressInfo.fullAddress}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {activity.note && (
            <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
              <div className="font-medium text-gray-700 mb-1">Notes:</div>
              <div className="text-gray-600">{activity.note}</div>
            </div>
          )}

          {/* Open in Pipedrive */}
          {activity.id && (
            <div className="pt-2 border-t border-gray-200">
              <a
                href={`https://rebuildrelief.pipedrive.com/activity/${activity.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Pipedrive</span>
              </a>
            </div>
          )}
          </div>
        </div>
      </div>
    );
  };


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
    ? "h-full flex flex-col bg-white"
    : "bg-white rounded-lg shadow-lg";

  const contentClass = fullScreen
    ? "flex-1 flex flex-col min-h-0"
    : "p-4";

  return (
    <div className={containerClass}>
      {/* Header - Compact */}
      {!hideNavigation && (
        <div className={`${fullScreen ? 'px-4 py-2' : ''} border-b border-gray-200`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Inspector Dropdown */}
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
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Inspectors</option>
                {inspectors.map(inspector => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name} - {inspector.regionName || inspector.region}
                  </option>
                ))}
              </select>

              {/* Day View Buttons */}
              <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
                {[1, 3, 5].map(days => (
                  <button
                    key={days}
                    onClick={() => setViewMode(days)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
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

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-sm min-w-36 text-center">
                {weekDays.length > 0 && (
                  `${format(weekDays[0], 'MMM d')} - ${format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}`
                )}
              </span>
              <button
                onClick={() => navigateWeek('next')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Time Slot Opportunities Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOpportunities(!showOpportunities)}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  showOpportunities 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Target className="w-3 h-3" />
                Opportunities
              </button>
              {showOpportunities && (
                <span className="text-xs text-green-600 font-medium">
                  Deals Debug Console for full view
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={contentClass}>
        <div className={`${fullScreen ? 'flex-1 min-h-0' : ''} overflow-auto`}>
          <div className="min-w-full">
            {/* Header Row - Sticky */}
            <div className={`sticky top-0 z-10 grid gap-px bg-gray-200 rounded-t-lg overflow-hidden ${
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
              {(displayInspector || isAllInspectors) && (
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
                                : getActivityForSlot(displayInspector, day, timeSlot);
                              
                              const allActivities = isAllInspectors ? getAllActivitiesForSlot(day, timeSlot) : [];
                              const isAvailable = isAllInspectors 
                                ? allActivities.length === 0 && !isLunchBreak(timeSlot)
                                : isSlotAvailable(displayInspector, day, timeSlot) && !activity;
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
                                  onClick={() => !isPast && !isAllInspectors && handleSlotClick(displayInspector, day, timeSlot)}
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
                                    <>
                                      {enableOpportunities && ['09:00', '11:00', '13:00', '15:00'].includes(timeSlot) && onShowDealsDebugConsole ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          {(() => {
                                            const dayKey = `${format(day, 'yyyy-MM-dd')}-${timeSlot}`;
                                            const counts = timeSlotDealCounts[dayKey];
                                            const within1km = counts?.within1km || 0;
                                            const within2_5km = counts?.within2_5km || 0;
                                            const within5km = counts?.within5km || 0;
                                            const within10km = counts?.within10km || 0;
                                            const within15km = counts?.within15km || 0;
                                            const within30km = counts?.within30km || 0;
                                            const radiusText = counts?.radiusText || '';
                                            
                                            // Determine display count, color, and radius (purple gradient system)
                                            let displayCount = 0;
                                            let colorClass = "bg-purple-600 hover:bg-purple-700"; // Bright purple for 1km
                                            let selectedRadius = null;
                                            
                                            if (within1km > 0) {
                                              displayCount = within1km;
                                              colorClass = "bg-purple-600 hover:bg-purple-700 text-white shadow-md"; // Bright purple for 1km
                                              selectedRadius = 1;
                                            } else if (within2_5km > 0) {
                                              displayCount = within2_5km;
                                              colorClass = "bg-purple-500 hover:bg-purple-600 text-white"; // Medium purple for 2.5km
                                              selectedRadius = 2.5;
                                            } else if (within5km > 0) {
                                              displayCount = within5km;
                                              colorClass = "bg-purple-400 hover:bg-purple-500 text-white"; // Light purple for 5km
                                              selectedRadius = 5;
                                            } else if (within10km > 0) {
                                              displayCount = within10km;
                                              colorClass = "bg-purple-300 hover:bg-purple-400 text-purple-900"; // Very light purple for 10km
                                              selectedRadius = 10;
                                            } else if (within15km > 0) {
                                              displayCount = within15km;
                                              colorClass = "bg-purple-200 hover:bg-purple-300 text-purple-800"; // Subtle purple for 15km
                                              selectedRadius = 15;
                                            } else if (within30km > 0) {
                                              displayCount = within30km;
                                              colorClass = "bg-purple-100 hover:bg-purple-200 text-purple-700"; // Barely purple for 30km
                                              selectedRadius = 30;
                                            }
                                            
                                            // Only show button if there are deals or if we haven't calculated yet
                                            const hasDeals = displayCount > 0;
                                            const hasData = counts !== undefined;
                                            
                                            if (!hasData || hasDeals) {
                                              return (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onShowDealsDebugConsole(day, timeSlot, selectedRadius);
                                                  }}
                                                  className={`${colorClass} text-xs px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 shadow-sm`}
                                                >
                                                  <Target className="w-3 h-3" />
                                                  {displayCount > 0 ? `${displayCount} Deal${displayCount === 1 ? '' : 's'}${radiusText ? ` (${radiusText})` : ''}` : 'Deals'}
                                                </button>
                                              );
                                            }
                                            
                                            // Don't show button if no deals found
                                            return null;
                                          })()}
                                        </div>
                                      ) : (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                                          <div className="bg-green-500 text-white text-xs px-2 py-0.5 rounded font-medium">
                                            {timeSlot}
                                          </div>
                                        </div>
                                      )}
                                    </>
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
        <div className={`${fullScreen ? 'px-4 py-2' : 'mt-4'} flex items-center justify-center gap-4 text-xs border-t border-gray-200`}>
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