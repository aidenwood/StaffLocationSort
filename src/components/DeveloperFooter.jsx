import React from 'react';
import { 
  Users, 
  Plus, 
  Bug, 
  MapPin, 
  RefreshCw, 
  Target, 
  Menu, 
  X, 
  Calendar 
} from 'lucide-react';

const DeveloperFooter = ({
  dealStageFilter,
  setDealStageFilter,
  setShowBookingForm,
  showDebugConsole,
  setShowDebugConsole,
  showDealsDebugConsole,
  setShowDealsDebugConsole,
  handleRefreshInspections,
  handleRefreshDeals,
  showDeveloperMenu,
  setShowDeveloperMenu,
  debugData,
  totalActivities,
  pipedriveInspectors,
  error
}) => {
  return (
    <div className="bg-gray-50 border-t border-gray-200 px-2 sm:px-4 py-2 flex-shrink-0">
      {/* Mobile Layout */}
      <div className="block sm:hidden">
        {/* Deal Filter Toggle - Mobile */}
        <div className="flex justify-center mb-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setDealStageFilter('all')}
              className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                dealStageFilter === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setDealStageFilter('lead_to_book')}
              className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                dealStageFilter === 'lead_to_book'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-green-100 hover:text-green-700'
              }`}
            >
              To Book
            </button>
            <button
              onClick={() => setDealStageFilter('lead_interested')}
              className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                dealStageFilter === 'lead_interested'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-blue-100 hover:text-blue-700'
              }`}
            >
              Interested
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <a
              href="/#activities"
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
            >
              <Users className="w-3 h-3" />
            </a>
            <button
              onClick={() => setShowBookingForm(true)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowDebugConsole(true)}
              className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              title="API Debug Console"
            >
              <Bug className="w-3 h-3" />
              {debugData.consoleLogs?.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1">
                  {debugData.consoleLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowDealsDebugConsole(true)}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
              title="Deals Debug Console"
            >
              <MapPin className="w-3 h-3" />
            </button>
            <button
              onClick={handleRefreshInspections}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              title="Refresh Inspections"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={handleRefreshDeals}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              title="Refresh Deals"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Pages:</span>
            <a
              href="/#activities"
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
            >
              <Users className="w-3 h-3" />
              Activities
            </a>
            <a
              href="/#estimator"
              className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
            >
              <Target className="w-3 h-3" />
              Risk Estimator
            </a>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <button
            onClick={() => setShowDeveloperMenu(!showDeveloperMenu)}
            className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
            title="Developer Tools Menu"
          >
            {showDeveloperMenu ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            <span>Dev Tools</span>
            {debugData.consoleLogs?.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1 ml-1">
                {debugData.consoleLogs.length}
              </span>
            )}
          </button>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Refresh:</span>
            <button
              onClick={handleRefreshInspections}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              title="Refresh Inspections"
            >
              <RefreshCw className="w-3 h-3" />
              Inspections
            </button>
            <button
              onClick={handleRefreshDeals}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              title="Refresh Deals"
            >
              <RefreshCw className="w-3 h-3" />
              Deals
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Activities: {totalActivities}</span>
            <span>•</span>
            <span>Inspectors: {pipedriveInspectors?.length || 0}</span>
            {error && (
              <>
                <span>•</span>
                <span className="text-red-600">API Error</span>
              </>
            )}
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Deal Stage:</span>
            <div className="flex bg-gray-100 rounded-md p-0.5">
              <button
                onClick={() => setDealStageFilter('all')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Deals
              </button>
              <button
                onClick={() => setDealStageFilter('lead_to_book')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'lead_to_book'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-green-100 hover:text-green-700'
                }`}
              >
                Lead to Book
              </button>
              <button
                onClick={() => setDealStageFilter('lead_interested')}
                className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                  dealStageFilter === 'lead_interested'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                }`}
              >
                Lead Interested
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Tools Menu Modal */}
      {showDeveloperMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 m-4 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Developer Tools</h3>
              <button
                onClick={() => setShowDeveloperMenu(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowBookingForm(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">New Booking Form</span>
              </button>
              <a
                href="/#book"
                onClick={() => setShowDeveloperMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Book Page</span>
              </a>
              <button
                onClick={() => {
                  setShowDebugConsole(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <Bug className="w-4 h-4" />
                <span className="text-sm">API Debug Console</span>
                {debugData.consoleLogs?.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 ml-auto">
                    {debugData.consoleLogs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setShowDealsDebugConsole(true);
                  setShowDeveloperMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Deals Debug Console</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(DeveloperFooter, (prevProps, nextProps) => {
  return (
    prevProps.dealStageFilter === nextProps.dealStageFilter &&
    prevProps.showDeveloperMenu === nextProps.showDeveloperMenu &&
    prevProps.totalActivities === nextProps.totalActivities &&
    prevProps.error === nextProps.error &&
    JSON.stringify(prevProps.debugData) === JSON.stringify(nextProps.debugData)
  );
});