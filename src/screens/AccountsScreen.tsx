import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BankLogo } from '../components/common/BankLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { calculateFinancialSummary } from '../core/calculations';
import { 
  Plus, 
  Trash2, 
  CreditCard, 
  Wallet, 
  Edit3, 
  ArrowLeftRight,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { Account, Transaction } from '../core/types';
import { CardsSummarySection } from '../components/dashboard/CardsSummarySection';
import { CardInvoiceModal } from '../components/modals/CardInvoiceModal';
import { PayInvoiceModal } from '../components/modals/PayInvoiceModal';

interface AccountsScreenProps {
  onBack?: () => void;
  onOpenNewAccount: () => void;
  onEditAccount?: (acc: Account) => void;
  onOpenTransfer?: () => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onBack,
  onOpenNewAccount,
  onEditAccount,
  onOpenTransfer,
  onEditTransaction,
}) => {
  const { accounts, transactions, categories, deleteAccount, isPrivacyMode, togglePrivacyMode } = useFinance();

  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<Account | null>(null);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<Account | null>(null);

  const financialSummary = calculateFinancialSummary(accounts);
  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
  const creditCards = accounts.filter(a => a.type === 'credit_card');

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return 'Conta Corrente';
      case 'credit_card': return 'Cartão de Crédito';
      case 'savings': return 'Poupança';
      case 'investment': return 'Investimentos';
      case 'cash': return 'Dinheiro em Espécie';
      default: return 'Conta';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '30px' }}>
      {/* Header Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
              Contas & Carteiras
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '2px 0 0' }}>
              {accounts.length} conta{accounts.length === 1 ? '' : 's'} e cartão cadastrado{accounts.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onOpenTransfer && (
            <button
              type="button"
              onClick={onOpenTransfer}
              className="pill-action-btn"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Transferir entre contas"
            >
              <ArrowLeftRight size={14} color="#4ADE80" />
              <span>Transferir</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewAccount}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9999px',
              backgroundColor: '#22C55E',
              color: '#0A0E0C',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>Nova Conta</span>
          </button>
        </div>
      </div>

      {/* Card Sobra Líquida Real (Patrimônio Líquido) com Design Sobra Obsidian */}
      <div
        className="card-sobra"
        style={{
          background: 'linear-gradient(135deg, #151D18 0%, #111713 50%, #0E1410 100%)',
          border: '1px solid rgba(74, 222, 128, 0.18)',
          borderRadius: '24px',
          padding: '22px 20px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
            Sobra Líquida Real (Patrimônio Líquido)
          </span>

          <button
            type="button"
            onClick={togglePrivacyMode}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
            }}
            title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div style={{ fontSize: '2.15rem', fontWeight: 900, color: '#FFFFFF', margin: '8px 0 16px', letterSpacing: '-0.03em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
          {maskValue(formatBrlCurrency(financialSummary.netSobra))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div
            style={{
              backgroundColor: '#161F18',
              padding: '10px 12px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#4ADE80', display: 'inline-block' }} />
              Saldo Disponível
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4ADE80', marginTop: '3px' }}>
              {maskValue(formatBrlCurrency(financialSummary.cashBalance))}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#161F18',
              padding: '10px 12px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#FB7185', display: 'inline-block' }} />
              Faturas a Pagar
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FB7185', marginTop: '3px' }}>
              {maskValue(formatBrlCurrency(financialSummary.creditCardDebt))}
            </div>
          </div>
        </div>
      </div>

      {/* Seção 1: Contas Bancárias e Carteiras */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Wallet size={18} color="#4ADE80" />
          <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Contas Bancárias & Dinheiro ({bankAccounts.length})
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {bankAccounts.length === 0 ? (
            <div
              className="card-sobra"
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#94A3B8',
                fontSize: '0.86rem',
              }}
            >
              Nenhuma conta bancária cadastrada.
            </div>
          ) : (
            bankAccounts.map((acc: Account) => (
              <div
                key={acc.id}
                className="card-sobra"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <BankLogo bankId={acc.bankId || acc.name} size={42} />

                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {acc.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '1px' }}>
                      {getAccountTypeLabel(acc.type)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.08rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {maskValue(formatBrlCurrency(acc.balance))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Saldo Disponível
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {onEditAccount && (
                      <button
                        type="button"
                        onClick={() => onEditAccount(acc)}
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: 'none',
                        }}
                        title="Editar conta"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}

                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Deseja remover a conta "${acc.name}"? As transações associadas serão desvinculadas.`)) {
                            deleteAccount(acc.id);
                          }
                        }}
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: 'none',
                        }}
                        title="Remover conta"
                        onMouseEnter={e => (e.currentTarget.style.color = '#FB7185')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Seção 2: Cartões de Crédito */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <CreditCard size={18} color="#4ADE80" />
          <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Cartões de Crédito ({creditCards.length})
          </h3>
        </div>

        <CardsSummarySection
          cards={creditCards}
          maskValue={maskValue}
          showFullHeader={false}
          onSelectCard={card => setSelectedCardForInvoice(card)}
          onPayInvoice={card => setSelectedCardForPayment(card)}
          onAddNewCard={onOpenNewAccount}
          onEditCard={onEditAccount}
          onDeleteCard={id => deleteAccount(id)}
        />
      </div>

      {/* Modal de Fatura Detalhada */}
      <CardInvoiceModal
        isOpen={!!selectedCardForInvoice}
        onClose={() => setSelectedCardForInvoice(null)}
        card={selectedCardForInvoice}
        transactions={transactions}
        categories={categories}
        isPrivacyMode={isPrivacyMode}
        onAddNewExpense={() => setSelectedCardForInvoice(null)}
        onEditTransaction={onEditTransaction}
      />

      {/* Modal de Pagamento de Fatura */}
      <PayInvoiceModal
        isOpen={!!selectedCardForPayment}
        onClose={() => setSelectedCardForPayment(null)}
        card={selectedCardForPayment}
      />
    </div>
  );
};
