/// <reference types="vite/client" />
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://rsu4udatacombackend-production.up.railway.app';
const baseURL = `${API_URL}/api`;

console.log('[API] baseURL:', baseURL);

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Не редиректим если уже на корне (форма входа)
      if (window.location.pathname !== '/' && window.location.pathname !== '/admin/') {
        window.location.href = '/admin/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
