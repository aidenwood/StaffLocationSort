import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, MapPin, User } from 'lucide-react';
import { 
  inspectors, 
  getActivitiesByInspectorAndDate, 
  getActivityTypeByKey,
  getInspectorById 
} from '../data/mockActivities';

const CalendarViewer = ({ onSelectTimeSlot, selectedInspector }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setCurrentWeek(subDays(currentWeek, 7));
    } else {
      setCurrentWeek(addDays(currentWeek, 7));
    }
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 17; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 17) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  const getActivityForSlot = (inspector, date, timeSlot) => {
    const activities = getActivitiesByInspectorAndDate(inspector.id, date);
    return activities.find(activity => {
      const activityTime = activity.due_time.substring(0, 5); // Convert HH:MM:SS to HH:MM
      const activityEndTime = calculateEndTime(activityTime, activity.duration.substring(0, 5));
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
    return !getActivityForSlot(inspector, date, timeSlot);
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

  const ActivityBlock = ({ activity, timeSlot }) => {
    const activityType = getActivityTypeByKey(activity.type);
    const startTime = activity.due_time.substring(0, 5); // Convert HH:MM:SS to HH:MM
    const endTime = calculateEndTime(startTime, activity.duration.substring(0, 5));
    
    // Only show activity details on the starting time slot
    if (timeSlot !== startTime) {
      return <div className="absolute inset-0 bg-blue-200 opacity-50 border-l-2 border-blue-500"></div>;
    }

    const durationSlots = Math.ceil(
      (parseInt(activity.duration.split(':')[0]) * 60 + parseInt(activity.duration.split(':')[1])) / 30
    );

    return (
      <div 
        className={`absolute inset-0 bg-blue-100 border-l-4 border-blue-500 p-1 text-xs overflow-hidden z-10`}
        style={{ height: `${durationSlots * 100}%` }}
      >
        <div className="font-medium text-blue-800 truncate">
          {activity.subject.split(' - ')[0]}
        </div>
        <div className="text-blue-600 truncate flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {startTime} - {endTime}
        </div>
        <div className="text-blue-600 truncate flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {activity.location.value.split(',')[0]}
        </div>
        {activity.property_type && (
          <div className="text-blue-500 text-xs truncate">
            {activity.property_type}
          </div>
        )}
      </div>
    );
  };

  const filteredInspectors = selectedInspector 
    ? inspectors.filter(inspector => inspector.id === selectedInspector)
    : inspectors;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Inspector Calendar</h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-lg">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <button 
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header Row */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="p-2 font-medium text-gray-600">Inspector</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-2 text-center">
                <div className="font-medium text-gray-900">
                  {format(day, 'EEE')}
                </div>
                <div className="text-sm text-gray-500">
                  {format(day, 'MMM d')}
                </div>
              </div>
            ))}
          </div>

          {/* Inspector Rows */}
          {filteredInspectors.map(inspector => (
            <div key={inspector.id} className="mb-6 border rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-3 border-b">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">{inspector.name}</span>
                  <span className="text-sm text-gray-500">{inspector.email}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-8 gap-1">
                {/* Time Column */}
                <div className="bg-gray-50">
                  {timeSlots.map(timeSlot => (
                    <div key={timeSlot} className="h-12 p-2 text-xs text-gray-600 border-b border-gray-200">
                      {timeSlot}
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="border-l border-gray-200">
                    {timeSlots.map(timeSlot => {
                      const activity = getActivityForSlot(inspector, day, timeSlot);
                      const isAvailable = !activity;
                      const isToday = isSameDay(day, new Date());
                      const isPast = day < new Date() && !isSameDay(day, new Date());

                      return (
                        <div
                          key={timeSlot}
                          className={`h-12 border-b border-gray-200 relative cursor-pointer transition-colors ${
                            isPast 
                              ? 'bg-gray-100' 
                              : isAvailable 
                                ? 'hover:bg-green-50 hover:border-green-200' 
                                : ''
                          } ${
                            isToday ? 'border-l-2 border-l-blue-400' : ''
                          }`}
                          onClick={() => !isPast && handleSlotClick(inspector, day, timeSlot)}
                          title={
                            isPast 
                              ? 'Past time slot' 
                              : isAvailable 
                                ? `Available - Click to book at ${timeSlot}` 
                                : activity?.subject
                          }
                        >
                          {activity && <ActivityBlock activity={activity} timeSlot={timeSlot} />}
                          {!activity && !isPast && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                              <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                                Available
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500 rounded-sm"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded-sm"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm"></div>
          <span>Past</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarViewer;