import React from 'react';

const CalendarCellSkeleton = ({ isWorkHour }) => {
  if (!isWorkHour) return null;
  
  return (
    <div className="p-2 animate-pulse">
      {/* Shimmer effect for inspection slot */}
      <div className="h-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 
                      rounded-md mb-1 bg-size-200 animate-shimmer" />
      {/* Optional: second shimmer for stacked inspections */}
      <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 
                      rounded-md opacity-50 bg-size-200 animate-shimmer" />
    </div>
  );
};

export default CalendarCellSkeleton;