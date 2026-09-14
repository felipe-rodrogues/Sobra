import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Account, Transaction, Category } from '../../core/types';
import { useFinance } from '../../context/FinanceContext';
import { calculateFutureInvoiceTimeline, calculateInvoiceForMonth, MONTH_NAMES } from '../../core/installments/installmentHelper';
import { calculateCardDateStatus } from '../../core/cards/cardDateHelper';
import { 
  Calendar, 
  Plus,
  Percent,
  Layers,
  ReceiptText, 
  Trash2, 
  Edit3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TransactionModal } from './TransactionModal';

interface CardInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Account | null;
  transactions: Transaction[];
  categories: Category[];
  isPrivacyMode: boolean;
  onAddNewExpense: (accountId: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export const CardInvoiceModal: React.FC<CardInvoiceModalProps> = ({
  isOpen,
  onClose,
  card,
  transactions,
  categories,
  isPrivacyMode,
  onAddNewExpense,
  onEditTransaction,
}) => {
  if (!card) return null;

  const { activeInstallmentGroups, deleteInstallmentGroup, deleteTransaction } = useFinance();
  const [activeTab, setActiveTab] = useState<'current' | 'timeline' | 'installments'>('current');
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  const now = new Date();
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);

  const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth() + 1; // 1 - 12
  const targetYear = targetDate.getFullYear();
  const isCurrentMonth = selectedMonthOffset === 0;

  // Lançamentos específicos da fatura do mês selecionado
  const monthInvoiceData = calculateInvoiceForMonth(card.id, transactions, targetMonth, targetYear);
  const invoiceTransactions = monthInvoiceData.transactions;
  const currentInvoiceTotal = isCurrentMonth 
    ? (card.invoiceAmount ?? monthInvoiceData.totalAmount)
    : monthInvoiceData.totalAmount;

  const dateStatus = calculateCardDateStatus(
    card.closingDay,
    card.dueDay,
    now,
    card.invoiceAmount,
    card.invoiceStatus,
    card.openAmount
  );

  const faturaTotal = isCurrentMonth ? (card.invoiceAmount ?? Math.abs(card.balance)) : currentInvoiceTotal;
  const creditLimit = card.creditLimit || 5000;
  const openVal = card.openAmount ?? faturaTotal;
  const availableLimit = Math.max(0, creditLimit - openVal);
  const percentUsed = creditLimit > 0 ? Math.min(100, Math.round((openVal / creditLimit) * 100)) : 0;

  const cardInstallments = activeInstallmentGroups.filter(g => g.accountId === card.id);
  const timeline = calculateFutureInvoiceTimeline(card.id, transactions, 6);

  // Gastos agrupados por categoria especificamente desta fatura
  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const spendingByCategory = new Map<string, number>();
  invoiceTransactions.forEach(t => {
    if (t.type === 'expense') {
      const current = spendingByCategory.get(t.categoryId) || 0;
      spendingByCategory.set(t.categoryId, current + t.amount);
    }
  });

  const totalCategoryExpenses = Array.from(spendingByCategory.values()).reduce((sum, v) => sum + v, 0);
  const categoryBreakdown = Array.from(spendingByCategory.entries()).map(([catId, amount]) => {
    const cat = categoryMap.get(catId);
    return {
      name: cat?.name || 'Diversos',
      color: cat?.color || '#94A3B8',
      icon: cat?.icon || 'Tag',
      amount,
      percent: totalCategoryExpenses > 0 ? Math.round((amount / totalCategoryExpenses) * 100) : 0,
    };
  }).sort((a, b) => b.amount - a.amount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fatura & Detalhes do Cartão"
      subtitle={`${card.name}`}
      maxWidth="540px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Cartão Físico Estilizado (Visual Premium) */}
        <div
          style={{
            borderRadius: '20px',
            padding: '22px',
            background: `linear-gradient(135deg, ${card.color || '#1E293B'} 0%, #090D16 100%)`,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            color: '#FFFFFF',
          }}
        >
          {/* Efeito de iluminação suave */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              filter: 'blur(30px)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BankLogo bankId={card.bankId || card.name} size={36} />
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {card.name}
                </span>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Cartão de Crédito
                </div>
              </div>
            </div>

            <Badge 
              variant={dateStatus.statusBadgeVariant === 'danger' ? 'expense' : dateStatus.statusBadgeVariant === 'warning' ? 'warning' : 'primary'} 
              size="sm"
            >
              Fatura {dateStatus.statusLabel}
            </Badge>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isCurrentMonth ? 'Fatura Atual a Pagar' : `Fatura Prevista (${MONTH_NAMES[targetMonth - 1]})`}
            </span>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '2px' }}>
              {maskValue(formatBrlCurrency(currentInvoiceTotal))}
            </div>
          </div>

          {/* Barra de Progresso do Limite */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '6px' }}>
              <span>Limite Utilizado: {percentUsed}%</span>
              <span>Disponível: {maskValue(formatBrlCurrency(availableLimit))}</span>
            </div>
            <div
              style={{
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentUsed}%`,
                  height: '100%',
                  backgroundColor: percentUsed > 80 ? '#F43F5E' : '#CCFF00',
                  borderRadius: '9999px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
              <span>Total: {maskValue(formatBrlCurrency(creditLimit))}</span>
              <span>{card.cardBrand?.toUpperCase() || 'CARTÃO'}</span>
            </div>
          </div>
        </div>

        {/* Datas Importantes & Ações */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: '#161B26',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#38BDF8" />
              <span>Vencimento da Fatura</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
              {dateStatus.cycleDueDateFormatted || 'A definir'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
              Fechamento em {dateStatus.cycleClosingDateFormatted || 'A definir'}
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: '#161B26',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Percent size={14} color="#CCFF00" />
              <span>Impacto na Sobra</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: currentInvoiceTotal > 0 ? '#F43F5E' : '#34D399', marginTop: '4px' }}>
              -{maskValue(formatBrlCurrency(currentInvoiceTotal))}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
              Descontado da sobra líquida
            </div>
          </div>
        </div>

        {/* Navegação entre Abas do Cartão */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#161B26',
            borderRadius: '12px',
            padding: '4px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '8px',
              fontWeight: activeTab === 'current' ? 700 : 500,
              fontSize: '0.8rem',
              backgroundColor: activeTab === 'current' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'current' ? '#FFFFFF' : '#94A3B8',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <ReceiptText size={14} />
            <span>Fatura Atual</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '8px',
              fontWeight: activeTab === 'timeline' ? 700 : 500,
              fontSize: '0.8rem',
              backgroundColor: activeTab === 'timeline' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'timeline' ? '#FFFFFF' : '#94A3B8',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <Calendar size={14} />
            <span>Faturas Futuras</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('installments')}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '8px',
              fontWeight: activeTab === 'installments' ? 700 : 500,
              fontSize: '0.8rem',
              backgroundColor: activeTab === 'installments' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: activeTab === 'installments' ? '#38BDF8' : '#94A3B8',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <Layers size={14} />
            <span>Parcelamentos</span>
            {cardInstallments.length > 0 && (
              <span
                style={{
                  backgroundColor: '#38BDF8',
                  color: '#000000',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                }}
              >
                {cardInstallments.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo da Aba 1: Fatura Atual */}
        {activeTab === 'current' && (
          <>
            {/* Gastos por Categoria no Cartão */}
            {categoryBreakdown.length > 0 && (
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '10px', display: 'block' }}>
                  Onde você mais gastou neste cartão
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categoryBreakdown.slice(0, 3).map(cat => (
                    <div
                      key={cat.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '8px',
                            backgroundColor: `${cat.color}25`,
                            color: cat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconRenderer name={cat.icon} size={14} />
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>
                          {cat.name}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
                          {maskValue(formatBrlCurrency(cat.amount))}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: '6px' }}>
                          ({cat.percent}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Transações da Fatura Selecionada */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Compras Desta Fatura ({invoiceTransactions.length})
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>
                    ({MONTH_NAMES[targetMonth - 1]} / {targetYear})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Seletor de Fatura por Mês */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedMonthOffset(prev => prev - 1)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Fatura do mês anterior"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isCurrentMonth ? '#CCFF00' : '#FFFFFF', padding: '0 4px', minWidth: '32px', textAlign: 'center' }}>
                      {MONTH_NAMES[targetMonth - 1].substring(0, 3)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedMonthOffset(prev => prev + 1)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Fatura do próximo mês"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus size={14} />}
                    onClick={() => {
                      onClose();
                      onAddNewExpense(card.id);
                    }}
                  >
                    Lançar Compra
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {invoiceTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748B', fontSize: '0.82rem', backgroundColor: '#161B26', borderRadius: '12px' }}>
                    Nenhuma compra nesta fatura ({MONTH_NAMES[targetMonth - 1]} / {targetYear}).
                  </div>
                ) : (
                  invoiceTransactions.map(tx => {
                    const cat = categoryMap.get(tx.categoryId);
                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          if (onEditTransaction) onEditTransaction(tx);
                          else setSelectedTxForEdit(tx);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          backgroundColor: '#161B26',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#1E2433';
                          e.currentTarget.style.borderColor = 'rgba(204, 255, 0, 0.25)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#161B26';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                        title="Clique para editar este lançamento"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '10px',
                              backgroundColor: `${cat?.color || '#94A3B8'}20`,
                              color: cat?.color || '#94A3B8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconRenderer name={cat?.icon || 'Tag'} size={16} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                                {tx.description}
                              </span>
                              {tx.isInstallment && tx.installmentTotal && (
                                <Badge variant="primary" size="sm" icon={<Layers size={10} />}>
                                  {tx.installmentNumber}/{tx.installmentTotal}
                                </Badge>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                              {new Date(tx.date).toLocaleDateString('pt-BR')} • {cat?.name || 'Geral'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#F43F5E' }}>
                            -{maskValue(formatBrlCurrency(tx.amount))}
                          </div>

                          {/* Botão de Editar */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEditTransaction) onEditTransaction(tx);
                              else setSelectedTxForEdit(tx);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94A3B8',
                              padding: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#CCFF00')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                            title="Editar lançamento"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Botão de Excluir */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tx.isInstallment && tx.installmentGroupId) {
                                setInstallmentTxToDelete(tx);
                              } else {
                                setTxToDelete(tx);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94A3B8',
                              padding: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#F43F5E')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                            title="Excluir lançamento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* Conteúdo da Aba 2: Linha do Tempo (Faturas Futuras) */}
        {activeTab === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
              Previsão de quanto já está comprometido mês a mês pelas compras parceladas e fixas deste cartão:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
              {timeline.map((proj, idx) => (
                <div
                  key={`${proj.year}-${proj.month}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    backgroundColor: idx === 0 ? 'rgba(16, 185, 129, 0.08)' : '#161B26',
                    border: idx === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={15} color={idx === 0 ? '#10B981' : '#38BDF8'} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {proj.monthLabel}
                      </span>
                      {idx === 0 ? (
                        <Badge variant="primary" size="sm">Fatura Atual</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Projeção Futura</Badge>
                      )}
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 800, color: proj.totalAmount > 0 ? '#F43F5E' : '#94A3B8' }}>
                      {maskValue(formatBrlCurrency(proj.totalAmount))}
                    </div>
                  </div>

                  {proj.transactions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                      {proj.transactions.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94A3B8' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                            {t.description}
                          </span>
                          <span style={{ fontWeight: 600, color: '#CBD5E1' }}>
                            {maskValue(formatBrlCurrency(t.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Nenhum valor projetado para esta fatura ainda.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 3: Parcelamentos Ativos */}
        {activeTab === 'installments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                Compras parceladas que estão consumindo o limite deste cartão:
              </span>
              <Button
                size="sm"
                variant="outline"
                icon={<Plus size={14} />}
                onClick={() => {
                  onClose();
                  onAddNewExpense(card.id);
                }}
              >
                Novo Parcelamento
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
              {cardInstallments.length === 0 ? (
                <div
                  style={{
                    padding: '30px 16px',
                    borderRadius: '14px',
                    backgroundColor: '#161B26',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Layers size={28} color="#64748B" />
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Nenhum parcelamento ativo
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', maxWidth: '300px' }}>
                    Ao registrar uma compra parcelada, você acompanha o progresso das parcelas pagas e o limite a ser liberado aqui.
                  </div>
                </div>
              ) : (
                cardInstallments.map(group => {
                  const percentDone = group.installmentTotal > 0
                    ? Math.round((group.paidInstallmentsCount / group.installmentTotal) * 100)
                    : 0;
                  const cat = categoryMap.get(group.categoryId);

                  return (
                    <div
                      key={group.groupId}
                      style={{
                        padding: '14px',
                        borderRadius: '16px',
                        backgroundColor: '#161B26',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                            {group.description}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                            {cat?.name || 'Compras'} • Total: {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Deseja realmente cancelar todas as parcelas restantes de "${group.description}"? Isso liberará o limite comprometido.`)) {
                              await deleteInstallmentGroup(group.groupId);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#F43F5E',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.8,
                          }}
                          title="Excluir parcelamento completo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Barra de Progresso */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: '4px' }}>
                          <span>Progresso: {group.paidInstallmentsCount} de {group.installmentTotal} parcelas</span>
                          <span style={{ fontWeight: 700, color: '#38BDF8' }}>{percentDone}%</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentDone}%`,
                              height: '100%',
                              backgroundColor: '#38BDF8',
                              borderRadius: '999px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', paddingTop: '4px', borderTop: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                        <span style={{ color: '#CBD5E1' }}>
                          {maskValue(formatBrlCurrency(group.monthlyAmount))} / mês
                        </span>
                        <span style={{ color: '#F43F5E', fontWeight: 600 }}>
                          Restam: {maskValue(formatBrlCurrency(group.remainingAmount))}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Botão de Fechar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>
            Fechar Visualização
          </Button>
        </div>
      </div>

      {/* Modal de Edição Direta de Transação */}
      {selectedTxForEdit && (
        <TransactionModal
          isOpen={!!selectedTxForEdit}
          onClose={() => setSelectedTxForEdit(null)}
          initialData={selectedTxForEdit}
          zIndex={10050}
        />
      )}

      {/* Modal de Escolha de Exclusão de Compra Parcelada */}
      {installmentTxToDelete && (
        <Modal
          isOpen={!!installmentTxToDelete}
          onClose={() => setInstallmentTxToDelete(null)}
          title="Excluir Compra Parcelada"
          subtitle={installmentTxToDelete.description}
          maxWidth="460px"
          zIndex={10050}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: '1.4' }}>
              Esta transação faz parte de uma compra parcelada em{' '}
              <strong>{installmentTxToDelete.installmentTotal} parcelas</strong>. Como deseja excluir?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={async () => {
                  await deleteTransaction(installmentTxToDelete.id);
                  setInstallmentTxToDelete(null);
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: '#1E2433',
                  color: '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Excluir apenas esta parcela</span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                  Apenas a parcela {installmentTxToDelete.installmentNumber}/{installmentTxToDelete.installmentTotal} será removida da fatura.
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (installmentTxToDelete.installmentGroupId) {
                    await deleteInstallmentGroup(installmentTxToDelete.installmentGroupId);
                  }
                  setInstallmentTxToDelete(null);
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  backgroundColor: 'rgba(244, 63, 94, 0.08)',
                  color: '#FB7185',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Excluir todo o parcelamento</span>
                <span style={{ fontSize: '0.75rem', color: '#FDA4AF' }}>
                  Cancela todas as parcelas restantes e libera totalmente o limite do cartão.
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setInstallmentTxToDelete(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Moderno de Confirmação de Exclusão de Transação da Fatura */}
      {txToDelete && (
        <ConfirmModal
          isOpen={!!txToDelete}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            await deleteTransaction(txToDelete.id);
            setTxToDelete(null);
          }}
          title="Excluir Lançamento"
          description={`Deseja realmente excluir "${txToDelete.description}" desta fatura? O total da fatura e o limite do cartão serão recalculados.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
          itemDetails={{
            title: txToDelete.description,
            amount: `- R$ ${txToDelete.amount.toFixed(2).replace('.', ',')}`,
            subtitle: `Cartão ${card.name}`,
          }}
        />
      )}
    </Modal>
  );
};
