import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { BankLogo } from '../components/common/BankLogo';
import { notificationListenerBridge, ServiceStatus, DiagnosticLogEvent } from '../native/notificationListener';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  ShieldCheck, 
  Smartphone, 
  ExternalLink, 
  Wallet,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Activity,
  CreditCard,
  Filter,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { PendingNotification } from '../core/types';
import { SwipeBackView } from '../components/common/SwipeBackView';

interface NotificationDetectorScreenProps {
  onOpenReviewModal: (id: string) => void;
  onBack?: () => void;
}

export const NotificationDetectorScreen: React.FC<NotificationDetectorScreenProps> = ({
  onOpenReviewModal,
  onBack,
}) => {
  const { 
    pendingNotifications,
    onlyRegisteredBanks,
    autoAddCreditToInvoice,
    toggleOnlyRegisteredBanks,
    toggleAutoAddCreditToInvoice,
  } = useFinance();
  const { colors } = useTheme();

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    granted: false,
    connected: false,
    isIgnoringBattery: false,
  });
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEvent[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isPermissionGranted = !!serviceStatus.granted;
  const isServiceConnected = !!serviceStatus.connected;
  const isBatteryOptimized = !!serviceStatus.isIgnoringBattery;

  const isAllConfigured = isPermissionGranted && isServiceConnected && isBatteryOptimized;
  const hasPendingAction = !isAllConfigured;
  const pendingCount = (!isPermissionGranted ? 1 : 0) + (!isServiceConnected ? 1 : 0) + (!isBatteryOptimized ? 1 : 0);

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

  const handleSyncQueue = async () => {
    setIsSyncing(true);
    try {
      await notificationListenerBridge.syncPendingNotifications();
      await loadStatusAndLogs();
      setFeedbackMessage('Fila de notificações sincronizada!');
    } catch (e) {
      setFeedbackMessage('Erro ao sincronizar fila.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleClearLogs = async () => {
    await notificationListenerBridge.clearDiagnosticLogs();
    setDiagnosticLogs([]);
  };

  const renderStatusItems = () => (
    <div
      style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Item 1: Leitura de Notificações */}
      <div
        className="animate-item-stagger-1"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: serviceStatus.granted ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: serviceStatus.granted ? '#22C55E' : '#94A3B8',
            }}
          >
            <Smartphone size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.25 }}>
              Leitura de Notificações
            </div>
            <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '1px', lineHeight: 1.3 }}>
              Permissão para ler avisos dos bancos
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {serviceStatus.granted ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#22C55E',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              Ativo ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestPermission}
              style={{
                backgroundColor: '#22C55E',
                color: '#0A0E0C',
                fontWeight: 700,
                fontSize: '0.76rem',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#16A34A'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22C55E'}
            >
              Conceder
            </button>
          )}
        </div>
      </div>

      {/* Item 2: Captura com App Fechado (Serviço em Segundo Plano) */}
      <div
        className="animate-item-stagger-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: serviceStatus.connected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: serviceStatus.connected ? '#22C55E' : '#F59E0B',
            }}
          >
            <Activity size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.25 }}>
              Captura com App Fechado
            </div>
            <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '1px', lineHeight: 1.3 }}>
              Registra gastos mesmo com o Sobra fechado
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {serviceStatus.connected ? (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  color: '#22C55E',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                Ativo ✓
              </span>
              <button
                type="button"
                onClick={handleReconnect}
                disabled={isReconnecting}
                title="Reconectar leitor no Android se necessário"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={12} className={isReconnecting ? 'spin' : ''} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReconnect}
              disabled={isReconnecting}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0A0E0C',
                fontWeight: 700,
                fontSize: '0.76rem',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isReconnecting ? 'Conectando...' : 'Reconectar'}
            </button>
          )}
        </div>
      </div>

      {/* Item 3: Bateria sem Restrições */}
      <div
        className="animate-item-stagger-3"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 4px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: serviceStatus.isIgnoringBattery ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: serviceStatus.isIgnoringBattery ? '#22C55E' : '#60A5FA',
            }}
          >
            <Zap size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.25 }}>
              Bateria sem Restrições
            </div>
            <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '1px', lineHeight: 1.3 }}>
              Impede o sistema de suspender o leitor
            </div>
          </div>
        </div>


        <div style={{ flexShrink: 0 }}>
          {serviceStatus.isIgnoringBattery ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#22C55E',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              Ativo ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestIgnoreBattery}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.76rem',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Liberar
            </button>
          )}
        </div>
      </div>

      {/* Dicas e Privacidade */}
      <div
        className="animate-item-stagger-4"
        style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingLeft: '4px',
          paddingRight: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.73rem', color: '#94A3B8', lineHeight: 1.35 }}>
          <HelpCircle size={14} color="#60A5FA" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Dica Samsung:</strong> adicione o Sobra aos <em>"Apps que nunca entram em suspensão"</em> na bateria.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.71rem', color: '#64748B', lineHeight: 1.35 }}>
          <ShieldCheck size={14} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>Processamento 100% no seu celular. Nenhum dado é enviado para a internet.</span>
        </div>
      </div>
    </div>
  );

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
        {/* Header Superior com Botão Voltar, Status e Sincronização */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Voltar"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
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
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.textPrimary, margin: 0, lineHeight: 1.2 }}>
                  Detector de Transações
                </h2>
                {isAllConfigured && (
                  <span
                    className="animate-fade-in"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.28)',
                      color: '#22C55E',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <span
                      className="animate-status-pulse"
                      style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }}
                    />
                    Leitura Ativa
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                Captura automática de gastos e saldos via notificações bancárias
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncQueue}
            disabled={isSyncing}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '7px 12px',
              color: '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSyncing ? 'default' : 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
            title="Sincronizar fila de notificações"
          >
            <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
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
            {pendingNotifications.map((pending: PendingNotification) => (
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
            ))}
          </div>
        </div>
      )}

      {/* Card de Configuração Nativo do Leitor (Estilo Nubank / Pierre / iOS Widget) */}
      {hasPendingAction && (
        <div
          className="card-sobra animate-slide-up"
          style={{
            padding: '12px 14px',
            border: '1px solid rgba(245, 158, 11, 0.22)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Cabeçalho Clicável Nativo (Sem caixas extras ou botões que roubam espaço) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {/* Ícone suave no padrão de ícones do app */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={19} strokeWidth={2.2} />
              </div>

              {/* Título e Subtítulo com quebra natural, sem trucamento rígido */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.92rem',
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
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                    marginTop: '2px',
                    lineHeight: 1.3,
                  }}
                >
                  {pendingCount === 1
                    ? 'Falta 1 permissão para capturar compras'
                    : `Faltam ${pendingCount} permissões para capturar compras`}
                </div>
              </div>
            </div>

            {/* Chevron Compacto Circular (libera mais de 50px de largura para os textos) */}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 0.15s ease',
              }}
            >
              <ChevronDown
                size={16}
                style={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>

          {/* Conteúdo Expandido Nativo com animação fluida */}
          {isExpanded && (
            <div className="animate-accordion-expand">
              {renderStatusItems()}
            </div>
          )}
        </div>
      )}

      {/* Preferências de Captura Inteligente */}
      <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
            Preferências de Captura Inteligente
          </h3>
          <p style={{ fontSize: '0.76rem', color: colors.textSecondary, margin: '3px 0 0 0' }}>
            Ajuste o comportamento do Sobra ao identificar gastos e recebimentos
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Opção 1: Lançar compras de cartão direto na fatura */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <CreditCard size={18} color="#38BDF8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                  Lançar Compras no Cartão Direto na Fatura
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary }}>
                  Compras no crédito de bancos cadastrados entram na fatura sem exigir aprovação manual
                </div>
              </div>
            </div>

            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '42px',
                height: '24px',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={autoAddCreditToInvoice}
                onChange={(e) => toggleAutoAddCreditToInvoice(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: autoAddCreditToInvoice ? '#22C55E' : 'rgba(255, 255, 255, 0.15)',
                  transition: '0.2s',
                  borderRadius: '24px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: autoAddCreditToInvoice ? '20px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#FFFFFF',
                    transition: '0.2s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Opção 2: Filtrar apenas bancos cadastrados */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <Filter size={18} color="#A78BFA" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                    Filtrar Apenas Bancos Cadastrados
                  </span>
                  {onlyRegisteredBanks && (
                    <Badge variant="primary" size="sm">
                      Ativo
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary }}>
                  Ignora notificações de bancos ou carteiras que você ainda não vinculou às suas contas
                </div>
              </div>
            </div>

            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '42px',
                height: '24px',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={onlyRegisteredBanks}
                onChange={(e) => toggleOnlyRegisteredBanks(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: onlyRegisteredBanks ? '#22C55E' : 'rgba(255, 255, 255, 0.15)',
                  transition: '0.2s',
                  borderRadius: '24px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: onlyRegisteredBanks ? '20px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#FFFFFF',
                    transition: '0.2s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* Detalhes do status quando tudo estiver configurado (Pierre style: silencioso, discreto) */}
      {isAllConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
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
            onMouseEnter={e => e.currentTarget.style.color = '#94A3B8'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
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

      {/* Histórico em Tempo Real de Notificações Recebidas (Diagnóstico) */}
      <Card style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
              Histórico de Notificações Recebidas pelo Sistema
            </h3>
            <p style={{ fontSize: '0.78rem', color: colors.textSecondary }}>
              Log transparente das últimas notificações entregues pelo Android ao leitor do Sobra:
            </p>
          </div>

          {diagnosticLogs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={13} />}
              onClick={handleClearLogs}
            >
              Limpar
            </Button>
          )}
        </div>

        {diagnosticLogs.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', fontSize: '0.8rem', color: colors.textSecondary }}>
            Nenhuma notificação capturada recentemente pelo leitor nativo. Assim que seu banco emitir uma notificação, ela aparecerá aqui em tempo real.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {diagnosticLogs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: colors.surfaceElevated,
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: colors.textPrimary }}>
                    {log.title || log.packageName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: colors.textSecondary }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge
                      size="sm"
                      variant={
                        log.status === 'captured'
                          ? 'income'
                          : log.status === 'debounced'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {log.status === 'captured'
                        ? 'Capturada'
                        : log.status === 'debounced'
                        ? 'Debounce (Duplicata OS)'
                        : log.status}
                    </Badge>
                  </div>
                </div>

                <div style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                  "{log.text}"
                </div>

                <div style={{ fontSize: '0.68rem', color: colors.textSecondary, opacity: 0.8 }}>
                  Pacote: {log.packageName}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </SwipeBackView>
  );
};
