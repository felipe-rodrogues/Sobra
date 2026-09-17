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
  Activity
} from 'lucide-react';
import { PendingNotification } from '../core/types';

interface NotificationDetectorScreenProps {
  onOpenReviewModal: (id: string) => void;
}

export const NotificationDetectorScreen: React.FC<NotificationDetectorScreenProps> = ({
  onOpenReviewModal,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.textPrimary }}>
          Detector de Transações
        </h2>
        <p style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
          Captura automática de gastos e saldos via notificações bancárias com processamento 100% no aparelho
        </p>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                        {pending.bankName} • <strong>{formatBrlCurrency(pending.parsedAmount)}</strong>
                      </span>
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

      {/* Status da Leitura Automática (Design Unificado & Humanizado estilo Pierre) */}
      <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Cabeçalho do Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Ícone solto sem caixinha — dot de status embaixo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {serviceStatus.granted && serviceStatus.connected ? (
                <CheckCircle2 size={22} color="#22C55E" strokeWidth={1.8} />
              ) : (
                <AlertTriangle size={22} color="#F59E0B" strokeWidth={1.8} />
              )}
              {/* Dot de status pulsante */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-3px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: serviceStatus.granted && serviceStatus.connected
                    ? '#22C55E'
                    : '#F59E0B',
                  border: '1.5px solid #0D1410',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: colors.textPrimary, margin: 0, lineHeight: 1.2 }}>
                {serviceStatus.granted && serviceStatus.connected
                  ? 'Leitura Automática Ativa'
                  : 'Configuração Necessária'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: colors.textSecondary, margin: '3px 0 0 0', lineHeight: 1.3 }}>
                {serviceStatus.granted && serviceStatus.connected
                  ? 'Capturando compras e faturas em tempo real'
                  : 'Autorize o Sobra para capturar notificações do celular'}
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
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSyncing ? 'default' : 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
            title="Sincronizar fila de notificações"
          >
            <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>

        {/* Lista de Preferências & Ajustes do Sistema */}
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
          {/* Linha 1: Leitura de Notificações */}
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
              <Smartphone size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                  Acesso a Notificações
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary }}>
                  Autorização para registrar compras recebidas
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {serviceStatus.granted ? (
                <>
                  <Badge variant="income" size="sm">
                    Autorizado
                  </Badge>
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: '3px 6px',
                      textDecoration: 'underline',
                    }}
                  >
                    Revisar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  style={{
                    backgroundColor: '#22C55E',
                    color: '#0A0E0C',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Conceder
                </button>
              )}
            </div>
          </div>

          {/* Linha 2: Conexão com o Sistema Android */}
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
              <Activity size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                  Serviço em Segundo Plano
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary }}>
                  Escuta contínua de compras no aparelho
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {serviceStatus.connected ? (
                <>
                  <Badge variant="income" size="sm">
                    Conectado
                  </Badge>
                  <button
                    type="button"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    title="Atualizar conexão com o sistema"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: '4px',
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
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {isReconnecting ? 'Conectando...' : 'Reconectar'}
                </button>
              )}
            </div>
          </div>

          {/* Linha 3: Otimização de Bateria */}
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
              <Zap size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary }}>
                  Otimização de Bateria
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary }}>
                  Evita suspensão pelo sistema com a tela apagada
                </div>
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              {serviceStatus.isIgnoringBattery ? (
                <Badge variant="income" size="sm">
                  Sem Restrições
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestIgnoreBattery}
                  style={{
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Liberar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé: Dica Samsung & Compromisso de Privacidade Local */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.73rem', color: '#94A3B8', lineHeight: 1.3 }}>
            <HelpCircle size={14} color="#60A5FA" style={{ flexShrink: 0 }} />
            <span>
              <strong>Dica Samsung:</strong> adicione o Sobra em <em>"Aplicativos que nunca entram em suspensão"</em> nas configurações de bateria.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: '#64748B', lineHeight: 1.3 }}>
            <ShieldCheck size={14} color="#22C55E" style={{ flexShrink: 0 }} />
            <span>Processamento 100% no seu aparelho. Nenhum dado de cartão, senha ou notificação é enviado para servidores.</span>
          </div>
        </div>
      </Card>

      {/* Notificações Pendentes de Revisão */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                        {pending.bankName} • <strong>{formatBrlCurrency(pending.parsedAmount)}</strong>
                      </span>
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
  );
};
