// Pipedrive Data Hook - V2 API with server-side filter
// Primary: fetchActivitiesWithFilterV2 (filter 215315) + transform
// Fallback: fetchActivitiesByDateRange + client-side filtering if V2 returns 0

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  fetchActivitiesWithFilterV2,
  enrichActivitiesWithAddresses,
  fetchActivitiesByDateRange,
  transformPipedriveActivity,
  healthCheck as pipedriveHealthCheck 
} from '../api/pipedriveRead.js';
import { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } from '../config/pipedriveFilters.js';
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
    isTimeout: false,
    errorCount: 0,
    lastError: null,
    isCircuitBreakerOpen: false
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
    console.log(result ? '✅ Using live Pipedrive data (V2 API + filter fallback)' : '❌ No valid Pipedrive IDs - using mock data');
    
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

  // Add rate limit tracking and circuit breaker
  const lastFetchTime = useRef(null);
  const isCurrentlyFetching = useRef(false);
  const consecutiveErrors = useRef(0);
  const circuitBreakerTimeout = useRef(null);
  
  // Fetch activities with caching - V0 PROVEN WORKING approach
  const fetchActivities = useCallback(async (userId = null, startDate = null, endDate = null) => {
    const now = Date.now();
    const cacheKey = `activities_${userId}_${startDate}_${endDate}`;
    const cachedData = cache.get(cacheKey);
    
    // Return cached data if it's still valid
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheTimeout) {
      console.log('📋 Using cached activities data');
      return cachedData.data;
    }

    // Circuit breaker: Stop trying if we've had 3+ consecutive errors
    if (consecutiveErrors.current >= 3) {
      console.log('🔴 Circuit breaker is OPEN - API calls suspended after 3 consecutive errors');
      setState(prev => ({ 
        ...prev, 
        isCircuitBreakerOpen: true,
        error: `API unavailable after ${consecutiveErrors.current} consecutive errors`,
        loading: false 
      }));
      return cachedData?.data || [];
    }

    // Prevent multiple simultaneous requests
    if (isCurrentlyFetching.current) {
      console.log('🚫 API call already in progress, skipping duplicate request');
      return [];
    }

    // Rate limit: Wait at least 3 seconds between API calls
    if (lastFetchTime.current && (now - lastFetchTime.current) < 3000) {
      console.log('⏱️ Rate limit: Too soon since last API call, using cache or empty result');
      return cachedData?.data || [];
    }

    isCurrentlyFetching.current = true;
    lastFetchTime.current = now;
    setState(prev => ({ ...prev, loading: true, error: null, isTimeout: false }));

    // Set up 3-second timeout for rate limiting feedback
    const timeoutId = setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        isTimeout: true,
        error: 'API request taking longer than expected - possible rate limiting'
      }));
      console.log('⏰ PIPEDRIVE TIMEOUT: Request taking > 10 seconds, likely rate limited');
    }, 10000);

    try {
      let activities = [];
      let isLiveData = false;

      if (shouldUseLiveData) {
        console.log('🔄 PIPEDRIVE DEBUG: Fetching live data (V2 API primary)...');
        console.log('   userId:', userId);
        console.log('   startDate:', startDate);
        console.log('   endDate:', endDate);

        const today = new Date();
        const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
        const limitedStartDate = startDate || today.toISOString().split('T')[0];
        const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];

        let rawActivities = [];

        // Use working V2 API approach (always successful with 188 activities)
        try {
          console.log('🔄 Using WORKING V2 API approach...');
          rawActivities = await fetchActivitiesWithFilterV2(PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
          console.log(`📊 V2 API: Received ${rawActivities.length} activities from filter 215315`);
          
          // NOTE: Address enrichment moved to individual components (SimpleActivityList)
          // to avoid 174+ Person API calls. Components enrich only their filtered subset.
        } catch (v2Error) {
          console.warn('⚠️ V2 API failed, falling back to V0:', v2Error.message);
          // Fallback to V0 if V2 fails
          const pipedriveUser = userId ? getAllInspectors().find(i => i.appId === userId) ?? (userId === 'test' ? getTestUser() : null) : null;
          const v0UserId = pipedriveUser?.id ?? null;
          const allV0 = await fetchActivitiesByDateRange(limitedStartDate, limitedEndDate, v0UserId);
          rawActivities = allV0.filter(a => (a.subject || '').toLowerCase().includes('property inspection'));
          console.log(`📊 V0 fallback: ${rawActivities.length} property inspection activities`);
        }

        // Transform to app format (owner_id = appId for UI matching)  
        activities = rawActivities
          .map(transformPipedriveActivity)
          .filter(Boolean);

        // Filter by selected inspector if specified; cap at 50 per inspector (skip when "all")
        if (userId && userId !== 'all' && activities.length > 0) {
          const before = activities.length;
          activities = activities
            .filter(a => Number(a.owner_id) === Number(userId))
            .slice(0, 50);
          console.log(`✅ Filtered to ${activities.length} activities for inspector (appId: ${userId}, max 50)`);
          if (before > activities.length) {
            console.log(`   (filtered out ${before - activities.length} from other inspectors)`);
          }
        }

        isLiveData = true;
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
      isCurrentlyFetching.current = false;
      
      // Reset error count on success
      consecutiveErrors.current = 0;
      
      setState(prev => ({
        ...prev,
        activities,
        loading: false,
        isLiveData,
        lastFetch: new Date().toISOString(),
        error: null,
        isTimeout: false,
        errorCount: 0,
        isCircuitBreakerOpen: false
      }));

      // Debug: Add activities to window for testing
      window.debugActivities = activities;
      console.log('🧪 DEBUG: Added', activities.length, 'activities to window.debugActivities');

      return activities;

    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      isCurrentlyFetching.current = false;
      
      // Increment consecutive error count
      consecutiveErrors.current += 1;
      console.error(`❌ Error fetching activities (${consecutiveErrors.current}/3):`, error);
      
      // Check if it's a rate limit error and use cached data if available
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.log('⚠️ Rate limit hit, using cached data if available');
        if (cachedData?.data) {
          console.log('📋 Using stale cached data due to rate limit');
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: 'Rate limited - using cached data',
            isTimeout: false,
            errorCount: consecutiveErrors.current,
            lastError: error.message
          }));
          return cachedData.data;
        }
      }
      
      // Circuit breaker logic
      const isCircuitBreakerTriggered = consecutiveErrors.current >= 3;
      
      if (isCircuitBreakerTriggered) {
        console.log('🔴 CIRCUIT BREAKER TRIGGERED - 3 consecutive errors reached');
        setState(prev => ({
          ...prev,
          activities: cachedData?.data || [],
          loading: false,
          isLiveData: false,
          error: `API unavailable after ${consecutiveErrors.current} consecutive errors`,
          isTimeout: false,
          errorCount: consecutiveErrors.current,
          lastError: error.message,
          isCircuitBreakerOpen: true
        }));
      } else {
        console.log('❌ NO FALLBACK: Showing error state instead of mock data');
        setState(prev => ({
          ...prev,
          activities: [], // Empty array, no mock fallback
          loading: false,
          isLiveData: false,
          error: error.message,
          isTimeout: false,
          errorCount: consecutiveErrors.current,
          lastError: error.message,
          isCircuitBreakerOpen: false
        }));
      }

      return cachedData?.data || [];
    }
  }, [shouldUseLiveData, cache, cacheTimeout]);

  // Get activities for specific inspector and date
  const getInspectorActivities = useCallback(async (inspectorId, date = null) => {
    try {
      if (!shouldUseLiveData) {
        return date
          ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
          : getActivitiesByInspector(inspectorId);
      }

      let rawActivities = [];
      const dateString = date || null;

      try {
        rawActivities = await fetchActivitiesWithFilterV2(
          PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID
        );
      } catch {
        const pipedriveUser = getAllInspectors().find(i => i.appId === inspectorId) ?? (inspectorId === 'test' ? getTestUser() : null);
        const v0Data = await fetchActivitiesByDateRange(dateString, dateString, pipedriveUser?.id);
        rawActivities = v0Data.filter(a => (a.subject || '').toLowerCase().includes('property inspection'));
      }

      let activities = rawActivities
        .map(transformPipedriveActivity)
        .filter(Boolean)
        .filter(a => a.owner_id === inspectorId);

      if (dateString) {
        activities = activities.filter(a => a.due_date === dateString);
      }

      return activities;
    } catch (error) {
      console.error('❌ Error fetching inspector activities:', error);
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

  // Reset circuit breaker and retry
  const resetCircuitBreaker = useCallback(() => {
    console.log('🟢 Circuit breaker RESET - attempting API reconnection');
    consecutiveErrors.current = 0;
    setState(prev => ({
      ...prev,
      errorCount: 0,
      isCircuitBreakerOpen: false,
      error: null
    }));
  }, []);

  // Refresh data (bypass cache)
  const refresh = useCallback(async (userId = null, startDate = null, endDate = null) => {
    clearCache();
    resetCircuitBreaker(); // Reset circuit breaker on manual refresh
    return await fetchActivities(userId, startDate, endDate);
  }, [fetchActivities, clearCache, resetCircuitBreaker]);

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
    errorCount: state.errorCount,
    lastError: state.lastError,
    isCircuitBreakerOpen: state.isCircuitBreakerOpen,
    
    // Configuration
    shouldUseLiveData,
    enableLiveData,
    
    // Methods
    fetchActivities,
    getInspectorActivities,
    checkHealth,
    refresh,
    clearCache,
    resetCircuitBreaker,
    
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