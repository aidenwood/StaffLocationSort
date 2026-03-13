import React, { useState, useRef, useEffect } from 'react';
import { useRosterData } from '../hooks/useRosterData';

const RosterCellEditor = ({ 
  inspector, 
  date, 
  currentRegion, 
  onClose, 
  onSave 
}) => {
  const [selectedRegion, setSelectedRegion] = useState(currentRegion?.code || '');
  const [status, setStatus] = useState('working');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const { updateRoster, getRosterForDate } = useRosterData(
    new Date(date), 
    new Date(date), 
    inspector.id
  );

  const regions = [
    { code: 'R01', name: 'R01 - Brisbane/Logan/Ipswich' },
    { code: 'R02', name: 'R02 - Gympie/Maryborough' },
    { code: 'R03', name: 'R03 - Bundaberg' },
    { code: 'R04', name: 'R04 - Toowoomba' },
    { code: 'R05', name: 'R05 - Warwick/Stanthorpe' },
    { code: 'R06', name: 'R06 - Roma' },
    { code: 'R07', name: 'R07 - Grafton/Coffs' },
    { code: 'R08', name: 'R08 - Glen Innes/Armidale' },
    { code: 'R09', name: 'R09 - Newcastle' }
  ];

  const statuses = [
    { value: 'working', label: 'Working', color: 'bg-green-100 text-green-800' },
    { value: 'sick', label: 'Sick', color: 'bg-red-100 text-red-800' },
    { value: 'rain', label: 'Rain Day', color: 'bg-blue-100 text-blue-800' },
    { value: 'rdo', label: 'RDO', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'annual_leave', label: 'Annual Leave', color: 'bg-purple-100 text-purple-800' }
  ];

  useEffect(() => {
    // Create date object without timezone issues
    const dateObj = new Date(date + 'T00:00:00');
    const existingRoster = getRosterForDate(inspector.id, dateObj);
    if (existingRoster) {
      setSelectedRegion(existingRoster.region_code || '');
      setStatus(existingRoster.status || 'working');
      setNotes(existingRoster.notes || '');
    }
  }, [inspector.id, date, getRosterForDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSave = async () => {
    setLoading(true);
    
    const selectedRegionObj = regions.find(r => r.code === selectedRegion);
    
    try {
      // Create date object without timezone issues
      const dateObj = new Date(date + 'T00:00:00');
      const result = await updateRoster(
        inspector.id,
        inspector.name,
        dateObj,
        selectedRegion,
        selectedRegionObj?.name || '',
        status,
        notes
      );

      if (result.success) {
        onSave({
          regionCode: selectedRegion,
          regionName: selectedRegionObj?.name || '',
          status,
          notes
        });
        onClose();
      } else {
        console.error('Failed to update roster:', result.error);
      }
    } catch (error) {
      console.error('Error updating roster:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      handleSave();
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-80"
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            Edit Roster - {inspector.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div className="text-sm text-gray-500">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region Assignment
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No Assignment</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {statuses.map((statusOption) => (
              <button
                key={statusOption.value}
                onClick={() => setStatus(statusOption.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  status === statusOption.value
                    ? statusOption.color + ' ring-2 ring-offset-1 ring-blue-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {statusOption.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this assignment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        Press Esc to cancel, Ctrl+Enter to save
      </div>
    </div>
  );
};

export default RosterCellEditor;