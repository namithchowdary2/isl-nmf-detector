import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (
      err.response?.status === 401 &&
      err.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      try {
        // Lazy import to avoid circular dep
        const { default: useAuthStore } = await import('../store/authStore');
        const { refreshToken, setTokens } = useAuthStore.getState();
        if (refreshToken) {
          const { data } = await axios.post(`${BASE}/api/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          setTokens(data.access_token);
          original.headers['Authorization'] = `Bearer ${data.access_token}`;
          return api(original);
        }
      } catch (_) {}
      // If refresh fails, logout
      const { default: useAuthStore } = await import('../store/authStore');
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export const detectImage = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/api/detect/image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then(r => r.data);
};

export const detectStream = (frame) =>
  api.post('/api/detect/stream', { frame }, { timeout: 8000 }).then(r => r.data);

export const getDemo    = () => api.get('/api/demo').then(r => r.data);
export const getHealth  = () => api.get('/api/health').then(r => r.data);
export const getGlossary= () => api.get('/api/analytics/glossary').then(r => r.data);
export const getHistory = (limit=20) => api.get(`/api/analytics/history?limit=${limit}`).then(r => r.data);
export const getStats   = () => api.get('/api/analytics/stats').then(r => r.data);

export default api;
