import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { BankLogo } from '../components/common/BankLogo';
import { notificationListenerBridge } from '../native/notificationListener';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { MAJOR_BANKS } from '../core/banks/bankCatalog';
import { 
  ShieldCheck, 
  Smartphone, 
  ExternalLink, 
  Wallet
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

  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [monitoredBanks, setMonitoredBanks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MAJOR_BANKS.forEach(b => {
      initial[b.id] = true;
    });
    return initial;
  });

  useEffect(() => {
    notificationListenerBridge.isPermissionGranted().then(setIsPermissionGranted);
  }, []);

  const handleRequestPermission = async () => {
    const granted = await notificationListenerBridge.requestPermission();
    setIsPermissionGranted(granted);
  };

  const monitoredBankList = MAJOR_BANKS.filter(b => b.id !== 'cash');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.textPrimary }}>
          Detector de Transações
        </h2>
        <p style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
          Captura automática de gastos, destinatários e saldos via notificações bancárias no Android
        </p>
      </div>

      {/* Compromisso de Privacidade e Processamento Local */}
      <Card
        style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.primary,
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={20} />
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.primaryLight, marginBottom: '2px' }}>
              Privacidade Absoluta: Processamento 100% no Aparelho
            </h4>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4' }}>
              O leitor do Sobra extrai valores, estabelecimentos e saldos localmente usando o{' '}
              <strong>NotificationListenerService</strong> do Android. Nenhum dado do seu cartão,
              senha ou notificação é enviado para a nuvem.
            </p>
          </div>
        </div>
      </Card>

      {/* Status da Permissão Nativa no Android */}
      <Card style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: isPermissionGranted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPermissionGranted ? colors.income : colors.expense,
              }}
            >
              <Smartphone size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
                  Acesso a Notificações
                </h4>
                <Badge variant={isPermissionGranted ? 'income' : 'expense'} size="sm">
                  {isPermissionGranted ? 'Ativo no Android' : 'Não Ativado'}
                </Badge>
              </div>
              <p style={{ fontSize: '0.78rem', color: colors.textSecondary, marginTop: '2px' }}>
                {isPermissionGranted
                  ? 'O serviço em segundo plano está pronto para detectar compras em tempo real.'
                  : 'Necessário autorizar nas configurações de Acesso a Notificações do Android.'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={isPermissionGranted ? 'secondary' : 'primary'}
            icon={<ExternalLink size={14} />}
            onClick={handleRequestPermission}
          >
            {isPermissionGranted ? 'Reconfigurar Permissão' : 'Ativar Permissão'}
          </Button>
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
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <BankLogo bankId={pending.bankId || pending.bankName} size={38} />

                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary }}>
                      {pending.parsedMerchant}
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
                  variant="primary"
                  onClick={() => onOpenReviewModal(pending.id)}
                >
                  Revisar e Lançar
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Aplicativos Bancários Monitorados */}
      <Card style={{ padding: '18px 20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '4px' }}>
          Apps Bancários Monitorados
        </h3>
        <p style={{ fontSize: '0.78rem', color: colors.textSecondary, marginBottom: '14px' }}>
          Habilite os bancos que terão notificações lidas e interpretadas localmente no Android:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          {monitoredBankList.map(bank => (
            <div
              key={bank.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BankLogo bankId={bank.id} size={28} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                  {bank.name}
                </span>
              </div>

              <input
                type="checkbox"
                checked={!!monitoredBanks[bank.id]}
                onChange={e => {
                  setMonitoredBanks(prev => ({ ...prev, [bank.id]: e.target.checked }));
                }}
                style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
