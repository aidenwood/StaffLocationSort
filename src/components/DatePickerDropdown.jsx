import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';

const DatePickerDropdown = ({ selectedDate, onDateChange, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update viewDate when selectedDate changes
  useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  const handleDateSelect = (date) => {
    onDateChange(date);
    setIsOpen(false);
  };

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const days = generateCalendarDays();
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={`relative ${className}`}>
      {/* Date Display Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs md:text-xs text-gray-700 hover:text-gray-900 transition-colors focus:outline-none"
      >
        <span className="font-medium text-[10px] md:text-xs">
          {format(selectedDate, 'EEE, MMM d')}
        </span>
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50 p-4"
          style={{ minWidth: '280px' }}
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1 text-gray-400 hover:text-white transition-colors rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="text-white font-medium text-sm">
              {format(viewDate, 'MMMM yyyy')}
            </div>
            
            <button
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1 text-gray-400 hover:text-white transition-colors rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayLabels.map((label) => (
              <div
                key={label}
                className="text-center text-xs text-gray-500 font-medium py-2"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  className={`
                    w-8 h-8 text-sm rounded transition-colors
                    ${!isCurrentMonth 
                      ? 'text-gray-600 hover:text-gray-400' 
                      : isSelected
                        ? 'bg-blue-600 text-white'
                        : isTodayDate
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerDropdown;