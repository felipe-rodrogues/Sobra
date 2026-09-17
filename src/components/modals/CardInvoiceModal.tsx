import React, { useState, useMemo } from 'react';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Account, Transaction, Category } from '../../core/types';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  calculateFutureInvoiceTimeline, 
  calculateInvoiceForMonth, 
  MONTH_NAMES 
} from '../../core/installments/installmentHelper';
import { calculateCardDateStatus } from '../../core/cards/cardDateHelper';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Calendar, 
  List, 
  Plus, 
  Trash2, 
  Edit3, 
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { TransactionModal } from './TransactionModal';

interface CardInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: Account | null;
  transactions?: Transaction[];
  categories?: Category[];
  isPrivacyMode?: boolean;
  onAddNewExpense?: (accountId?: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onPayInvoice?: (card: Account) => void;
}

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const CardInvoiceModal: React.FC<CardInvoiceModalProps> = ({
  isOpen,
  onClose,
  card: initialCard,
  transactions: propTxs,
  categories: propCats,
  isPrivacyMode: propPrivacy,
  onAddNewExpense,
  onEditTransaction,
  onPayInvoice,
}) => {
  const finance = useFinance();
  const { colors } = useTheme();

  // Estados principais
  const transactions = propTxs || finance.transactions;
  const categories = propCats || finance.categories;
  const isPrivacy = propPrivacy !== undefined ? propPrivacy : finance.isPrivacyMode;
  const togglePrivacy = finance.togglePrivacyMode;

  const creditCards = useMemo(() => {
    return finance.accounts.filter(a => a.type === 'credit_card');
  }, [finance.accounts]);

  // Se o modal recebeu um cartão específico, seleciona ele; senão 'all'
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    return initialCard ? initialCard.id : 'all';
  });

  // Abas estilo Pierre: 'faturas' | 'parcelas' | 'limites'
  const [activeTab, setActiveTab] = useState<'faturas' | 'parcelas' | 'limites'>('faturas');

  // Mês selecionado no gráfico (offset relativo ao mês atual: 0 = mês atual, -1 = mês anterior, etc.)
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);

  // Expansão de lista de lançamentos de cada cartão
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // Modais de Edição e Exclusão
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);

  // Sincroniza seleção de cartão quando initialCard muda
  React.useEffect(() => {
    if (initialCard) {
      setSelectedCardId(initialCard.id);
    } else {
      setSelectedCardId('all');
    }
  }, [initialCard, isOpen]);

  if (!isOpen) return null;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth() + 1; // 1-12
  const targetYear = targetDate.getFullYear();
  const isCurrentMonth = selectedMonthOffset === 0;

  const maskValue = (formatted: string) => (isPrivacy ? '••••••' : formatted);

  // Cartões a serem exibidos de acordo com o filtro selecionado
  const displayedCards = selectedCardId === 'all' 
    ? creditCards 
    : creditCards.filter(c => c.id === selectedCardId);

  // Gera dados dos 7 meses para o gráfico de barras estilo Pierre (5 anteriores, atual, 1 futuro)
  const monthBarChartData = [-5, -4, -3, -2, -1, 0, 1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();

    // Soma faturas de todos os cartões (ou do cartão selecionado) neste mês
    const total = displayedCards.reduce((acc, c) => {
      const monthData = calculateInvoiceForMonth(c.id, transactions, m, y);
      return acc + (offset === 0 && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
    }, 0);

    return {
      offset,
      monthNum: m,
      year: y,
      label: MONTH_ABBR[m - 1],
      total,
      isSelected: offset === selectedMonthOffset,
    };
  });

  // Encontra o valor máximo para dimensionar a altura das barras do gráfico
  const maxMonthTotal = Math.max(...monthBarChartData.map(d => d.total), 100);

  // Total das faturas para o mês e filtro selecionados
  const totalInvoicesSelectedMonth = displayedCards.reduce((acc, c) => {
    const monthData = calculateInvoiceForMonth(c.id, transactions, targetMonth, targetYear);
    const amount = isCurrentMonth && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount;
    return acc + amount;
  }, 0);

  // Próximo vencimento calculado
  const nextDueDateInfo = (() => {
    if (displayedCards.length === 0) return null;

    const currentDay = now.getDate();
    let earliestDueDate: { day: number; month: number; daysLeft: number } | null = null;
    let minDays = Infinity;

    displayedCards.forEach(c => {
      const dueDay = c.dueDay || 10;
      let m = targetMonth;
      let y = targetYear;

      if (isCurrentMonth && dueDay < currentDay) {
        m = targetMonth === 12 ? 1 : targetMonth + 1;
        y = targetMonth === 12 ? targetYear + 1 : targetYear;
      }

      const dueObj = new Date(y, m - 1, dueDay);
      const diffDays = Math.ceil((dueObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < minDays) {
        minDays = diffDays;
        earliestDueDate = { day: dueDay, month: m, daysLeft: diffDays };
      }
    });

    if (!earliestDueDate) return null;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dayStr = pad((earliestDueDate as any).day);
    const monthStr = pad((earliestDueDate as any).month);
    const daysLeft = (earliestDueDate as any).daysLeft;

    return {
      text: `${dayStr}/${monthStr}`,
      daysLeftText: daysLeft === 0 ? 'Vence hoje' : daysLeft === 1 ? 'em 1 dia' : `em ${daysLeft} dias`,
    };
  })();

  const toggleCardExpansion = (id: string) => {
    setExpandedCardIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 0,
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up hide-scrollbar"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          minHeight: '100vh',
          backgroundColor: '#0B0C0E',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          position: 'relative',
          boxSizing: 'border-box',
          paddingBottom: 'calc(40px + var(--safe-area-bottom, 0px))',
        }}
      >
        {/* ─────────────────────────────────────────────────────────────
            1. BARRA SUPERIOR: VOLTAR + PRIVACIDADE + NOVO GASTO (+)
           ───────────────────────────────────────────────────────────── */}
        <header
          style={{
            padding: 'calc(var(--safe-area-top, 0px) + 12px) 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            backgroundColor: '#0B0C0E',
            zIndex: 30,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
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
            title="Voltar"
          >
            <ArrowLeft size={19} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={togglePrivacy}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: isPrivacy ? '#4ADE80' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)')}
              title={isPrivacy ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {isPrivacy ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>

            {/* Botão (+) Novo Gasto idêntico à tela de Atividades */}
            <button
              type="button"
              onClick={() => {
                if (onAddNewExpense) {
                  onClose();
                  onAddNewExpense(selectedCardId !== 'all' ? selectedCardId : undefined);
                }
              }}
              title="Nova despesa no cartão"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: '#4ADE80', // Verde oficial do Sobra
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
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
        </header>

        {/* ─────────────────────────────────────────────────────────────
            2. ABAS SEGMENTADAS ESTILO PIERRE: [Faturas] [Parcelas] [Limites]
           ───────────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              backgroundColor: '#161F18',
              padding: '4px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {(['faturas', 'parcelas', 'limites'] as const).map(tab => {
              const isActive = activeTab === tab;
              const labels = {
                faturas: 'Faturas',
                parcelas: 'Parcelas',
                limites: 'Limites',
              };

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 0',
                    borderRadius: '9999px',
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#0A0E0C' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    textAlign: 'center',
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo Dinâmico Baseado na Aba Ativa */}
        {activeTab === 'faturas' && (
          <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* ─────────────────────────────────────────────────────────
                3. HEADER DO VALOR TOTAL E PRÓXIMO VENCIMENTO (PIERRE)
               ───────────────────────────────────────────────────────── */}
            <div>
              <span style={{ fontSize: '0.86rem', color: '#94A3B8', fontWeight: 500 }}>
                Total em faturas em {MONTH_NAMES[targetMonth - 1]}
              </span>

              <div
                style={{
                  fontSize: '2.2rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  marginTop: '4px',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                {maskValue(formatBrlCurrency(totalInvoicesSelectedMonth))}
              </div>

              {nextDueDateInfo && (
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
                  Próximo vencimento{' '}
                  <strong style={{ color: '#E2E8F0' }}>{nextDueDateInfo.text}</strong>{' '}
                  <span style={{ color: '#64748B' }}>({nextDueDateInfo.daysLeftText})</span>
                </p>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────
                4. GRÁFICO DE BARRAS MENSAL ESTILO PÍLULA (PIERRE)
               ───────────────────────────────────────────────────────── */}
            <div
              style={{
                backgroundColor: '#121814',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '24px',
                padding: '16px 14px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                height: '130px',
                boxSizing: 'border-box',
              }}
            >
              {monthBarChartData.map(item => {
                // Altura proporcional da barra (mínimo 16px, máximo 70px)
                const heightPercent = Math.max(16, Math.min(70, Math.round((item.total / maxMonthTotal) * 70)));

                return (
                  <button
                    key={item.offset}
                    type="button"
                    onClick={() => setSelectedMonthOffset(item.offset)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      flex: 1,
                    }}
                    title={`${item.label} / ${item.year}: ${formatBrlCurrency(item.total)}`}
                  >
                    {/* Barra Cápsula */}
                    <div
                      style={{
                        width: '28px',
                        height: `${heightPercent}px`,
                        borderRadius: '9999px',
                        backgroundColor: item.isSelected ? '#4ADE80' : '#232C26',
                        boxShadow: item.isSelected ? '0 0 16px rgba(74, 222, 128, 0.45)' : 'none',
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />

                    {/* Rótulo do Mês */}
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: item.isSelected ? 800 : 500,
                        color: item.isSelected ? '#FFFFFF' : '#64748B',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ─────────────────────────────────────────────────────────
                5. FILTROS EM PÍLULA: [Todos os cartões] + [Cartão N]
               ───────────────────────────────────────────────────────── */}
            <div
              className="hide-scrollbar"
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '2px',
              }}
            >
              {/* Opção Todos os Cartões */}
              <button
                type="button"
                onClick={() => setSelectedCardId('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  backgroundColor: selectedCardId === 'all' ? '#FFFFFF' : '#161F18',
                  color: selectedCardId === 'all' ? '#0A0E0C' : '#94A3B8',
                  border: `1px solid ${selectedCardId === 'all' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                  fontSize: '0.82rem',
                  fontWeight: selectedCardId === 'all' ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <CreditCard size={15} />
                <span>Todos os cartões</span>
              </button>

              {/* Pílulas individuais de cada cartão */}
              {creditCards.map(c => {
                const isSelected = selectedCardId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCardId(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? '#FFFFFF' : '#161F18',
                      color: isSelected ? '#0A0E0C' : '#94A3B8',
                      border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <BankLogo bankId={c.bankId} size={18} style={{ boxShadow: 'none' }} />
                    <span>{c.name}</span>
                    {c.lastDigits && (
                      <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>•••• {c.lastDigits}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ─────────────────────────────────────────────────────────
                6. LISTA DE CARDS DE FATURAS (DETALHADO FIEL À IMAGEM 2)
               ───────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {displayedCards.map(cardItem => {
                const monthData = calculateInvoiceForMonth(cardItem.id, transactions, targetMonth, targetYear);
                const invTotal = isCurrentMonth && cardItem.invoiceAmount !== undefined 
                  ? cardItem.invoiceAmount 
                  : monthData.totalAmount;

                const limit = cardItem.creditLimit || 5000;
                const used = invTotal;
                const available = Math.max(0, limit - used);
                const usedPercent = Math.min(100, Math.round((used / limit) * 100));

                const dateStatus = calculateCardDateStatus(
                  cardItem.closingDay,
                  cardItem.dueDay,
                  now,
                  cardItem.invoiceAmount,
                  cardItem.invoiceStatus,
                  cardItem.openAmount
                );

                const isExpanded = !!expandedCardIds[cardItem.id];
                const cardAccentColor = cardItem.color || (cardItem.bankId === 'inter' ? '#FF7A00' : '#820AD1');

                return (
                  <div
                    key={cardItem.id}
                    style={{
                      backgroundColor: '#131915',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '24px',
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Topo do Card: Logo Banco + Nome + Final do Cartão + Bandeira */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BankLogo bankId={cardItem.bankId} size={28} />
                        <div>
                          <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
                            {cardItem.name}
                            {cardItem.lastDigits && (
                              <span style={{ color: '#94A3B8', fontFamily: 'monospace', marginLeft: '6px' }}>
                                •••• {cardItem.lastDigits}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Fecha dia {cardItem.closingDay || 1} • Vence dia {cardItem.dueDay || 8}
                          </span>
                        </div>
                      </div>

                      <CardBrandLogo brand={cardItem.cardBrand || 'mastercard'} size={18} showText={false} />
                    </div>

                    {/* Valor da Fatura + Tag de Status Aberta/Fechada */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          fontSize: '1.65rem',
                          fontWeight: 800,
                          color: '#FFFFFF',
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {maskValue(formatBrlCurrency(invTotal))}
                      </div>

                      {/* Tag de Status estilo Pierre (Aberta em laranja, Fechada em azul, Paga em verde) */}
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          backgroundColor:
                            dateStatus.displayStatus === 'paid'
                              ? 'rgba(74, 222, 128, 0.15)'
                              : dateStatus.displayStatus === 'closed'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(251, 146, 60, 0.18)',
                          color:
                            dateStatus.displayStatus === 'paid'
                              ? '#4ADE80'
                              : dateStatus.displayStatus === 'closed'
                              ? '#38BDF8'
                              : '#FB923C',
                          border: `1px solid ${
                            dateStatus.displayStatus === 'paid'
                              ? 'rgba(74, 222, 128, 0.3)'
                              : dateStatus.displayStatus === 'closed'
                              ? 'rgba(56, 189, 248, 0.3)'
                              : 'rgba(251, 146, 60, 0.35)'
                          }`,
                        }}
                      >
                        {dateStatus.statusLabel}
                      </span>
                    </div>

                    {/* Barra de Progresso do Limite do Cartão */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.76rem',
                          color: '#94A3B8',
                          marginBottom: '6px',
                        }}
                      >
                        <span>Limite</span>
                        <span>Disponível: <strong style={{ color: '#E2E8F0' }}>{maskValue(formatBrlCurrency(available))}</strong></span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: '#1E2721',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${usedPercent}%`,
                            height: '100%',
                            backgroundColor: cardAccentColor,
                            borderRadius: '9999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Ações Rápidas: Ver Compras da Fatura & Pagar Fatura */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCardExpansion(cardItem.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#94A3B8',
                          cursor: 'pointer',
                        }}
                      >
                        <span>Compras ({monthData.transactions.length})</span>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {onPayInvoice && invTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onPayInvoice(cardItem);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            backgroundColor: '#1E2721',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#FFFFFF',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pagar Fatura
                        </button>
                      )}
                    </div>

                    {/* Lista Expansível de Lançamentos desta Fatura */}
                    {isExpanded && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '4px',
                          paddingTop: '8px',
                          borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {monthData.transactions.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.8rem', color: '#64748B' }}>
                            Nenhum lançamento registrado nesta fatura.
                          </div>
                        ) : (
                          monthData.transactions.map(tx => {
                            const txCat = categories.find(c => c.id === tx.categoryId);
                            return (
                              <div
                                key={tx.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: '12px',
                                  backgroundColor: '#18201B',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '10px',
                                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#94A3B8',
                                    }}
                                  >
                                    <IconRenderer name={txCat?.icon || 'Tag'} size={15} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                                      {tx.description}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                      {new Date(tx.date).toLocaleDateString('pt-BR')} • {txCat?.name || 'Geral'}
                                      {tx.installmentTotal && tx.installmentTotal > 1 && (
                                        <span style={{ color: '#4ADE80', marginLeft: '6px' }}>
                                          ({tx.installmentNumber}/{tx.installmentTotal})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    fontSize: '0.88rem',
                                    fontWeight: 700,
                                    color: tx.type === 'expense' ? '#FB7185' : '#4ADE80',
                                  }}
                                >
                                  {tx.type === 'expense' ? '-' : '+'} {maskValue(formatBrlCurrency(tx.amount))}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setTxToDelete(tx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748B',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                  title="Excluir da fatura"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            7. ABA PARCELAS (PIERRE STYLE)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'parcelas' && (
          <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                Compras Parceladas Ativas
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                Acompanhe o impacto das suas compras parceladas nos próximos meses
              </p>
            </div>

            {finance.activeInstallmentGroups.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  backgroundColor: '#131915',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Layers size={32} color="#64748B" style={{ margin: '0 auto 10px' }} />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Nenhuma compra parcelada ativa
                </p>
                <span style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Ao registrar despesas no cartão, marque como parcelada para acompanhar a evolução aqui.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {finance.activeInstallmentGroups.map(group => {
                  const card = finance.accounts.find(a => a.id === group.accountId);
                  const progress = Math.min(100, Math.round((group.paidInstallmentsCount / Math.max(1, group.installmentTotal)) * 100));

                  return (
                    <div
                      key={group.groupId}
                      style={{
                        backgroundColor: '#131915',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                            {group.description}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                            {card?.name || 'Cartão'} {card?.lastDigits ? `•••• ${card.lastDigits}` : ''} • Parcela {group.paidInstallmentsCount} de {group.installmentTotal}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#FB7185' }}>
                            {maskValue(formatBrlCurrency(group.monthlyAmount))} /mês
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            Total: {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Progresso das Parcelas */}
                      <div
                        style={{
                          width: '100%',
                          height: '5px',
                          borderRadius: '9999px',
                          backgroundColor: '#1E2721',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: '#4ADE80',
                            borderRadius: '9999px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            8. ABA LIMITES (PIERRE STYLE)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'limites' && (
          <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                Gestão Consolidada de Limites
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                Acompanhe o comprometimento total e a saúde do seu crédito
              </p>
            </div>

            {/* Card Consolidado de Limites */}
            {(() => {
              const totalLimit = creditCards.reduce((acc, c) => acc + (c.creditLimit || 5000), 0);
              const totalUsed = creditCards.reduce((acc, c) => {
                const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear);
                return acc + (c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
              }, 0);
              const totalAvail = Math.max(0, totalLimit - totalUsed);
              const percent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

              return (
                <div
                  style={{
                    backgroundColor: '#131915',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
                    Limite Total em Cartões
                  </span>

                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {maskValue(formatBrlCurrency(totalLimit))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: '#18201B' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Utilizado</span>
                      <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FB923C', marginTop: '2px' }}>
                        {maskValue(formatBrlCurrency(totalUsed))}
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: '#18201B' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Disponível</span>
                      <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#4ADE80', marginTop: '2px' }}>
                        {maskValue(formatBrlCurrency(totalAvail))}
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '8px', borderRadius: '9999px', backgroundColor: '#1E2721', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', backgroundColor: '#4ADE80', borderRadius: '9999px' }} />
                  </div>
                </div>
              );
            })()}

            {/* Detalhe por Cartão */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                Detalhamento por Cartão
              </span>

              {creditCards.map(c => {
                const limit = c.creditLimit || 5000;
                const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear);
                const used = c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount;
                const avail = Math.max(0, limit - used);
                const percent = Math.min(100, Math.round((used / limit) * 100));

                return (
                  <div
                    key={c.id}
                    style={{
                      backgroundColor: '#131915',
                      borderRadius: '18px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BankLogo bankId={c.bankId} size={22} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
                          {c.name} {c.lastDigits ? `•••• ${c.lastDigits}` : ''}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {maskValue(formatBrlCurrency(limit))}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94A3B8' }}>
                      <span>Usado: <strong style={{ color: '#FB923C' }}>{maskValue(formatBrlCurrency(used))}</strong></span>
                      <span>Disponível: <strong style={{ color: '#4ADE80' }}>{maskValue(formatBrlCurrency(avail))}</strong></span>
                    </div>

                    <div style={{ width: '100%', height: '5px', borderRadius: '9999px', backgroundColor: '#1E2721', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: c.color || '#4ADE80', borderRadius: '9999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão de Transação */}
      {txToDelete && (
        <ConfirmModal
          isOpen={!!txToDelete}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            await finance.deleteTransaction(txToDelete.id);
            setTxToDelete(null);
          }}
          title="Excluir Lançamento"
          description={`Deseja realmente excluir "${txToDelete.description}" desta fatura?`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
          itemDetails={{
            title: txToDelete.description,
            amount: `- R$ ${txToDelete.amount.toFixed(2).replace('.', ',')}`,
          }}
        />
      )}
    </div>
  );
};
