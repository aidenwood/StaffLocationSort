import React from 'react';
import { 
  Calendar, 
  Columns2, 
  Map, 
  Grid3x3, 
  ChevronLeft, 
  ChevronRight, 
  Target 
} from 'lucide-react';
import DatePickerDropdown from './DatePickerDropdown';

const HeaderControls = ({
  selectedInspector,
  setSelectedInspector,
  selectedDate,
  onDateChange,
  pipedriveInspectors,
  mobileViewMode,
  setMobileViewMode,
  isLiveData,
  showOpportunities,
  setShowOpportunities,
  opportunitiesLoading,
  getPreviousDay,
  getNextDay
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2">
      {/* Desktop Layout - Single Row */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        {/* Left: Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-sm font-medium text-gray-900">
            Inspector Dashboard
          </h1>
          <div className="w-px h-4 bg-gray-300"></div>
          <span className="text-xs text-gray-500">
            Pipedrive Activities
          </span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* Inspector Selector */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5">
            <select
              value={selectedInspector || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setSelectedInspector('all');
                } else if (value) {
                  setSelectedInspector(parseInt(value));
                } else {
                  setSelectedInspector(null);
                }
              }}
              className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer min-w-0"
            >
              <option value="">All Inspectors</option>
              {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                <option key={inspector.id} value={inspector.id}>
                  {inspector.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Control */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onDateChange(getPreviousDay(selectedDate))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            
            <DatePickerDropdown
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              className="px-1"
            />
            
            <button
              onClick={() => onDateChange(getNextDay(selectedDate))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* View Mode Controls */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setMobileViewMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'split'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Split View"
            >
              <Columns2 className="w-3 h-3" />
              <span className="text-xs">Split</span>
            </button>
            <button
              onClick={() => setMobileViewMode('calendar')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Calendar Only"
            >
              <Calendar className="w-3 h-3" />
              <span className="text-xs">Calendar</span>
            </button>
            <button
              onClick={() => setMobileViewMode('map')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Map Only"
            >
              <Map className="w-3 h-3" />
              <span className="text-xs">Map</span>
            </button>
            
            {/* Availability Grid Button */}
            <button
              onClick={() => {
                window.location.hash = '#grid';
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              title="Availability Grid View"
            >
              <Grid3x3 className="w-3 h-3" />
              <span className="text-xs">Grid</span>
            </button>
          </div>
        </div>

        {/* Right: Status & Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Opportunities Toggle */}
          <button
            onClick={() => setShowOpportunities(!showOpportunities)}
            disabled={opportunitiesLoading}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              opportunitiesLoading
                ? 'bg-blue-100 text-blue-700'
                : showOpportunities 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opportunitiesLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <Target className="w-3 h-3" />
                Opportunities
              </>
            )}
          </button>
          
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              isLiveData ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-xs text-gray-500">
              {isLiveData ? 'Live' : 'Mock'}
            </span>
          </div>
        </div>
      </div>

      {/* Tablet Layout - Two Rows */}
      <div className="hidden md:block lg:hidden">
        {/* First Row - Title and Status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-gray-900">Inspector Dashboard</h1>
            <div className="w-px h-4 bg-gray-300"></div>
            <span className="text-xs text-gray-500">Pipedrive Activities</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              isLiveData ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-xs text-gray-500">
              {isLiveData ? 'Live' : 'Mock'}
            </span>
          </div>
        </div>

        {/* Second Row - Controls (same as desktop but different spacing) */}
        <div className="flex items-center justify-center gap-3">
          {/* Inspector Selector */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5">
            <select
              value={selectedInspector || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setSelectedInspector('all');
                } else if (value) {
                  setSelectedInspector(parseInt(value));
                } else {
                  setSelectedInspector(null);
                }
              }}
              className="bg-transparent text-xs font-medium text-gray-700 px-2 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="">All Inspectors</option>
              {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                <option key={inspector.id} value={inspector.id}>
                  {inspector.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Control */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onDateChange(getPreviousDay(selectedDate))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            
            <DatePickerDropdown
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              className="px-1"
            />
            
            <button
              onClick={() => onDateChange(getNextDay(selectedDate))}
              className="flex items-center px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* View Mode Controls */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setMobileViewMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'split'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Split View"
            >
              <Columns2 className="w-3 h-3" />
              <span className="text-xs">Split</span>
            </button>
            <button
              onClick={() => setMobileViewMode('calendar')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Calendar Only"
            >
              <Calendar className="w-3 h-3" />
              <span className="text-xs">Cal</span>
            </button>
            <button
              onClick={() => setMobileViewMode('map')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Map Only"
            >
              <Map className="w-3 h-3" />
              <span className="text-xs">Map</span>
            </button>
            
            {/* Grid Button */}
            <button
              onClick={() => {
                window.location.hash = '#grid';
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              title="Availability Grid View"
            >
              <Grid3x3 className="w-3 h-3" />
              <span className="text-xs">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Single Row */}
      <div className="block md:hidden">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Title and Status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <h1 className="text-sm font-medium text-gray-900">Dashboard</h1>
            <div className={`w-2 h-2 rounded-full ${
              isLiveData ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
          </div>

          {/* Center: Compact Inspector Selector */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 min-w-0 flex-1 max-w-[120px]">
            <select
              value={selectedInspector || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setSelectedInspector('all');
                } else if (value) {
                  setSelectedInspector(parseInt(value));
                } else {
                  setSelectedInspector(null);
                }
              }}
              className="bg-transparent text-[10px] font-medium text-gray-700 px-1 py-1 rounded border-0 focus:outline-none focus:ring-0 cursor-pointer w-full truncate"
            >
              <option value="">All Inspectors</option>
              {pipedriveInspectors && pipedriveInspectors.map(inspector => (
                <option key={inspector.id} value={inspector.id}>
                  {inspector.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Center Right: Date Control */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onDateChange(getPreviousDay(selectedDate))}
              className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            
            <DatePickerDropdown
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              className=""
            />
            
            <button
              onClick={() => onDateChange(getNextDay(selectedDate))}
              className="flex items-center p-1 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* Right: Compact View Controls */}
          <div className="flex items-center bg-gray-50 rounded-md p-0.5 gap-0.5 flex-shrink-0">
            <button
              onClick={() => setMobileViewMode('split')}
              className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'split'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Split View"
            >
              <Columns2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMobileViewMode('calendar')}
              className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Calendar Only"
            >
              <Calendar className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMobileViewMode('map')}
              className={`flex items-center p-1 rounded text-xs font-medium transition-colors ${
                mobileViewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Map Only"
            >
              <Map className="w-3 h-3" />
            </button>
            
            {/* Grid Button */}
            <button
              onClick={() => {
                window.location.hash = '#grid';
              }}
              className="flex items-center p-1 rounded text-xs font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              title="Availability Grid View"
            >
              <Grid3x3 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(HeaderControls, (prevProps, nextProps) => {
  return (
    prevProps.selectedInspector === nextProps.selectedInspector &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.mobileViewMode === nextProps.mobileViewMode &&
    prevProps.isLiveData === nextProps.isLiveData &&
    prevProps.showOpportunities === nextProps.showOpportunities &&
    prevProps.opportunitiesLoading === nextProps.opportunitiesLoading
  );
});