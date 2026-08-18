// Use fly.dev backend in production, localhost for dev
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (isProduction ? 'https://project-deadbird-backend.fly.dev/api' : 'http://localhost:8000/api');
