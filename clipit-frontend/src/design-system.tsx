import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { DesignSystemPage } from './pages/DesignSystemPage';

createRoot(document.getElementById('root')!).render(<StrictMode><DesignSystemPage /></StrictMode>);
