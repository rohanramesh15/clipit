// Use render.com backend in production (matches Chrome extension), localhost for dev
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (isProduction ? 'https://project-deadbird-backend.onrender.com/api' : 'http://localhost:8000/api');
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
