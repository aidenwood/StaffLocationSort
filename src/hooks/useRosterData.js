import { useState, useEffect, useCallback } from 'react';
import { rosterApi } from '../lib/supabase.js';

/**
 * Custom hook for managing roster data with real-time updates
 * @param {Date} startDate - Start date for roster data
 * @param {Date} endDate - End date for roster data
 * @param {number} inspectorId - Optional inspector ID to filter by
 */
export const useRosterData = (startDate, endDate, inspectorId = null) => {
  const [rosterData, setRosterData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Convert dates to YYYY-MM-DD format
  const formatDate = (date) => {
    if (!date) return null;
    return date.toISOString().split('T')[0];
  };

  // Fetch roster data with rate limiting
  const fetchRosterData = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const data = await rosterApi.getRosterData(
        formatDate(startDate),
        formatDate(endDate),
        inspectorId
      );
      
      setRosterData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      // Only log error if not a rate limiting issue
      if (!err.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
        console.error('Error fetching roster data:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, inspectorId]);

  // Update roster assignment
  const updateRoster = useCallback(async (inspectorId, inspectorName, date, regionCode, regionName, status = 'working', notes = '') => {
    try {
      const result = await rosterApi.updateRosterAssignment(
        inspectorId,
        inspectorName,
        formatDate(date),
        regionCode,
        regionName,
        status,
        notes
      );

      if (result.success) {
        // Optimistically update local state
        setRosterData(prev => {
          const dateStr = formatDate(date);
          const existing = prev.find(r => r.inspector_id === inspectorId && r.date === dateStr);
          
          if (existing) {
            // Update existing record
            return prev.map(r => 
              r.inspector_id === inspectorId && r.date === dateStr
                ? { ...r, region_code: regionCode, region_name: regionName, status, notes, updated_at: new Date().toISOString() }
                : r
            );
          } else {
            // Add new record
            return [...prev, {
              id: `temp-${Date.now()}`,
              inspector_id: inspectorId,
              inspector_name: inspectorName,
              date: dateStr,
              region_code: regionCode,
              region_name: regionName,
              status,
              notes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }];
          }
        });
        
        setLastUpdated(new Date());
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error updating roster:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Bulk update roster
  const bulkUpdateRoster = useCallback(async (assignments) => {
    try {
      const result = await rosterApi.bulkUpdateRoster(assignments);
      
      if (result.success) {
        // Refresh data after bulk update
        await fetchRosterData();
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error bulk updating roster:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRosterData]);

  // Delete roster assignment
  const deleteRoster = useCallback(async (inspectorId, date) => {
    try {
      const result = await rosterApi.deleteRosterAssignment(inspectorId, formatDate(date));
      
      if (result.success) {
        // Optimistically remove from local state
        setRosterData(prev => prev.filter(r => 
          !(r.inspector_id === inspectorId && r.date === formatDate(date))
        ));
        
        setLastUpdated(new Date());
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error deleting roster:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Get roster for specific inspector and date
  const getRosterForDate = useCallback((inspectorId, date) => {
    const dateStr = formatDate(date);
    return rosterData.find(r => r.inspector_id === inspectorId && r.date === dateStr);
  }, [rosterData]);

  // Initial data fetch with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchRosterData();
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [fetchRosterData]);

  // Real-time subscription (disabled temporarily to fix rate limiting)
  useEffect(() => {
    // Temporarily disabled to prevent rate limiting issues
    // TODO: Re-enable with proper throttling
    /*
    const subscription = rosterApi.subscribeToRosterChanges((payload) => {
      console.log('📡 Roster change received:', payload);
      
      // Throttled refresh data when changes occur
      const throttledRefresh = setTimeout(() => {
        fetchRosterData();
      }, 1000);
      
      return () => clearTimeout(throttledRefresh);
    });

    return () => {
      rosterApi.unsubscribeFromRosterChanges(subscription);
    };
    */
  }, []);

  return {
    rosterData,
    loading,
    error,
    lastUpdated,
    updateRoster,
    bulkUpdateRoster,
    deleteRoster,
    getRosterForDate,
    refetch: fetchRosterData,
    clearError: () => setError(null)
  };
};

export default useRosterData;