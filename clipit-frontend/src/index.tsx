import './index.css';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MotionConfig } from 'framer-motion';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { queryPersister } from './lib/queryPersister';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: 1000 * 60 * 60 * 24,
      buster: 'clipit-query-cache-v1',
    }}
  >
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </PersistQueryClientProvider>,
);
