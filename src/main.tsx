import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { Capacitor } from '@capacitor/core';
import './theme/index.css';

// Sinaliza plataforma nativa móvel para aplicar safe areas com segurança garantida
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native');
  document.body.classList.add('is-native');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <FinanceProvider>
          <App />
        </FinanceProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
