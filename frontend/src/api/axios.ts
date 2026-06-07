import axios from 'axios';

// В продакшене VITE_API_URL = https://backend-url.railway.app
// Локально запросы проксируются через vite на localhost:3001
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/admin/';
    }
    return Promise.reject(error);
  }
);

export default api;
