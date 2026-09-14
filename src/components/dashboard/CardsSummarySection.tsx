import React, { useState } from 'react';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Account } from '../../core/types';
import { useFinance } from '../../context/FinanceContext';
import { calculateInvoiceForMonth } from '../../core/installments/installmentHelper';
import { calculateCardDateStatus } from '../../core/cards/cardDateHelper';
import { 
  Plus, 
  Menu, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Sparkles, 
  CreditCard, 
  ReceiptText, 
  LineChart, 
  ArrowLeft,
  Trash2,
  Edit3,
  Layers,
  AlertCircle,
  Clock
} from 'lucide-react';

interface CardsSummarySectionProps {
  cards: Account[];
  maskValue: (v: string) => string;
  onSelectCard: (card: Account) => void;
  onAddNewCard: () => void;
  onAddNewExpenseForCard?: (cardId: string) => void;
  onPayInvoice?: (card: Account) => void;
  onEditCard?: (card: Account) => void;
  onDeleteCard?: (cardId: string) => void;
  onBack?: () => void;
  showFullHeader?: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = [
  'JAN.', 'FEV.', 'MAR.', 'ABR.', 'MAI.', 'JUN.',
  'JUL.', 'AGO.', 'SET.', 'OUT.', 'NOV.', 'DEZ.'
];

export const CardsSummarySection: React.FC<CardsSummarySectionProps> = ({
  cards,
  maskValue,
  onSelectCard,
  onAddNewCard,
  onAddNewExpenseForCard,
  onPayInvoice,
  onEditCard,
  onDeleteCard,
  onBack,
  showFullHeader = true,
}) => {
  const { transactions, activeInstallmentGroups } = useFinance();
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth() + 1;
  const targetYear = targetDate.getFullYear();
  const isCurrentMonth = selectedMonthOffset === 0;

  const handlePrevMonth = () => {
    setSelectedMonthOffset(prev => prev - 1);
  };

  const handleNextMonth = () => {
    setSelectedMonthOffset(prev => prev + 1);
  };

  // Total de faturas de todos os cartões somados no mês selecionado
  const totalInvoices = cards.reduce((acc, card) => {
    const monthData = calculateInvoiceForMonth(card.id, transactions, targetMonth, targetYear);
    const inv = isCurrentMonth
      ? (card.invoiceAmount ?? Math.abs(card.balance))
      : monthData.totalAmount;
    return acc + inv;
  }, 0);

  const monthShortName = MONTH_SHORT[targetDate.getMonth()];
  const monthTitle = `${MONTH_NAMES[targetDate.getMonth()]}${targetYear !== now.getFullYear() ? ` ${targetYear}` : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* 1. Header do Módulo Cartões de Crédito (como no print) */}
      {showFullHeader && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Lado Esquerdo: Voltar + Título e Subtítulo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Voltar"
                >
                  <ArrowLeft size={22} />
                </button>
              )}
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', margin: 0 }}>
                  Cartões de crédito
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, marginTop: '2px' }}>
                  {maskValue(formatBrlCurrency(totalInvoices))}
                </div>
              </div>
            </div>

            {/* Lado Direito: Ações rápidas (Extrato, Gráficos, Menu) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => {
                  if (cards[0]) onSelectCard(cards[0]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#CBD5E1',
                  padding: '8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                title="Faturas e Extratos"
              >
                <ReceiptText size={20} />
              </button>

              <button
                onClick={onAddNewCard}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#CBD5E1',
                  padding: '8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                title="Adicionar Novo Cartão"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Navegador de Mês: < Setembro > */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              padding: '6px 0',
            }}
          >
            <button
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Mês anterior"
            >
              <ChevronLeft size={20} />
            </button>

            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              {monthTitle}
            </span>

            <button
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Próximo mês"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Lista de Cartões */}
      {cards.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            borderRadius: '24px',
            backgroundColor: '#131915',
            border: '1px dashed rgba(74, 222, 128, 0.25)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#1A241D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ADE80',
            }}
          >
            <CreditCard size={24} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            Nenhum cartão de crédito cadastrado
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', maxWidth: '300px' }}>
            Cadastre seus cartões para acompanhar limites, faturas abertas e datas de vencimento.
          </div>
          <button
            onClick={onAddNewCard}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: '#22C55E',
              color: '#0A0E0C',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              marginTop: '6px',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
            }}
          >
            Adicionar Cartão
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {cards.map(card => {
            const monthData = calculateInvoiceForMonth(card.id, transactions, targetMonth, targetYear);
            const fatura = isCurrentMonth 
              ? (card.invoiceAmount ?? Math.abs(card.balance))
              : monthData.totalAmount;
            const openVal = card.openAmount ?? (card.invoiceAmount ?? Math.abs(card.balance));
            const totalLimit = card.creditLimit || 5000;
            const availableLimit = Math.max(0, totalLimit - openVal);
            const percentUsed = totalLimit > 0 ? Math.min(100, Math.round((openVal / totalLimit) * 100)) : 0;
            const cardInstallments = activeInstallmentGroups.filter(g => g.accountId === card.id);

            const dateStatus = calculateCardDateStatus(
              card.closingDay,
              card.dueDay,
              now,
              fatura,
              card.invoiceStatus,
              openVal
            );
            const closingDayFormatted = (isCurrentMonth && dateStatus.cycleClosingDateFormatted)
              ? dateStatus.cycleClosingDateFormatted
              : (card.closingDay ? `${String(card.closingDay).padStart(2, '0')}/${monthShortName}` : `01/${monthShortName}`);
            const dueDayFormatted = (isCurrentMonth && dateStatus.cycleDueDateFormatted)
              ? dateStatus.cycleDueDateFormatted
              : (card.dueDay ? `${String(card.dueDay).padStart(2, '0')}/${monthShortName}` : `08/${monthShortName}`);

            const cardAccentColor = card.color || (card.bankId === 'inter' ? '#FF7A00' : '#820AD1');
            const isMenuOpen = activeMenuCardId === card.id;

            return (
              <div
                key={card.id}
                className="card-sobra"
                style={{
                  backgroundColor: '#131915',
                  borderRadius: '22px',
                  padding: '20px 20px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
              >
                {/* Linha 1: Topo do Card (Logo Banco + Nome + Bandeira + Ações rápidas) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <BankLogo bankId={card.bankId || card.name} size={42} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '1.12rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                        {card.name}
                      </span>
                      <CardBrandLogo brand={card.cardBrand || 'mastercard'} size={12} />
                    </div>
                  </div>

                  {/* Ações Rápidas no Canto Superior Direito */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                    {/* Botão + (Adicionar despesa neste cartão) */}
                    <button
                      onClick={() => onAddNewExpenseForCard ? onAddNewExpenseForCard(card.id) : onSelectCard(card)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                      }}
                      title="Adicionar despesa neste cartão"
                    >
                      <Plus size={18} />
                    </button>

                    {/* Botão ≡ (Extrato / Fatura detalhada) */}
                    <button
                      onClick={() => onSelectCard(card)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                      }}
                      title="Ver fatura detalhada"
                    >
                      <Menu size={18} />
                    </button>

                    {/* Botão ⋮ (Menu de Opções) */}
                    <button
                      onClick={() => setActiveMenuCardId(isMenuOpen ? null : card.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                      }}
                      title="Mais opções"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {/* Dropdown Menu de Opções */}
                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '32px',
                          right: '0',
                          backgroundColor: '#162019',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          borderRadius: '14px',
                          padding: '6px',
                          minWidth: '160px',
                          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65)',
                          zIndex: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <button
                          onClick={() => {
                            setActiveMenuCardId(null);
                            onSelectCard(card);
                          }}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            borderRadius: '8px',
                          }}
                        >
                          <ReceiptText size={14} color="#4ADE80" />
                          <span>Ver Fatura</span>
                        </button>

                        {onEditCard && (
                          <button
                            onClick={() => {
                              setActiveMenuCardId(null);
                              onEditCard(card);
                            }}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              color: '#FFFFFF',
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              borderRadius: '8px',
                            }}
                          >
                            <Edit3 size={14} color="#4ADE80" />
                            <span>Editar Cartão</span>
                          </button>
                        )}

                        {onDeleteCard && (
                          <button
                            onClick={() => {
                              setActiveMenuCardId(null);
                              onDeleteCard(card.id);
                            }}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              color: '#FB7185',
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              borderRadius: '8px',
                            }}
                          >
                            <Trash2 size={14} color="#FB7185" />
                            <span>Remover Cartão</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Linha 2: Três Métricas (Limite | Em aberto > | Lim. disponível) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '8px',
                    paddingTop: '2px',
                  }}
                >
                  {/* Coluna 1: Limite */}
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      Limite
                    </span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                      {maskValue(formatBrlCurrency(totalLimit))}
                    </div>
                  </div>

                  {/* Coluna 2: Em aberto > (com link para o extrato) */}
                  <div
                    onClick={() => onSelectCard(card)}
                    style={{ cursor: 'pointer' }}
                    title="Ver lançamentos em aberto"
                  >
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      Em aberto
                    </span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>{maskValue(formatBrlCurrency(openVal))}</span>
                      <ChevronRight size={14} color="#94A3B8" />
                    </div>
                  </div>

                  {/* Coluna 3: Lim. disponível (em verde) */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      Lim. disponível
                    </span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#34D399', marginTop: '2px' }}>
                      {maskValue(formatBrlCurrency(availableLimit))}
                    </div>
                  </div>
                </div>

                {/* Linha 3: Barra de Progresso do Limite com Porcentagem à direita */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${percentUsed}%`,
                        height: '100%',
                        backgroundColor: cardAccentColor,
                        borderRadius: '9999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#CBD5E1', minWidth: '32px', textAlign: 'right' }}>
                    {percentUsed}%
                  </span>
                </div>

                {/* Linha 4: Conta & Datas (Conta | Fechamento | Vencimento) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '8px',
                    paddingTop: '2px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>
                      Conta
                    </span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#E2E8F0', marginTop: '2px' }}>
                      {card.linkedAccountId ? 'Vinculada' : 'A definir'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>
                      Fechamento
                    </span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#E2E8F0', marginTop: '2px' }}>
                      {closingDayFormatted}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>
                      Vencimento
                    </span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#E2E8F0', marginTop: '2px' }}>
                      {dueDayFormatted}
                    </div>
                  </div>
                </div>

                {/* Linha de Inteligência: Melhor Dia de Compra & Status do Ciclo */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                    paddingTop: '2px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      color: '#4ADE80',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                    }}
                  >
                    <Sparkles size={11} />
                    Melhor compra: {dateStatus.bestPurchaseDayFormatted}
                  </span>

                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: dateStatus.statusBadgeVariant === 'danger'
                        ? '#FB7185'
                        : dateStatus.statusBadgeVariant === 'warning'
                        ? '#F59E0B'
                        : dateStatus.statusBadgeVariant === 'success'
                        ? '#4ADE80'
                        : '#94A3B8',
                    }}
                  >
                    {dateStatus.statusText}
                  </span>
                </div>

                {/* Badge de Compras Parceladas Ativas no Cartão */}
                {cardInstallments.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#94A3B8',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Layers size={11} />
                      {cardInstallments.length} {cardInstallments.length === 1 ? 'parcelamento ativo' : 'parcelamentos ativos'}
                    </span>
                  </div>
                )}

                {/* Linha 5: Destaque da Fatura */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '4px',
                  }}
                >
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    {isCurrentMonth ? 'Fatura' : `Fatura Prevista (${monthShortName})`}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: fatura > 0 ? '#F43F5E' : '#34D399', letterSpacing: '-0.02em' }}>
                    {maskValue(formatBrlCurrency(fatura))}
                  </span>
                </div>

                {/* Linha 6: Rodapé com Status e Ação de Pagamento */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '6px',
                  }}
                >
                  {/* Badge de Status Inteligente */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '9999px',
                      backgroundColor: 
                        dateStatus.displayStatus === 'overdue' ? 'rgba(244, 63, 94, 0.15)' :
                        dateStatus.displayStatus === 'paid' ? 'rgba(52, 211, 153, 0.15)' :
                        dateStatus.displayStatus === 'zero' ? 'rgba(52, 211, 153, 0.12)' :
                        dateStatus.displayStatus === 'closed' ? 'rgba(245, 158, 11, 0.15)' :
                        'rgba(56, 189, 248, 0.15)',
                      border: `1px solid ${
                        dateStatus.displayStatus === 'overdue' ? 'rgba(244, 63, 94, 0.35)' :
                        dateStatus.displayStatus === 'paid' ? 'rgba(52, 211, 153, 0.35)' :
                        dateStatus.displayStatus === 'zero' ? 'rgba(52, 211, 153, 0.3)' :
                        dateStatus.displayStatus === 'closed' ? 'rgba(245, 158, 11, 0.35)' :
                        'rgba(56, 189, 248, 0.35)'
                      }`,
                      color: 
                        dateStatus.displayStatus === 'overdue' ? '#FB7185' :
                        dateStatus.displayStatus === 'paid' ? '#34D399' :
                        dateStatus.displayStatus === 'zero' ? '#34D399' :
                        dateStatus.displayStatus === 'closed' ? '#FBBF24' :
                        '#38BDF8',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                    }}
                  >
                    {dateStatus.displayStatus === 'overdue' && (
                      <>
                        <AlertCircle size={12} />
                        <span>Vencida</span>
                      </>
                    )}
                    {dateStatus.displayStatus === 'paid' && (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Paga</span>
                      </>
                    )}
                    {dateStatus.displayStatus === 'zero' && (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Em dia</span>
                      </>
                    )}
                    {dateStatus.displayStatus === 'closed' && (
                      <>
                        <Lock size={12} />
                        <span>Fechada</span>
                      </>
                    )}
                    {dateStatus.displayStatus === 'open' && (
                      <>
                        <Clock size={12} />
                        <span>Aberta</span>
                      </>
                    )}
                  </div>

                  {/* Ação do Rodapé: Registrar Pagamento / Fatura Quitada / Ver Detalhes */}
                  {fatura > 0 && dateStatus.displayStatus !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => onPayInvoice ? onPayInvoice(card) : onSelectCard(card)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        color: dateStatus.displayStatus === 'overdue' ? '#FB7185' : '#4ADE80',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 0',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <CheckCircle2 size={17} color={dateStatus.displayStatus === 'overdue' ? '#FB7185' : '#4ADE80'} />
                      <span>Registrar pagamento</span>
                    </button>
                  ) : dateStatus.displayStatus === 'paid' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: '#4ADE80',
                        fontSize: '0.86rem',
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={15} color="#4ADE80" />
                      <span>Fatura quitada</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectCard(card)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 0',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                    >
                      <ReceiptText size={15} />
                      <span>Ver detalhes</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
