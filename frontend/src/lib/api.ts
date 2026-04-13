import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// Attach JWT from memory on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// In-memory token store (never localStorage for security)
let _token: string | null = null;

export const setToken = (t: string | null) => { _token = t; };
export const getToken = () => _token;

export default api;
