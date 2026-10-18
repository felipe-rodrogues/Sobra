import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './theme/index.css';

// Sinaliza plataforma nativa móvel para aplicar safe areas com segurança garantida
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native');
  document.body.classList.add('is-native');
}

// Previne menu de contexto do navegador ao segurar o dedo (experiência 100% nativa de app)
// Mantém comportamento padrão de seleção e edição apenas em inputs, textareas e campos editáveis
window.addEventListener(
  'contextmenu',
  (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"], .selectable-text, .allow-context-menu')) {
      return;
    }
    e.preventDefault();
  },
  { passive: false }
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <FinanceProvider>
            <App />
          </FinanceProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
