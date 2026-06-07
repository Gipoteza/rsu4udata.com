/// <reference types="vite/client" />
import axios from 'axios';

// VITE_API_URL прописывается в Railway как переменная окружения frontend сервиса
const baseURL = (import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api');

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
