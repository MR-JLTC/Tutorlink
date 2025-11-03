import axios from 'axios';

// The base URL for your NestJS backend
const API_BASE_URL = 'http://localhost:3000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/?api$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add a request interceptor to include the token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// You can add a response interceptor here to handle global errors, e.g., 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const hash = window.location.hash || '';
        const path = hash.replace(/^#/, '');
        const isTutorOrTutee = path.startsWith('/tutor') || path.startsWith('/tutee');
        window.location.href = isTutorOrTutee ? '/#/login' : '/#/admin-login';
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
  
  // Files are served directly at /tutor_documents/ without /api prefix
  if (path.startsWith('/tutor_documents/') || path.startsWith('tutor_documents/')) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_ORIGIN}${normalized}`;
  }
  
  // For other files, use the standard path
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
};
