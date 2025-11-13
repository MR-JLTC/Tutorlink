import axios from 'axios';
import { getActiveToken, getRoleForContext, clearRoleAuth } from '../utils/authRole';

// The base URL for your NestJS backend
const API_BASE_URL = 'http://localhost:3000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/?api$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  // Do not set a global Content-Type header so multipart/form-data requests
  // can let the browser/axios set the correct boundary automatically.
  headers: {},
  validateStatus: function (status) {
    return status >= 200 && status < 500; // Accept all status codes between 200 and 499
  }
});

// Add a request interceptor to include the token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getActiveToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // If no token and trying to access protected route, redirect to login
      const path = window.location.pathname;
      if (!path.includes('/login') && !path.includes('/LandingPage')) {
        window.location.href = '/login';
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and network issues
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses for debugging
    console.log(`API Response [${response.config.method?.toUpperCase()}] ${response.config.url}:`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Network error (no response from server)
    if (!error.response) {
      console.error('Network Error:', error.message);
      return Promise.reject({
        response: {
          data: {
            message: 'Unable to connect to the server. Please check your internet connection.'
          }
        }
      });
    }

    // Log error responses for debugging
    console.error(`API Error [${error.config?.method?.toUpperCase()}] ${error.config?.url}:`, {
      status: error.response?.status,
      data: error.response?.data,
      error: error.message
    });

    const status = error?.response?.status;
    const rawMessage: any = error?.response?.data?.message;
    const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;

    // Skip Toast messages for authentication endpoints and tutor ID lookup - let the pages handle their own error display
    const reqUrl: string | undefined = error?.config?.url;
    const isAuthEndpoint = reqUrl?.includes('/auth/login') || reqUrl?.includes('/auth/register') || reqUrl?.includes('/auth/login-tutor-tutee');
    const isTutorIdEndpoint = reqUrl?.includes('/tutors/by-user/') && reqUrl?.includes('/tutor-id');

    const suppressByMessage = typeof rawMessage === 'string' && rawMessage.toLowerCase().includes('tutor not found');
    if (notify && !isAuthEndpoint && !isTutorIdEndpoint && !suppressByMessage) {
      let display = Array.isArray(rawMessage) ? rawMessage.join(', ') : (rawMessage as string | undefined);
      if (typeof display === 'string' && display.toLowerCase().includes('email already registered')) {
        display = 'Email already registered';
      }
      if (!display) {
        display = status === 401 ? 'You are not authorized.' : 'Something went wrong. Please try again.';
      }
      notify(display, 'error');
    }

    if (status === 401) {
      if (!isAuthEndpoint) {
        const role = getRoleForContext();
        if (role) {
          clearRoleAuth(role);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const path = window.location.pathname;
        const isTutorOrTutee = path.startsWith('/tutor') || path.startsWith('/tutee');
        window.location.href = isTutorOrTutee ? '/login' : '/admin-login';
      }
      // For auth endpoints, do not redirect; allow the page (e.g., admin-login) to remain
    }
    // Forward the error so it can be handled by the calling component
    return Promise.reject(error);
  }
);


export default apiClient;

export const getFileUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  
  // Profile images are served directly at /user_profile_images/ without /api prefix
  if (path.startsWith('/user_profile_images/') || path.startsWith('user_profile_images/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }

  // Admin QR images are served directly at /admin_qr/ without /api prefix
  if (path.startsWith('/admin_qr/') || path.startsWith('admin_qr/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }
  
  // Files are served directly at /tutor_documents/ without /api prefix
  if (path.startsWith('/tutor_documents/') || path.startsWith('tutor_documents/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }
  
  // For other files, use the standard path
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
};
