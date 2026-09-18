import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BankLogo } from '../components/common/BankLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  Plus, 
  ArrowLeft,
  Wallet,
  CreditCard
} from 'lucide-react';
import { Account } from '../core/types';
import { SwipeBackView } from '../components/common/SwipeBackView';

interface AccountsScreenProps {
  onBack?: () => void;
  onOpenNewAccount: (defaultType?: 'credit_card' | 'checking') => void;
  onEditAccount?: (acc: Account) => void;
  onOpenTransfer?: () => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onBack,
  onOpenNewAccount,
  onEditAccount,
}) => {
  const { accounts, isPrivacyMode } = useFinance();
  const [activeSection, setActiveSection] = useState<'accounts' | 'cards'>('accounts');

  // Garante que a tela sempre inicie rolada no topo
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Filtra contas e cartões separadamente
  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
  const creditCards = accounts.filter(a => a.type === 'credit_card');

  // Saldo total disponível em contas
  const totalCash = bankAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
  // Limite total em cartões
  const totalCreditLimit = creditCards.reduce((acc, a) => acc + (a.creditLimit || 0), 0);

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
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
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

        {/* Botão circular verde (+) para adicionar novo cadastro */}
        <button
          type="button"
          onClick={() => onOpenNewAccount(activeSection === 'cards' ? 'credit_card' : 'checking')}
          title={activeSection === 'cards' ? 'Novo cartão de crédito' : 'Nova conta bancária'}
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
          2. SELETOR DE ABA (CONTAS BANCÁRIAS vs CARTÕES DE CRÉDITO)
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          backgroundColor: '#121614',
          padding: '4px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSection('accounts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: activeSection === 'accounts' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
            backgroundColor: activeSection === 'accounts' ? '#1A231C' : 'transparent',
            color: activeSection === 'accounts' ? '#4ADE80' : '#8E8E93',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Wallet size={16} />
          <span>Contas ({bankAccounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('cards')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: activeSection === 'cards' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
            backgroundColor: activeSection === 'cards' ? '#1A231C' : 'transparent',
            color: activeSection === 'cards' ? '#4ADE80' : '#8E8E93',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <CreditCard size={16} />
          <span>Cartões ({creditCards.length})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TÍTULO E SALDO TOTAL (ESTILO PIERRE / SOBRA)
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
          {activeSection === 'accounts' ? 'Contas Bancárias' : 'Cartões de Crédito'}
        </h1>
        <p style={{ fontSize: '0.84rem', color: '#8E8E93', margin: '4px 0 0 0' }}>
          {activeSection === 'accounts' 
            ? `${bankAccounts.length} conta${bankAccounts.length !== 1 ? 's' : ''} e carteira${bankAccounts.length !== 1 ? 's' : ''} cadastrada${bankAccounts.length !== 1 ? 's' : ''}`
            : `${creditCards.length} cartão${creditCards.length !== 1 ? 'ões' : ''} de crédito cadastrado${creditCards.length !== 1 ? 's' : ''}`
          }
        </p>

        {/* Destaque Numérico Calmo com Hero Card e Ambient Glow */}
        <div
          style={{
            marginTop: '16px',
            background: 'linear-gradient(150deg, #131c16 0%, #0d120f 100%)',
            borderRadius: '24px',
            padding: '22px 22px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient Glow sutil */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              backgroundColor: activeSection === 'accounts' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(168, 85, 247, 0.12)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />

          <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, position: 'relative' }}>
            {activeSection === 'accounts' ? 'Saldo total disponível' : 'Limite total em cartões'}
          </span>
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginTop: '6px',
              position: 'relative',
            }}
          >
            {maskValue(formatBrlCurrency(activeSection === 'accounts' ? totalCash : totalCreditLimit))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. LISTA LIMPA DE ITENS (CONTAS OU CARTÕES)
         ───────────────────────────────────────────────────────────── */}
      {activeSection === 'accounts' ? (
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Wallet size={28} color="#64748B" />
              <span>Nenhuma conta corrente ou carteira cadastrada.</span>
              <button
                type="button"
                onClick={() => onOpenNewAccount('checking')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#18201B',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  color: '#4ADE80',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                + Adicionar Conta
              </button>
            </div>
          ) : (
            bankAccounts.map((acc: Account) => (
              <div
                key={acc.id}
                onClick={() => onEditAccount && onEditAccount(acc)}
                style={{
                  background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '20px',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: onEditAccount ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease, transform 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (onEditAccount) {
                    e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (onEditAccount) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.transform = 'translateY(0)';
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {creditCards.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '20px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                color: '#8E8E93',
                fontSize: '0.88rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CreditCard size={28} color="#64748B" />
              <span>Nenhum cartão de crédito cadastrado.</span>
              <button
                type="button"
                onClick={() => onOpenNewAccount('credit_card')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#18201B',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  color: '#4ADE80',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                + Cadastrar Cartão de Crédito
              </button>
            </div>
          ) : (
            creditCards.map((card: Account) => (
              <div
                key={card.id}
                onClick={() => onEditAccount && onEditAccount(card)}
                style={{
                  background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '20px',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: onEditAccount ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease, transform 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (onEditAccount) {
                    e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (onEditAccount) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.transform = 'translateY(0)';
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
                    <BankLogo bankId={card.bankId || card.name} size={26} />
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
                      {card.name} {card.lastDigits ? `•••• ${card.lastDigits}` : ''}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#8E8E93', marginTop: '2px' }}>
                      Fecha dia {card.closingDay || 1} • Vence dia {card.dueDay || 8}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Limite do Cartão */}
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {maskValue(formatBrlCurrency(card.creditLimit || 0))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                    Limite
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </div>
    </SwipeBackView>
  );
};
