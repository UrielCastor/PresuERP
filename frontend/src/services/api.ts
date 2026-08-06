import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor for token refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post('/api/v1/auth/refresh', {}, {
          // Send refresh cookies automatically
          withCredentials: true
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear auth and notify backend logout if possible
        try {
          await axios.post('/api/v1/auth/logout', {}, { withCredentials: true });
        } catch (e) {
          // ignore error if token is already expired/invalidated
        }

        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.data?.code === 'PLAN_LIMIT_REACHED') {
      window.dispatchEvent(
        new CustomEvent('planLimitReached', { detail: error.response.data })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
