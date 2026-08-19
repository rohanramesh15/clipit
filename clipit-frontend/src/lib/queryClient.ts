import { QueryClient } from '@tanstack/react-query';

// This cache is intentionally long-lived. Data is refreshed explicitly after
// mutations, rather than on every mount, focus change, or return visit.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});
