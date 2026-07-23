import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import { HelpProvider } from './contexts/HelpContext';
import { AppRoutes } from './routes/AppRoutes';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppearanceProvider>
          <ThemeProvider>
            <AuthProvider>
              <HelpProvider>
                <AppRoutes />
              </HelpProvider>
            </AuthProvider>
          </ThemeProvider>
        </AppearanceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
