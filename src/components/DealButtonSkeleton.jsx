import React from 'react';

const DealButtonSkeleton = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
         style={{ height: '128px', width: '100%', top: 0, zIndex: 20 }}>
      <div className="animate-pulse flex items-center gap-1 px-3 py-2 
                      bg-purple-100 rounded-full">
        {/* Target icon skeleton */}
        <div className="w-4 h-4 bg-purple-200 rounded-full" />
        {/* Count skeleton */}
        <div className="w-6 h-4 bg-purple-200 rounded" />
        {/* Text skeleton */}
        <div className="w-16 h-3 bg-purple-200 rounded" />
      </div>
    </div>
  );
};

export default DealButtonSkeleton;