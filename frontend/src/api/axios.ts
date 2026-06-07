/// <reference types="vite/client" />
import axios from 'axios';

// Захардкоженный fallback если переменная не попала в билд
const API_URL = import.meta.env.VITE_API_URL || 'https://rsu4udatacombackend-production.up.railway.app';

const baseURL = `${API_URL}/api`;

console.log('[API] VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('[API] baseURL:', baseURL);

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
