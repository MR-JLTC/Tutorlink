import axios from 'axios';

// The base URL for your NestJS backend
const API_BASE_URL = 'http://localhost:3000/api';

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
    const message: string | undefined = error?.response?.data?.message;
    const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;

    if (message && notify) {
      // Prefer backend-provided friendly messages
      notify(Array.isArray(message) ? message.join(', ') : message, 'error');
    } else if (notify) {
      // Fallback generic
      notify(status === 401 ? 'You are not authorized.' : 'Something went wrong. Please try again.', 'error');
    }

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/#/login';
    }
    // Forward the error so it can be handled by the calling component
    return Promise.reject(error);
  }
);


export default apiClient;
