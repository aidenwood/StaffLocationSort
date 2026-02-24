import axios from 'axios';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 seconds for optimization requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data?.error || `HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      // Network error
      throw new Error('Network error: Unable to connect to server');
    } else {
      // Other error
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// API methods
export const api = {
  // Health check
  getHealth: () => apiClient.get('/health'),
  
  // Inspectors
  getInspectors: () => apiClient.get('/inspectors'),
  getInspectorSchedule: (id, startDate, endDate) => 
    apiClient.get(`/inspectors/${id}/schedule`, { 
      params: { start_date: startDate, end_date: endDate } 
    }),
  
  // Optimization
  optimizeSchedule: (schedulingRequest) => 
    apiClient.post('/optimise', schedulingRequest),
  
  // Booking (optional)
  bookInspection: (bookingData) => 
    apiClient.post('/book', bookingData),
};

export default apiClient;