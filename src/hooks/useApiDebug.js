import { useState, useEffect, useRef, useCallback } from 'react';

export const useApiDebug = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [debugData, setDebugData] = useState({
    consoleLogs: [],
    apiResponse: null,
    transformedData: {
      map: null,
      calendar: null
    },
    apiStatus: 'idle',
    dataSource: 'unknown',
    responseTime: null,
    lastUpdated: null
  });

  const originalConsole = useRef({});
  const apiStartTime = useRef(null);
  const logRateLimit = useRef(new Map()); // Track recent logs to prevent spam
  const apiCallDebounce = useRef(null);

  const addLog = useCallback((level, message, data = null) => {
    // Don't log if paused
    if (isPaused) return;
    
    const now = Date.now();
    const messageKey = `${level}:${message.substring(0, 50)}`; // Use first 50 chars as key
    const lastLogTime = logRateLimit.current.get(messageKey);
    
    // Rate limit: Only allow same message every 2 seconds
    if (lastLogTime && (now - lastLogTime) < 2000) {
      return;
    }
    
    logRateLimit.current.set(messageKey, now);
    
    // Clean up old entries (keep last 100 unique message keys)
    if (logRateLimit.current.size > 100) {
      const entries = Array.from(logRateLimit.current.entries());
      const sorted = entries.sort(([,a], [,b]) => b - a);
      logRateLimit.current = new Map(sorted.slice(0, 50));
    }

    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };

    setDebugData(prev => ({
      ...prev,
      consoleLogs: [...prev.consoleLogs.slice(-29), newLog], // Keep last 30 logs (reduced from 50)
      lastUpdated: Date.now()
    }));
  }, [isPaused]);

  const setApiResponse = useCallback((response, source = 'pipedrive') => {
    const responseTime = apiStartTime.current ? Date.now() - apiStartTime.current : null;
    
    setDebugData(prev => ({
      ...prev,
      apiResponse: response,
      dataSource: source,
      apiStatus: response ? 'success' : 'error',
      responseTime,
      lastUpdated: Date.now()
    }));
  }, []);

  const setTransformedData = useCallback((mapData, calendarData) => {
    setDebugData(prev => ({
      ...prev,
      transformedData: {
        map: mapData,
        calendar: calendarData
      },
      lastUpdated: Date.now()
    }));
  }, []);

  const startApiTimer = useCallback(() => {
    apiStartTime.current = Date.now();
    setDebugData(prev => ({
      ...prev,
      apiStatus: 'loading',
      lastUpdated: Date.now()
    }));
  }, []);

  const clearLogs = useCallback(() => {
    setDebugData(prev => ({
      ...prev,
      consoleLogs: [],
      lastUpdated: Date.now()
    }));
  }, []);

  // Intercept console methods to capture logs (with rate limiting)
  useEffect(() => {
    // Store original console methods
    originalConsole.current.log = console.log;
    originalConsole.current.error = console.error;
    originalConsole.current.warn = console.warn;
    originalConsole.current.info = console.info;

    // Temporarily disable console override to stop infinite loop
    // console.log = (...args) => {
    //   originalConsole.current.log(...args);
    //   const message = args.join(' ');
    //   // ONLY capture critical API state changes to prevent infinite logging
    //   if (message.includes('✅ V2 API: Server-side filter returned') || 
    //       message.includes('❌ V2 API failed') ||
    //       message.includes('⚠️ Rate limit hit') ||
    //       message.includes('🚫 API call already in progress')) {
    //     addLog('info', message.substring(0, 150)); // Further truncated
    //   }
    // };

    console.error = (...args) => {
      originalConsole.current.error(...args);
      const message = args.join(' ');
      if (message.includes('PIPEDRIVE') || message.includes('API Error')) {
        addLog('error', message.substring(0, 200));
      }
    };

    console.warn = (...args) => {
      originalConsole.current.warn(...args);
      const message = args.join(' ');
      if (message.includes('⚠️ V2 API failed') || message.includes('PIPEDRIVE')) {
        addLog('warn', message.substring(0, 200));
      }
    };

    console.info = (...args) => {
      originalConsole.current.info(...args);
      const message = args.join(' ');
      if (message.includes('PIPEDRIVE') && message.includes('API')) {
        addLog('info', message.substring(0, 200));
      }
    };

    // Cleanup on unmount
    return () => {
      console.log = originalConsole.current.log;
      console.error = originalConsole.current.error;
      console.warn = originalConsole.current.warn;
      console.info = originalConsole.current.info;
    };
  }, [addLog]);

  // Track when activities are fetched/transformed with debouncing
  const trackApiCall = useCallback((promise, source = 'pipedrive') => {
    // Clear previous debounce
    if (apiCallDebounce.current) {
      clearTimeout(apiCallDebounce.current);
    }
    
    // Debounce API calls - only track if no new call for 500ms
    return new Promise((resolve, reject) => {
      apiCallDebounce.current = setTimeout(() => {
        startApiTimer();
        
        promise
          .then(response => {
            setApiResponse(response, source);
            addLog('info', `✅ API call completed (${source})`, { 
              itemCount: Array.isArray(response) ? response.length : 1,
              source 
            });
            resolve(response);
          })
          .catch(error => {
            setApiResponse(null, source);
            addLog('error', `❌ API call failed (${source}): ${error.message}`, { 
              error: error.message, 
              source 
            });
            reject(error);
          });
      }, 500); // 500ms debounce
    });
  }, [startApiTimer, setApiResponse, addLog]);

  return {
    debugData,
    addLog,
    setApiResponse,
    setTransformedData,
    startApiTimer,
    trackApiCall,
    clearLogs,
    isPaused,
    setIsPaused
  };
};