import React from 'react';
import { ChevronRight } from 'lucide-react';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Transaction, Category } from '../../core/types';

interface RecentTransactionsSectionProps {
  transactions: Transaction[];
  categories: Category[];
  maskValue: (v: string) => string;
  onViewAll: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const RecentTransactionsSection: React.FC<RecentTransactionsSectionProps> = ({
  transactions,
  categories,
  maskValue,
  onViewAll,
  onSelectTransaction,
}) => {
  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  // Pegar as 3 transações mais recentes ordenadas por data
  const recentTxns = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // Formatar data relativa e hora amigável
  const formatFriendlyDate = (dateStr: string) => {
    const txDate = new Date(dateStr);
    const now = new Date();
    
    // Comparar se é hoje ou ontem
    const isToday = txDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = txDate.toDateString() === yesterday.toDateString();

    const hours = String(txDate.getHours()).padStart(2, '0');
    const minutes = String(txDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) return `Hoje, ${timeStr}`;
    if (isYesterday) return `Ontem, ${timeStr}`;

    return txDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  return (
    <div
      className="card-sobra"
      style={{
        padding: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.13)',
      }}
    >
      {/* Ambient Glow sutil */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          backgroundColor: 'rgba(74, 222, 128, 0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header: "Últimas movimentações" + "Ver todas >" */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <h3
          style={{
            fontSize: '1.08rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Últimas movimentações
        </h3>

        <button
          type="button"
          onClick={onViewAll}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#94A3B8',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#4ADE80')}
          onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
        >
          <span>Ver todas</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Lista de Transações */}
      {recentTxns.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 10px',
            color: '#64748B',
            fontSize: '0.86rem',
          }}
        >
          Nenhuma movimentação registrada recentemente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentTxns.map((tx) => {
            const cat = categoryMap.get(tx.categoryId);
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';

            // Cores do avatar circular do mockup:
            // Vermelho/Rose para despesa, Verde para receita, Azul para transferência
            const badgeBg = isExpense
              ? 'rgba(244, 63, 94, 0.18)'
              : isIncome
              ? 'rgba(34, 197, 94, 0.18)'
              : 'rgba(56, 189, 248, 0.18)';

            const iconColor = isExpense
              ? '#FB7185'
              : isIncome
              ? '#4ADE80'
              : '#38BDF8';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction && onSelectTransaction(tx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  cursor: onSelectTransaction ? 'pointer' : 'default',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (onSelectTransaction) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }}
                onMouseLeave={e => {
                  if (onSelectTransaction) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Lado Esquerdo: Avatar Circular + Descrição e Data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: badgeBg,
                      color: iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconRenderer name={cat?.icon || (isExpense ? 'ShoppingBag' : 'TrendingUp')} size={18} />
                  </div>

                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tx.description}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: '#64748B',
                        marginTop: '2px',
                      }}
                    >
                      {formatFriendlyDate(tx.date)}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Valor Formatado */}
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    color: isIncome ? '#4ADE80' : '#FFFFFF',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {isExpense ? '- ' : isIncome ? '+ ' : ''}
                  {maskValue(formatBrlCurrency(tx.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
