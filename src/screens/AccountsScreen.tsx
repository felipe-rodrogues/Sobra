import React, { useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BankLogo } from '../components/common/BankLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  Plus, 
  ArrowLeft,
  Wallet
} from 'lucide-react';
import { Account } from '../core/types';

interface AccountsScreenProps {
  onBack?: () => void;
  onOpenNewAccount: () => void;
  onEditAccount?: (acc: Account) => void;
  onOpenTransfer?: () => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onBack,
  onOpenNewAccount,
  onEditAccount,
}) => {
  const { accounts, isPrivacyMode } = useFinance();

  // Garante que a tela sempre inicie rolada no topo
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Filtra apenas contas bancárias, contas correntes, poupanças e dinheiro físico (sem cartões de crédito)
  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');

  // Saldo total disponível em contas
  const totalCash = bankAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return 'Conta Corrente';
      case 'savings': return 'Poupança / Reserva';
      case 'investment': return 'Investimentos';
      case 'cash': return 'Dinheiro em Espécie';
      default: return 'Conta Bancária';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '40px' }}>
      {/* ─────────────────────────────────────────────────────────────
          1. CABEÇALHO SUPERIOR PADRONIZADO (VOLTAR + NOVA CONTA (+))
         ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
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

        {/* Botão circular verde (+) para adicionar nova conta */}
        <button
          type="button"
          onClick={onOpenNewAccount}
          title="Nova conta bancária"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#4ADE80',
            border: 'none',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            marginLeft: 'auto',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Plus size={24} strokeWidth={2.6} />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TÍTULO E SALDO TOTAL EM CONTAS (ESTILO PIERRE / SOBRA)
         ───────────────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            fontSize: '2.05rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          Contas Bancárias
        </h1>
        <p style={{ fontSize: '0.84rem', color: '#8E8E93', margin: '4px 0 0 0' }}>
          {bankAccounts.length} conta{bankAccounts.length !== 1 ? 's' : ''} e carteira{bankAccounts.length !== 1 ? 's' : ''} cadastrada{bankAccounts.length !== 1 ? 's' : ''}
        </p>

        {/* Destaque Numérico Calmo */}
        <div style={{ marginTop: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Saldo total disponível
          </span>
          <div
            style={{
              fontSize: '2.35rem',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginTop: '4px',
            }}
          >
            {maskValue(formatBrlCurrency(totalCash))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LISTA LIMPA DE CONTAS BANCÁRIAS (SEM POLUIÇÃO VISUAL)
         ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {bankAccounts.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '20px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              color: '#8E8E93',
              fontSize: '0.88rem',
            }}
          >
            <Wallet size={28} color="#64748B" style={{ margin: '0 auto 10px', display: 'block' }} />
            Nenhuma conta corrente ou carteira cadastrada.
          </div>
        ) : (
          bankAccounts.map((acc: Account) => (
            <div
              key={acc.id}
              onClick={() => onEditAccount && onEditAccount(acc)}
              style={{
                backgroundColor: '#121316',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '18px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: onEditAccount ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => {
                if (onEditAccount) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }
              }}
              onMouseLeave={e => {
                if (onEditAccount) {
                  e.currentTarget.style.backgroundColor = '#121316';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                }
              }}
            >
              {/* Lado Esquerdo: Logo do Banco e Detalhes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <BankLogo bankId={acc.bankId || acc.name} size={26} />
                </div>

                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '0.98rem',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acc.name}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#8E8E93', marginTop: '2px' }}>
                    {getAccountTypeLabel(acc.type)}
                  </div>
                </div>
              </div>

              {/* Lado Direito: Saldo da Conta */}
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {maskValue(formatBrlCurrency(acc.balance))}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                  Disponível
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
