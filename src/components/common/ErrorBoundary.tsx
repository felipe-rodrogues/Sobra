import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado na árvore de renderização:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#090D0B',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 999999,
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#111713',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '24px',
              padding: '28px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                marginBottom: '16px',
              }}
            >
              <AlertTriangle size={30} />
            </div>

            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: '0 0 8px 0',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Ops! Algo deu errado
            </h2>

            <p
              style={{
                fontSize: '0.85rem',
                color: '#94A3B8',
                lineHeight: 1.45,
                margin: '0 0 24px 0',
              }}
            >
              Ocorreu uma instabilidade pontual na interface, mas suas contas e dados financeiros continuam 100% seguros e preservados.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '14px',
                  backgroundColor: '#4ADE80',
                  color: '#0A150D',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(74, 222, 128, 0.25)',
                }}
              >
                <RefreshCw size={16} />
                <span>Recarregar Aplicativo</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  width: '100%',
                  padding: '11px 18px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#E2E8F0',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Home size={16} />
                <span>Tentar Recuperar Tela</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
