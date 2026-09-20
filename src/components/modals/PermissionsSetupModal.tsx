import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { notificationListenerBridge, ServiceStatus } from '../../native/notificationListener';

interface PermissionsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish?: () => void;
}

export const PERMISSIONS_SETUP_KEY = 'sobra_permissions_setup_completed_v1';

export const PermissionsSetupModal: React.FC<PermissionsSetupModalProps> = ({
  isOpen,
  onClose,
  onFinish,
}) => {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    granted: false,
    connected: false,
    isIgnoringBattery: false,
  });

  const [isUpdating, setIsUpdating] = useState(false);

  // Status derivados
  const isPermissionGranted = !!serviceStatus.granted;
  const isBatteryOptimized = !!serviceStatus.isIgnoringBattery;
  const isNotificationsEnabled = serviceStatus.notificationsEnabled !== false;

  // As 3 autorizações essenciais para detecção automática
  const isAllConfigured = isPermissionGranted && isBatteryOptimized && isNotificationsEnabled;

  const loadStatus = useCallback(async () => {
    try {
      const status = await notificationListenerBridge.getServiceStatus();
      setServiceStatus(status);
    } catch (e) {
      console.warn('Erro ao verificar status de permissões:', e);
    }
  }, []);

  // Monitora o status das permissões periodicamente e sempre que o app ganha foco
  useEffect(() => {
    if (!isOpen) return;

    loadStatus();
    const interval = setInterval(loadStatus, 2000);

    const handleFocus = () => {
      loadStatus();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [isOpen, loadStatus]);

  if (!isOpen) return null;

  // Handlers para cada permissão nativa
  const handleRequestListenerPermission = async () => {
    setIsUpdating(true);
    try {
      await notificationListenerBridge.requestPermission();
    } finally {
      setTimeout(() => {
        loadStatus();
        setIsUpdating(false);
      }, 800);
    }
  };

  const handleRequestNotificationPermission = async () => {
    setIsUpdating(true);
    try {
      await notificationListenerBridge.requestNotificationPermission();
    } finally {
      setTimeout(() => {
        loadStatus();
        setIsUpdating(false);
      }, 800);
    }
  };

  const handleRequestBattery = async () => {
    setIsUpdating(true);
    try {
      await notificationListenerBridge.requestIgnoreBatteryOptimization();
    } finally {
      setTimeout(() => {
        loadStatus();
        setIsUpdating(false);
      }, 800);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(PERMISSIONS_SETUP_KEY, 'true');
    if (onFinish) onFinish();
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(PERMISSIONS_SETUP_KEY, 'true');
    onClose();
  };

  const items = [
    {
      id: 'notifications_listener',
      title: 'Ler Notificações',
      description: 'Identifica avisos de compras dos seus cartões e bancos',
      isGranted: isPermissionGranted,
      action: handleRequestListenerPermission,
    },
    {
      id: 'system_notifications',
      title: 'Alertas no Celular',
      description: 'Notifica você para categorizar o gasto com um toque',
      isGranted: isNotificationsEnabled,
      action: handleRequestNotificationPermission,
    },
    {
      id: 'battery_optimization',
      title: 'Segundo Plano',
      description: 'Mantém a leitura ativa mesmo com o Sobra fechado',
      isGranted: isBatteryOptimized,
      action: handleRequestBattery,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '410px',
          backgroundColor: '#0D110E',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '28px',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(34, 197, 94, 0.06)',
          padding: '28px 18px 22px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Glow sutil esmeralda de fundo */}
        <div
          style={{
            position: 'absolute',
            top: '-70px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '240px',
            height: '140px',
            borderRadius: '50%',
            backgroundColor: isAllConfigured ? 'rgba(34, 197, 94, 0.14)' : 'rgba(255, 255, 255, 0.04)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            transition: 'background-color 0.4s ease',
          }}
        />

        {/* Topo Pierre: Direto, sem escudo e sem excesso de altura */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#4ADE80',
              marginBottom: '6px',
            }}
          >
            Passo 2 de 2 • Autorizações
          </div>

          <h2
            style={{
              fontSize: '1.42rem',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '0 0 8px 0',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            Captura Automática
          </h2>

          <p
            style={{
              fontSize: '0.84rem',
              color: '#94A3B8',
              margin: 0,
              lineHeight: 1.45,
              maxWidth: '340px',
            }}
          >
            Sempre que o seu banco notificar uma compra no cartão, o Sobra registra a despesa automaticamente.
          </p>
        </div>

        {/* Lista Unificada Pierre (iOS Settings Style) */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '14px',
          }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                  gap: '14px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: item.isGranted ? '#FFFFFF' : '#F4F4F5',
                      lineHeight: 1.25,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#8E8E93',
                      marginTop: '3px',
                      lineHeight: 1.35,
                    }}
                  >
                    {item.description}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {item.isGranted ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(34, 197, 94, 0.12)',
                        color: '#22C55E',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Ativo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={item.action}
                      disabled={isUpdating}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#0A0F0D',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      Ativar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Explicação breve e tranquila Pierre (sem caixa vermelha) */}
        <div
          style={{
            fontSize: '0.74rem',
            color: '#71717A',
            textAlign: 'center',
            lineHeight: 1.4,
            marginBottom: '22px',
            padding: '0 8px',
          }}
        >
          Sem essas autorizações, suas compras <span style={{ color: '#A1A1AA', fontWeight: 600 }}>não serão detectadas</span> automaticamente pelo Sobra.
        </div>

        {/* Ações Finais */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {/* Botão Principal: Apagado até autorizar tudo, vibrante quando pronto */}
          <button
            type="button"
            onClick={isAllConfigured ? handleComplete : undefined}
            disabled={!isAllConfigured}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '16px',
              backgroundColor: isAllConfigured ? '#22C55E' : 'rgba(255, 255, 255, 0.05)',
              border: isAllConfigured ? 'none' : '1px solid rgba(255, 255, 255, 0.07)',
              color: isAllConfigured ? '#05130A' : '#52525B',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isAllConfigured ? 'pointer' : 'not-allowed',
              boxShadow: isAllConfigured ? '0 6px 20px rgba(34, 197, 94, 0.3)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isAllConfigured ? 1 : 0.65,
            }}
          >
            {isAllConfigured ? (
              <>
                <span>Tudo Pronto, Entrar no Sobra</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </>
            ) : (
              <span>Autorize os itens acima</span>
            )}
          </button>

          {/* Botão Secundário: Sem destaque algum */}
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 12px',
              color: '#52525B',
              fontSize: '0.74rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#71717A'}
            onMouseLeave={e => e.currentTarget.style.color = '#52525B'}
          >
            configurar mais tarde
          </button>
        </div>
      </div>
    </div>
  );
};
