import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { BankLogo } from '../components/common/BankLogo';
import { notificationListenerBridge, ServiceStatus, DiagnosticLogEvent } from '../native/notificationListener';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { notificationEngine, isPromotionalOrMarketing } from '../core/parsers/notificationEngine';
import { 
  ShieldCheck, 
  Smartphone, 
  ExternalLink, 
  Wallet,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Activity,
  CreditCard,
  ArrowLeft,
  ChevronDown,
  Bell
} from 'lucide-react';
import { PendingNotification } from '../core/types';
import { SwipeBackView } from '../components/common/SwipeBackView';

interface NotificationDetectorScreenProps {
  onOpenReviewModal: (id: string) => void;
  onOpenCreateAccountForNotification?: (notification: PendingNotification) => void;
  onBack?: () => void;
}

export const NotificationDetectorScreen: React.FC<NotificationDetectorScreenProps> = ({
  onOpenReviewModal,
  onOpenCreateAccountForNotification,
  onBack,
}) => {
  const { pendingNotifications } = useFinance();
  const { colors } = useTheme();

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    granted: false,
    connected: false,
    isIgnoringBattery: false,
  });
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEvent[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isPermissionGranted = !!serviceStatus.granted;
  const isServiceConnected = !!serviceStatus.connected;
  const isBatteryOptimized = !!serviceStatus.isIgnoringBattery;
  const isNotificationsEnabled = serviceStatus.notificationsEnabled !== false;

  const isAllConfigured = isPermissionGranted && isServiceConnected && isBatteryOptimized && isNotificationsEnabled;
  const hasPendingAction = !isAllConfigured;
  const pendingCount = (!isPermissionGranted ? 1 : 0) + (!isServiceConnected ? 1 : 0) + (!isBatteryOptimized ? 1 : 0) + (!isNotificationsEnabled ? 1 : 0);

  const loadStatusAndLogs = useCallback(async () => {
    try {
      const status = await notificationListenerBridge.getServiceStatus();
      setServiceStatus(status);
      const logs = await notificationListenerBridge.getDiagnosticLogs();
      setDiagnosticLogs(logs);
    } catch (e) {
      console.warn('Erro ao ler status e logs:', e);
    }
  }, []);

  useEffect(() => {
    loadStatusAndLogs();
    const interval = setInterval(loadStatusAndLogs, 4000);
    return () => clearInterval(interval);
  }, [loadStatusAndLogs]);

  const handleRequestPermission = async () => {
    await notificationListenerBridge.requestPermission();
    setTimeout(loadStatusAndLogs, 1000);
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const ok = await notificationListenerBridge.reconnectService();
      if (ok) {
        setFeedbackMessage('Comando de reconexão disparado com sucesso no Android!');
      } else {
        setFeedbackMessage('Aviso: o sistema está em processo de re-vínculo.');
      }
      setTimeout(loadStatusAndLogs, 800);
    } catch (e) {
      setFeedbackMessage('Falha ao disparar reconexão nativa.');
    } finally {
      setIsReconnecting(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleRequestIgnoreBattery = async () => {
    await notificationListenerBridge.requestIgnoreBatteryOptimization();
    setTimeout(loadStatusAndLogs, 1500);
  };

  const handleRequestNotificationPermission = async () => {
    await notificationListenerBridge.requestNotificationPermission();
    setTimeout(loadStatusAndLogs, 1000);
  };

  const handleClearLogs = async () => {
    await notificationListenerBridge.clearDiagnosticLogs();
    setDiagnosticLogs([]);
  };

  const renderStatusItems = () => (
    <div
      style={{
        marginTop: '12px',
        paddingTop: '6px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Item 1: Leitura de Notificações */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '14px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: serviceStatus.granted ? '#FFFFFF' : '#F4F4F5', lineHeight: 1.25 }}>
            Leitura de Notificações
          </div>
          <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '3px', lineHeight: 1.35 }}>
            Permissão para ler avisos de compras dos bancos
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {serviceStatus.granted ? (
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
              onClick={handleRequestPermission}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0A0E0C',
                fontWeight: 800,
                fontSize: '0.76rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.28)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
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
              Conceder
            </button>
          )}
        </div>
      </div>

      {/* Item 2: Captura com App Fechado */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '14px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: serviceStatus.connected ? '#FFFFFF' : '#F4F4F5', lineHeight: 1.25 }}>
            Captura com App Fechado
          </div>
          <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '3px', lineHeight: 1.35 }}>
            Registra gastos mesmo com o Sobra fechado
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {serviceStatus.connected ? (
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
              onClick={handleReconnect}
              disabled={isReconnecting}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0A0E0C',
                fontWeight: 800,
                fontSize: '0.76rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.28)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
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
              {isReconnecting ? 'Conectando...' : 'Reconectar'}
            </button>
          )}
        </div>
      </div>

      {/* Item 3: Bateria sem Restrições */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '14px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: serviceStatus.isIgnoringBattery ? '#FFFFFF' : '#F4F4F5', lineHeight: 1.25 }}>
            Bateria sem Restrições
          </div>
          <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '3px', lineHeight: 1.35 }}>
            Impede o sistema de suspender o leitor em segundo plano
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {serviceStatus.isIgnoringBattery ? (
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
              onClick={handleRequestIgnoreBattery}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0A0E0C',
                fontWeight: 800,
                fontSize: '0.76rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.28)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
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
              Liberar
            </button>
          )}
        </div>
      </div>

      {/* Item 4: Alertas de Compras no Celular */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '14px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isNotificationsEnabled ? '#FFFFFF' : '#F4F4F5', lineHeight: 1.25 }}>
            Alertas de Compras no Celular
          </div>
          <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '3px', lineHeight: 1.35 }}>
            Notifica novas compras para editar com um toque
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {isNotificationsEnabled ? (
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
              onClick={handleRequestNotificationPermission}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0A0E0C',
                fontWeight: 800,
                fontSize: '0.76rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.28)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
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

      {/* Dicas e Privacidade */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ fontSize: '0.74rem', color: '#8E8E93', lineHeight: 1.4 }}>
          <strong style={{ color: '#E4E4E7' }}>Dica Samsung:</strong> adicione o Sobra aos <em>"Apps que nunca entram em suspensão"</em> na bateria.
        </div>

        <div style={{ fontSize: '0.72rem', color: '#71717A', lineHeight: 1.4 }}>
          Processamento 100% no seu celular. Nenhum dado é enviado para a internet.
        </div>
      </div>
    </div>
  );

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
        {/* Header Superior: Barra de navegação com Voltar à esquerda, Título centralizado e Ação à direita */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            paddingTop: '4px',
            minHeight: '42px',
          }}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                zIndex: 2,
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.transform = 'scale(1.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <ArrowLeft size={19} />
            </button>
          ) : (
            <div style={{ width: '40px' }} />
          )}

          <h2
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.01em',
              pointerEvents: 'none',
            }}
          >
            Notificações
          </h2>

          <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-end', zIndex: 2 }}>
            {diagnosticLogs.length > 0 ? (
              <button
                type="button"
                onClick={handleClearLogs}
                title="Limpar histórico"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <div style={{ width: '40px' }} />
            )}
          </div>
        </div>

      {feedbackMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: colors.income,
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          {feedbackMessage}
        </div>
      )}

      {/* Notificações Pendentes de Revisão (Prioridade máxima de atenção) */}
      {pendingNotifications.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: colors.textPrimary }}>
              Transações Aguardando Sua Aprovação ({pendingNotifications.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingNotifications.map((pending: PendingNotification) => {
              if (pending.requiresAccountRegistration) {
                return (
                  <div
                    key={pending.id}
                    className="animate-slide-up"
                    style={{
                      padding: '20px',
                      borderRadius: '22px',
                      background: 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.08) 0%, #13161A 75%)',
                      border: '1.5px solid rgba(245, 158, 11, 0.35)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      position: 'relative',
                    }}
                  >
                    {/* Topo do Card: Logo + Nome do Banco & Dígitos | Badge Novo Cartão */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <BankLogo bankId={pending.bankId || pending.bankName} size={40} style={{ borderRadius: '10px', flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                              {pending.bankName}
                            </span>
                            {pending.cardLastDigits && (
                              <span
                                title={`Final ${pending.cardLastDigits}`}
                                aria-label={`Final ${pending.cardLastDigits}`}
                                style={{
                                  fontSize: '0.85rem',
                                  color: '#94A3B8',
                                  fontFamily: 'monospace',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                •••• {pending.cardLastDigits}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '3px' }}>
                            Cartão ainda não cadastrado no Sobra
                          </div>
                        </div>
                      </div>

                      {/* Badge Novo Cartão em pílula delicada */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          border: '1px solid rgba(245, 158, 11, 0.45)',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          color: '#FBBF24',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Novo Cartão
                      </span>
                    </div>

                    {/* Divisória sutil */}
                    <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.06)', margin: '2px 0' }} />

                    {/* Destaque da Compra: Estabelecimento + Valor */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            color: '#FFFFFF',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {pending.parsedMerchant}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: '1.45rem',
                            fontWeight: 800,
                            color: '#4ADE80',
                            fontFamily: "'Outfit', sans-serif",
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                          }}
                        >
                          {formatBrlCurrency(pending.parsedAmount)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '3px', fontWeight: 500 }}>
                          {pending.parsedPaymentMethod === 'credit' ? 'Crédito' : pending.parsedPaymentMethod.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Mensagem explicativa amigável */}
                    <p style={{ fontSize: '0.84rem', color: '#CBD5E1', margin: 0, lineHeight: 1.45 }}>
                      Identificamos esta compra pelo leitor. Cadastre este cartão para adicioná-la à sua fatura.
                    </p>

                    {/* Botão de Ação Full-Width */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCreateAccountForNotification) {
                          onOpenCreateAccountForNotification(pending);
                        } else {
                          onOpenReviewModal(pending.id);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '14px 18px',
                        borderRadius: '14px',
                        backgroundColor: '#22C55E',
                        color: '#0A0E0C',
                        fontWeight: 800,
                        fontSize: '0.94rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 18px rgba(34, 197, 94, 0.35)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <CreditCard size={19} strokeWidth={2.5} />
                      <span>Cadastrar Cartão & Lançar Compra</span>
                    </button>

                    {/* Link Secundário Centralizado */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenReviewModal(pending.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94A3B8',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '4px 10px',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                      >
                        Outras opções
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <Card
                  key={pending.id}
                  hoverable
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: pending.isSuspectedDuplicate ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                    backgroundColor: pending.isSuspectedDuplicate ? 'rgba(239, 68, 68, 0.03)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <BankLogo bankId={pending.bankId || pending.bankName} size={38} />

                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary }}>
                          {pending.parsedMerchant}
                        </span>
                        {pending.isSuspectedDuplicate && (
                          <Badge variant="expense" size="sm" icon={<AlertTriangle size={10} />}>
                            Possível Duplicata
                          </Badge>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                          {pending.bankName} • <strong>{formatBrlCurrency(pending.parsedAmount)}</strong>
                        </span>
                        {pending.isInstallment && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', fontWeight: 700 }}>
                            💳 {pending.installmentCount}x {pending.installmentAmount ? `de ${formatBrlCurrency(pending.installmentAmount)}` : ''}
                          </span>
                        )}
                        {pending.isFromSms && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontWeight: 700 }}>
                            SMS Bancário
                          </span>
                        )}
                        {pending.detectedBalance !== null && pending.detectedBalance !== undefined && (
                          <Badge variant="primary" size="sm" icon={<Wallet size={10} />}>
                            Saldo: {formatBrlCurrency(pending.detectedBalance)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={pending.isSuspectedDuplicate ? 'secondary' : 'primary'}
                    onClick={() => onOpenReviewModal(pending.id)}
                  >
                    {pending.isSuspectedDuplicate ? 'Verificar Alerta' : 'Revisar e Lançar'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Card de Configuração Nativo do Leitor (Padrão Pierre com Alerta Laranja) */}
      {hasPendingAction && (
        <div
          className="card-sobra animate-slide-up"
          style={{
            padding: '16px 18px',
            backgroundColor: '#0D110E',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            borderRadius: '24px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 30px rgba(245, 158, 11, 0.05)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Cabeçalho Clicável Nativo com Alerta Laranja */}
          <div
            onClick={() => setIsExpanded(prev => !prev)}
            role="button"
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
                }}
              >
                Configuração do Leitor
              </div>
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#F59E0B',
                  fontWeight: 600,
                  marginTop: '3px',
                  lineHeight: 1.3,
                }}
              >
                {pendingCount === 1
                  ? 'Falta 1 permissão'
                  : `Faltam ${pendingCount} permissões`}
              </div>
            </div>

            <ChevronDown
              size={18}
              color="#94A3B8"
              style={{
                flexShrink: 0,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* Conteúdo Expandido Nativo com animação fluida */}
          {isExpanded && (
            <div className="animate-accordion-expand">
              {renderStatusItems()}
            </div>
          )}
        </div>
      )}

      {/* Feed de Notificações Recebidas (Padrão Pierre: Clean, Direto, Sem Ruído) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {diagnosticLogs.length === 0 ? (
          <div
            style={{
              padding: '64px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Bell size={28} color="#64748B" style={{ opacity: 0.35 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8' }}>
              Nenhuma notificação recente
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {diagnosticLogs.map((log, index) => {
              const isPromo = isPromotionalOrMarketing(log.title, log.text);
              const matching = pendingNotifications.find(
                p => p.rawText === log.text || (log.text && p.parsedMerchant && log.text.includes(p.parsedMerchant))
              );
              const parsed = !isPromo ? notificationEngine.processNotification(log.title, log.text, log.packageName) : null;
              const isParsable = !isPromo && (!!matching || !!parsed);

              // Se foi registrado como captured no passado mas é promocional ou sem transação válida, exibe como ignored
              const effectiveStatus = (log.status === 'captured' && (isPromo || !isParsable)) 
                ? 'ignored' 
                : log.status;

              const displayAmount = matching?.parsedAmount ?? parsed?.amount;
              const bankId = matching?.bankId ?? parsed?.bankId ?? log.title;
              const title = matching?.bankName ?? parsed?.bankName ?? log.title ?? log.packageName;
              const merchant = matching?.parsedMerchant ?? parsed?.merchant;

              return (
                <div
                  key={log.id || `${log.timestamp}-${index}`}
                  style={{
                    padding: '14px 0',
                    borderBottom: index < diagnosticLogs.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* Linha Superior: Logo/Título + Horário + Badge de Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <BankLogo bankId={bankId} size={28} />
                      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap' }}>
                            {title}
                          </span>
                          {merchant && merchant !== title && (
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              • {merchant}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {effectiveStatus === 'captured' ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#22C55E',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            letterSpacing: '0.01em',
                          }}
                        >
                          Capturada
                        </span>
                      ) : effectiveStatus === 'debounced' ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: '#64748B',
                          }}
                        >
                          Duplicada
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: '#64748B',
                          }}
                        >
                          {isPromo ? 'Promocional' : 'Informativa'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Texto Real da Notificação */}
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#94A3B8',
                      lineHeight: 1.4,
                      paddingLeft: '38px',
                    }}
                  >
                    "{log.text}"
                  </div>

                  {/* Detalhe de Valor & Ação Rápida */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingLeft: '38px',
                      marginTop: '2px',
                    }}
                  >
                    {displayAmount ? (
                      <span
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 700,
                          color: '#4ADE80',
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        {formatBrlCurrency(displayAmount)}
                      </span>
                    ) : (
                      <div />
                    )}

                    {effectiveStatus === 'captured' && isParsable && (
                      <button
                        type="button"
                        onClick={() => {
                          if (matching) {
                            if (matching.requiresAccountRegistration && onOpenCreateAccountForNotification) {
                              onOpenCreateAccountForNotification(matching);
                            } else {
                              onOpenReviewModal(matching.id);
                            }
                          } else {
                            notificationListenerBridge.simulateNotification(log.title, log.text, log.packageName);
                          }
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          border: 'none',
                          color: '#22C55E',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)')}
                      >
                        <CreditCard size={12} />
                        <span>
                          {matching?.requiresAccountRegistration
                            ? 'Cadastrar Cartão'
                            : 'Revisar Compra'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhes do status quando tudo estiver configurado (Pierre style: silencioso, discreto) */}
      {isAllConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
          >
            <CheckCircle2 size={13} color="#22C55E" />
            <span>Status do sistema: Todos os serviços operando</span>
            <ChevronDown
              size={13}
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </button>

          {isExpanded && (
            <div
              className="animate-accordion-expand"
              style={{
                width: '100%',
                backgroundColor: '#131915',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {renderStatusItems()}
            </div>
          )}
        </div>
      )}
      </div>
    </SwipeBackView>
  );
};
