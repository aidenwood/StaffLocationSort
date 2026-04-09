import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

const ResizableSplitter = ({ 
  children, 
  defaultSplitPercentage = 50, 
  minPaneSize = 200, 
  maxPaneSize = 80, // as percentage
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  disabled = false,
  onResize = null,
  className = ""
}) => {
  const [splitPercentage, setSplitPercentage] = useState(defaultSplitPercentage);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const startPosRef = useRef(null);
  const startSizeRef = useRef(null);

  // Handle mouse/touch start
  const handleStart = useCallback((clientX, clientY) => {
    if (disabled) return;
    
    setIsDragging(true);
    startPosRef.current = orientation === 'horizontal' ? clientX : clientY;
    startSizeRef.current = splitPercentage;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
  }, [disabled, orientation, splitPercentage]);

  // Handle mouse/touch move
  const handleMove = useCallback((clientX, clientY) => {
    if (!isDragging || !containerRef.current || !startPosRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const currentPos = orientation === 'horizontal' ? clientX : clientY;
    const containerSize = orientation === 'horizontal' ? rect.width : rect.height;
    
    const deltaPos = currentPos - startPosRef.current;
    const deltaPercentage = (deltaPos / containerSize) * 100;
    
    let newSplitPercentage = startSizeRef.current + deltaPercentage;
    
    // Apply constraints
    const minPercentage = (minPaneSize / containerSize) * 100;
    const maxPercentage = Math.min(maxPaneSize, 100 - minPercentage);
    
    newSplitPercentage = Math.max(minPercentage, Math.min(maxPercentage, newSplitPercentage));
    
    setSplitPercentage(newSplitPercentage);
    
    // Call onResize callback if provided
    if (onResize) {
      onResize(newSplitPercentage);
    }
  }, [isDragging, orientation, minPaneSize, maxPaneSize, onResize]);

  // Handle mouse/touch end
  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    startPosRef.current = null;
    startSizeRef.current = null;
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [isDragging]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  // Touch event handlers
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove]);

  // Set up global event listeners during drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleEnd, handleTouchMove]);

  // Save split percentage to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('staffLocationSort.splitPercentage', splitPercentage.toString());
    }
  }, [splitPercentage]);

  // Load split percentage from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staffLocationSort.splitPercentage');
      if (saved) {
        const savedPercentage = parseFloat(saved);
        if (!isNaN(savedPercentage) && savedPercentage >= 10 && savedPercentage <= 90) {
          setSplitPercentage(savedPercentage);
        }
      }
    }
  }, []);

  const [firstChild, secondChild] = React.Children.toArray(children);

  const containerClasses = orientation === 'horizontal' 
    ? 'flex flex-row h-full w-full'
    : 'flex flex-col h-full w-full';

  const splitterClasses = orientation === 'horizontal'
    ? `flex-shrink-0 w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex items-center justify-center group transition-all duration-150 ${isDragging ? 'bg-blue-400 w-2' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`
    : `flex-shrink-0 h-1 bg-gray-200 hover:bg-gray-300 cursor-row-resize flex items-center justify-center group transition-all duration-150 ${isDragging ? 'bg-blue-400 h-2' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`;

  const firstPaneStyle = orientation === 'horizontal'
    ? { width: `${splitPercentage}%` }
    : { height: `${splitPercentage}%` };

  const secondPaneStyle = orientation === 'horizontal'
    ? { width: `${100 - splitPercentage}%` }
    : { height: `${100 - splitPercentage}%` };

  return (
    <div ref={containerRef} className={`${containerClasses} ${className}`}>
      {/* First Pane */}
      <div 
        style={firstPaneStyle} 
        className="flex-shrink-0 overflow-hidden"
      >
        {firstChild}
      </div>
      
      {/* Splitter */}
      <div
        className={splitterClasses}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title={disabled ? 'Splitter disabled' : 'Drag to resize'}
      >
        <GripVertical 
          className={`transition-all duration-150 ${
            orientation === 'horizontal' 
              ? 'w-3 h-6 rotate-0' 
              : 'w-6 h-3 rotate-90'
          } ${
            isDragging 
              ? 'text-blue-600' 
              : 'text-gray-400 group-hover:text-gray-600'
          } ${disabled ? 'opacity-30' : ''}`} 
        />
      </div>
      
      {/* Second Pane */}
      <div 
        style={secondPaneStyle} 
        className="flex-1 min-w-0 min-h-0 overflow-hidden"
      >
        {secondChild}
      </div>
    </div>
  );
};

export default ResizableSplitter;