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
    healthStatus: null
  });

  const [cache, setCache] = useState(new Map());

  // Check if we should use live data
  const shouldUseLiveData = useMemo(() => {
    if (!enableLiveData) return false;
    
    const validation = hasValidPipedriveIds();
    return validation.testUser || validation.inspectors;
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

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let activities = [];
      let isLiveData = false;

      if (shouldUseLiveData) {
        console.log('🔄 Fetching live Pipedrive data...');
        
        if (userId) {
          // Fetch for specific user
          const pipedriveUser = getAllInspectors().find(inspector => inspector.appId === userId);
          const testUser = getTestUser();
          
          if (pipedriveUser?.id) {
            activities = await fetchTransformedActivities(pipedriveUser.id, startDate, endDate);
            isLiveData = true;
          } else if (testUser.id && userId === 'test') {
            activities = await fetchTransformedActivities(testUser.id, startDate, endDate);
            isLiveData = true;
          } else {
            console.warn('⚠️ User not found in Pipedrive configuration, falling back to mock');
            activities = getActivitiesByInspector(userId);
          }
        } else {
          // Fetch for all configured users
          const allActivities = [];
          
          // Fetch test user data if configured
          const testUser = getTestUser();
          if (testUser.id) {
            try {
              const testActivities = await fetchTransformedActivities(testUser.id, startDate, endDate);
              allActivities.push(...testActivities);
            } catch (error) {
              console.warn('⚠️ Could not fetch test user activities:', error.message);
            }
          }
          
          // Fetch inspector data if configured
          for (const inspector of getAllInspectors()) {
            if (inspector.id) {
              try {
                const inspectorActivities = await fetchTransformedActivities(inspector.id, startDate, endDate);
                allActivities.push(...inspectorActivities);
              } catch (error) {
                console.warn(`⚠️ Could not fetch activities for ${inspector.name}:`, error.message);
              }
            }
          }
          
          activities = allActivities;
          isLiveData = allActivities.length > 0;
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

      setState(prev => ({
        ...prev,
        activities,
        loading: false,
        isLiveData,
        lastFetch: new Date().toISOString(),
        error: null
      }));

      return activities;

    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      
      // Fallback to mock data on error
      console.log('🔄 Falling back to mock data due to error');
      const fallbackActivities = userId ? getActivitiesByInspector(userId) : mockActivities;
      
      setState(prev => ({
        ...prev,
        activities: fallbackActivities,
        loading: false,
        isLiveData: false,
        error: error.message
      }));

      return fallbackActivities;
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