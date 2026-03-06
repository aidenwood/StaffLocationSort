// Pipedrive Data Hook
// Manages the toggle between live Pipedrive data and mock data
// Provides caching and error handling for API calls

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchTransformedActivities,
  fetchUserActivities,
  healthCheck as pipedriveHealthCheck 
} from '../api/pipedriveRead.js';
import { 
  mockActivities, 
  inspectors, 
  getActivitiesByInspector,
  getActivitiesByInspectorAndDate 
} from '../data/mockActivities.js';
import { 
  PIPEDRIVE_USERS,
  getTestUser,
  getAllInspectors,
  hasValidPipedriveIds
} from '../config/pipedriveUsers.js';

// Hook for managing Pipedrive data with fallback to mock data
export const usePipedriveData = (options = {}) => {
  const {
    autoFetch = true,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
    enableLiveData = import.meta.env.VITE_USE_LIVE_DATA === 'true'
  } = options;

  const [state, setState] = useState({
    activities: [],
    inspectors: [],
    loading: false,
    error: null,
    isLiveData: false,
    lastFetch: null,
    healthStatus: null,
    isTimeout: false
  });

  const [cache, setCache] = useState(new Map());

  // Check if we should use live data
  const shouldUseLiveData = useMemo(() => {
    console.log('🔧 PIPEDRIVE DEBUG: Checking if should use live data...');
    console.log('   enableLiveData:', enableLiveData);
    console.log('   VITE_USE_LIVE_DATA:', import.meta.env.VITE_USE_LIVE_DATA);
    
    if (!enableLiveData) {
      console.log('❌ Live data disabled - using mock data');
      return false;
    }
    
    const validation = hasValidPipedriveIds();
    console.log('🔍 Pipedrive ID validation:', validation);
    
    const result = validation.testUser || validation.inspectors;
    console.log(result ? '✅ Using live Pipedrive data' : '❌ No valid Pipedrive IDs - using mock data');
    
    return result;
  }, [enableLiveData]);

  // Health check for Pipedrive API
  const checkHealth = useCallback(async () => {
    if (!shouldUseLiveData) {
      return { success: true, source: 'mock' };
    }

    try {
      console.log('🏥 Checking Pipedrive API health...');
      const health = await pipedriveHealthCheck();
      
      setState(prev => ({ 
        ...prev, 
        healthStatus: { 
          ...health, 
          timestamp: new Date().toISOString() 
        } 
      }));
      
      return health;
    } catch (error) {
      console.error('❌ Pipedrive health check failed:', error);
      
      const healthStatus = { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      setState(prev => ({ ...prev, healthStatus }));
      return healthStatus;
    }
  }, [shouldUseLiveData]);

  // Fetch activities with caching
  const fetchActivities = useCallback(async (userId = null, startDate = null, endDate = null) => {
    const cacheKey = `activities_${userId}_${startDate}_${endDate}`;
    const cachedData = cache.get(cacheKey);
    
    // Return cached data if it's still valid
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheTimeout) {
      console.log('📋 Using cached activities data');
      return cachedData.data;
    }

    setState(prev => ({ ...prev, loading: true, error: null, isTimeout: false }));

    // Set up 3-second timeout for rate limiting feedback
    const timeoutId = setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        isTimeout: true,
        error: 'API request taking longer than expected - possible rate limiting'
      }));
      console.log('⏰ PIPEDRIVE TIMEOUT: Request taking > 3 seconds, likely rate limited');
    }, 3000);

    try {
      let activities = [];
      let isLiveData = false;

      if (shouldUseLiveData) {
        console.log('🔄 PIPEDRIVE DEBUG: Fetching live Pipedrive data...');
        console.log('   userId:', userId);
        console.log('   startDate:', startDate);
        console.log('   endDate:', endDate);
        
        if (userId) {
          // Fetch for specific user only - much more efficient
          const pipedriveUser = getAllInspectors().find(inspector => inspector.appId === userId);
          const testUser = getTestUser();
          
          console.log('🔍 PIPEDRIVE DEBUG: User lookup for specific inspector only:');
          console.log('   requested userId (appId):', userId);
          console.log('   found pipedriveUser:', pipedriveUser?.name, '(ID:', pipedriveUser?.id, ')');
          
          if (pipedriveUser?.id) {
            console.log(`📞 PIPEDRIVE API: Fetching activities ONLY for ${pipedriveUser.name} (ID: ${pipedriveUser.id})`);
            console.log('   📅 Date range: next 2 weeks only for performance');
            
            // Limit to next 2 weeks for better performance
            const today = new Date();
            const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
            const limitedStartDate = startDate || today.toISOString().split('T')[0];
            const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];
            
            activities = await fetchTransformedActivities(pipedriveUser.id, limitedStartDate, limitedEndDate);
            console.log(`✅ PIPEDRIVE API: Received ${activities.length} activities for ${pipedriveUser.name}`);
            isLiveData = true;
          } else if (testUser.id && userId === 'test') {
            console.log(`📞 PIPEDRIVE API: Fetching activities ONLY for test user ${testUser.name} (ID: ${testUser.id})`);
            
            // Limit to next 2 weeks for test user too
            const today = new Date();
            const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
            const limitedStartDate = startDate || today.toISOString().split('T')[0];
            const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];
            
            activities = await fetchTransformedActivities(testUser.id, limitedStartDate, limitedEndDate);
            console.log(`✅ PIPEDRIVE API: Received ${activities.length} activities for test user`);
            isLiveData = true;
          } else {
            console.warn('⚠️ PIPEDRIVE DEBUG: User not found in configuration, falling back to mock');
            console.warn('   Available inspectors:', getAllInspectors().map(i => ({appId: i.appId, name: i.name, id: i.id})));
            activities = getActivitiesByInspector(userId);
          }
        } else {
          // No specific user requested - return empty for better performance
          console.log('📝 PIPEDRIVE DEBUG: No specific user requested - returning empty array for performance');
          console.log('   (Use inspector selector to fetch specific inspector data)');
          activities = [];
          isLiveData = shouldUseLiveData;
        }
      } else {
        console.log('📋 Using mock data (live data disabled)');
        activities = userId ? getActivitiesByInspector(userId) : mockActivities;
      }

      // Cache the results
      const cacheData = {
        data: activities,
        timestamp: Date.now(),
        isLiveData
      };
      
      const newCache = new Map(cache);
      newCache.set(cacheKey, cacheData);
      setCache(newCache);

      // Clear timeout and update success state
      clearTimeout(timeoutId);
      
      setState(prev => ({
        ...prev,
        activities,
        loading: false,
        isLiveData,
        lastFetch: new Date().toISOString(),
        error: null,
        isTimeout: false
      }));

      // Debug: Add activities to window for Playwright testing
      window.debugActivities = activities;
      console.log('🧪 DEBUG: Added', activities.length, 'activities to window.debugActivities');

      return activities;

    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      console.error('❌ Error fetching activities:', error);
      
      // No fallback to mock data - show error state
      console.log('❌ NO FALLBACK: Showing error state instead of mock data');
      
      setState(prev => ({
        ...prev,
        activities: [], // Empty array, no mock fallback
        loading: false,
        isLiveData: false,
        error: error.message,
        isTimeout: false
      }));

      return [];
    }
  }, [shouldUseLiveData, cache, cacheTimeout]);

  // Get activities for specific inspector and date
  const getInspectorActivities = useCallback(async (inspectorId, date = null) => {
    try {
      let activities;

      if (shouldUseLiveData) {
        const inspector = getAllInspectors().find(inspector => inspector.appId === inspectorId);
        const testUser = getTestUser();
        
        if (inspector?.id) {
          const dateString = date ? date : null;
          activities = await fetchTransformedActivities(inspector.id, dateString, dateString);
        } else if (testUser.id && inspectorId === 'test') {
          const dateString = date ? date : null;
          activities = await fetchTransformedActivities(testUser.id, dateString, dateString);
        } else {
          // Fallback to mock data
          activities = date 
            ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
            : getActivitiesByInspector(inspectorId);
        }
      } else {
        activities = date 
          ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
          : getActivitiesByInspector(inspectorId);
      }

      return activities;
    } catch (error) {
      console.error('❌ Error fetching inspector activities:', error);
      
      // Fallback to mock data
      return date 
        ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
        : getActivitiesByInspector(inspectorId);
    }
  }, [shouldUseLiveData]);

  // Clear cache
  const clearCache = useCallback(() => {
    setCache(new Map());
    console.log('🧹 Pipedrive data cache cleared');
  }, []);

  // Refresh data (bypass cache)
  const refresh = useCallback(async (userId = null, startDate = null, endDate = null) => {
    clearCache();
    return await fetchActivities(userId, startDate, endDate);
  }, [fetchActivities, clearCache]);

  // Get inspector list (mix of configured Pipedrive users and mock data)
  const getInspectorList = useCallback(() => {
    if (shouldUseLiveData) {
      // Return configured inspectors with Pipedrive IDs
      const configuredInspectors = getAllInspectors()
        .filter(inspector => inspector.id !== null)
        .map(inspector => ({
          id: inspector.appId,
          name: inspector.name,
          email: inspector.email,
          region: inspector.region,
          pipedriveId: inspector.id,
          isFromPipedrive: true
        }));

      // Add test user if configured
      const testUser = getTestUser();
      if (testUser.id) {
        configuredInspectors.push({
          id: 'test',
          name: testUser.name,
          email: testUser.email,
          region: testUser.region,
          pipedriveId: testUser.id,
          isTestUser: true,
          isFromPipedrive: true
        });
      }

      // Fallback to mock data if no Pipedrive users are configured
      return configuredInspectors.length > 0 ? configuredInspectors : inspectors;
    }

    return inspectors;
  }, [shouldUseLiveData]);

  // Initialize data on mount
  useEffect(() => {
    if (autoFetch) {
      fetchActivities();
    }
  }, [autoFetch, fetchActivities]);

  // Return hook interface
  return {
    // Data
    activities: state.activities,
    inspectors: getInspectorList(),
    
    // State
    loading: state.loading,
    error: state.error,
    isLiveData: state.isLiveData,
    lastFetch: state.lastFetch,
    healthStatus: state.healthStatus,
    isTimeout: state.isTimeout,
    
    // Configuration
    shouldUseLiveData,
    enableLiveData,
    
    // Methods
    fetchActivities,
    getInspectorActivities,
    checkHealth,
    refresh,
    clearCache,
    
    // Cache info
    cacheSize: cache.size,
    cacheTimeout
  };
};

// Hook specifically for activity data with date filtering
export const usePipedriveActivities = (inspectorId = null, date = null) => {
  const {
    activities,
    loading,
    error,
    isLiveData,
    getInspectorActivities,
    refresh
  } = usePipedriveData({
    autoFetch: false // We'll fetch manually based on params
  });

  const [filteredActivities, setFilteredActivities] = useState([]);

  // Fetch activities when params change
  useEffect(() => {
    const loadActivities = async () => {
      if (inspectorId) {
        const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
        const activities = await getInspectorActivities(inspectorId, dateString);
        setFilteredActivities(activities);
      } else {
        setFilteredActivities([]);
      }
    };

    loadActivities();
  }, [inspectorId, date, getInspectorActivities]);

  return {
    activities: filteredActivities,
    loading,
    error,
    isLiveData,
    refresh: () => refresh(inspectorId, date, date)
  };
};

export default usePipedriveData;