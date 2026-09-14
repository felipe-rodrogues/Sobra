import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { IconRenderer } from '../components/common/IconRenderer';
import { BankLogo } from '../components/common/BankLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  Plus, 
  UploadCloud, 
  Search, 
  Trash2, 
  Bell, 
  FileText,
  Edit3,
  Repeat,
  Layers,
  ArrowLeftRight,
  ArrowRight
} from 'lucide-react';
import { Transaction, Account, Category } from '../core/types';

interface TransactionsScreenProps {
  onOpenNewTransaction: (type?: 'expense' | 'income') => void;
  onOpenCsvImport: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onOpenNewTransaction,
  onOpenCsvImport,
  onEditTransaction,
}) => {
  const { transactions, accounts, categories, subscriptions, deleteTransaction, deleteInstallmentGroup, isPrivacyMode } = useFinance();
  const { colors } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'installments' | 'transfer'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showFutureInstallments, setShowFutureInstallments] = useState(false);
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const accountMap = new Map<string, Account>(accounts.map((a: Account) => [a.id, a]));
  const categoryMap = new Map<string, Category>(categories.map((c: Category) => [c.id, c]));

  // Filtragem: por padrão em "Todas" e "Despesas", oculta parcelas futuras (> 1) para manter a tela limpa
  const filtered = transactions
    .filter((t: Transaction) => {
      if (selectedType === 'installments') {
        if (!t.isInstallment) return false;
      } else {
        if (!showFutureInstallments && t.isInstallment && t.installmentNumber && t.installmentNumber > 1) {
          return false;
        }
        if (selectedType !== 'all' && t.type !== selectedType) return false;
      }
      if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId) return false;
      if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const descMatch = t.description.toLowerCase().includes(lower);
        const catMatch = (categoryMap.get(t.categoryId)?.name || '').toLowerCase().includes(lower);
        if (!descMatch && !catMatch) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'notification':
        return (
          <Badge variant="primary" size="sm" icon={<Bell size={10} />}>
            Notificação
          </Badge>
        );
      case 'csv':
        return (
          <Badge variant="neutral" size="sm" icon={<FileText size={10} />}>
            Extrato CSV
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '30px' }}>
      {/* Barra de Ações Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.textPrimary }}>
            Transações
          </h2>
          <p style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
            {filtered.length} registro{filtered.length === 1 ? '' : 's'} encontrado{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="secondary"
            icon={<UploadCloud size={16} />}
            onClick={onOpenCsvImport}
          >
            Importar CSV
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => onOpenNewTransaction(selectedType === 'income' ? 'income' : 'expense')}
          >
            Adicionar
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Filtro de Tipo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} color={colors.textMuted} style={{ position: 'absolute', left: '14px' }} />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.9rem',
            }}
          />
        </div>

        {/* Filtros em linha */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedType('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: selectedType === 'all' ? colors.primary : colors.surfaceElevated,
              color: selectedType === 'all' ? '#FFFFFF' : colors.textSecondary,
              border: `1px solid ${selectedType === 'all' ? colors.primary : colors.border}`,
              flexShrink: 0,
            }}
          >
            Todas
          </button>
          <button
            onClick={() => setSelectedType('expense')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: selectedType === 'expense' ? colors.expense : colors.surfaceElevated,
              color: selectedType === 'expense' ? '#FFFFFF' : colors.textSecondary,
              border: `1px solid ${selectedType === 'expense' ? colors.expense : colors.border}`,
              flexShrink: 0,
            }}
          >
            Despesas
          </button>
          <button
            onClick={() => setSelectedType('income')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: selectedType === 'income' ? colors.income : colors.surfaceElevated,
              color: selectedType === 'income' ? '#FFFFFF' : colors.textSecondary,
              border: `1px solid ${selectedType === 'income' ? colors.income : colors.border}`,
              flexShrink: 0,
            }}
          >
            Receitas
          </button>
          <button
            onClick={() => setSelectedType('installments')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: selectedType === 'installments' ? '#38BDF8' : colors.surfaceElevated,
              color: selectedType === 'installments' ? '#000000' : colors.textSecondary,
              border: `1px solid ${selectedType === 'installments' ? '#38BDF8' : colors.border}`,
              flexShrink: 0,
            }}
          >
            Parceladas
          </button>
          <button
            onClick={() => setSelectedType('transfer')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: selectedType === 'transfer' ? '#A855F7' : colors.surfaceElevated,
              color: selectedType === 'transfer' ? '#FFFFFF' : colors.textSecondary,
              border: `1px solid ${selectedType === 'transfer' ? '#A855F7' : colors.border}`,
              flexShrink: 0,
            }}
          >
            Transferências
          </button>

          {/* Alternar exibição de parcelas futuras nas abas gerais */}
          {selectedType !== 'installments' && (
            <button
              type="button"
              onClick={() => setShowFutureInstallments(prev => !prev)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: showFutureInstallments ? 'rgba(56, 189, 248, 0.15)' : colors.surfaceElevated,
                color: showFutureInstallments ? '#38BDF8' : colors.textMuted,
                border: `1px solid ${showFutureInstallments ? 'rgba(56, 189, 248, 0.4)' : colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={showFutureInstallments ? 'Ocultar parcelas futuras' : 'Exibir parcelas futuras'}
            >
              <Layers size={12} />
              {showFutureInstallments ? 'Ocultar futuras' : 'Ver futuras'}
            </button>
          )}

          {/* Filtro de Conta */}
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: colors.surfaceElevated,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}
          >
            <option value="all">Todas as Contas</option>
            {accounts.map((a: Account) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Filtro de Categoria */}
          <select
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: colors.surfaceElevated,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Transações */}
      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px', color: colors.textSecondary }}>
          Nenhuma transação encontrada com os filtros selecionados.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((tx: Transaction) => {
            const cat = categoryMap.get(tx.categoryId);
            const acc = accountMap.get(tx.accountId);
            const destAcc = tx.destinationAccountId ? accountMap.get(tx.destinationAccountId) : undefined;
            const dateFormatted = new Date(tx.date).toLocaleDateString('pt-BR');
            const normDesc = tx.description.toLowerCase().trim();
            const isSub = tx.type === 'expense' && subscriptions.some(s => {
              const sNorm = s.name.toLowerCase().trim();
              return normDesc.includes(sNorm) || sNorm.includes(normDesc);
            });

            return (
              <Card
                key={tx.id}
                hoverable
                onClick={() => onEditTransaction(tx)}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                {/* Lado Esquerdo: Ícone da categoria e detalhes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: tx.type === 'transfer' ? 'rgba(168, 85, 247, 0.15)' : `${cat?.color || '#3B82F6'}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {tx.type === 'transfer' ? (
                      <ArrowLeftRight size={20} color="#A855F7" />
                    ) : (
                      <IconRenderer name={cat?.icon || 'Tag'} size={20} color={cat?.color || colors.primary} />
                    )}
                  </div>

                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: colors.textPrimary }}>
                      {tx.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                        {dateFormatted}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>•</span>
                      {tx.type === 'transfer' ? (
                        <span style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {acc?.name || 'Origem'}
                          <ArrowRight size={11} />
                          {destAcc?.name || 'Destino'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: acc?.color || colors.textSecondary, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {acc && <BankLogo bankId={acc.bankId || acc.name} size={15} />}
                          {acc?.name || 'Conta'}
                        </span>
                      )}
                      {getSourceBadge(tx.source)}
                      {tx.type === 'transfer' && (
                        <Badge variant="neutral" size="sm" icon={<ArrowLeftRight size={10} />}>
                          Transferência
                        </Badge>
                      )}
                      {tx.isInstallment && tx.installmentTotal && (
                        <Badge variant="primary" size="sm" icon={<Layers size={10} />}>
                          {tx.installmentNumber}/{tx.installmentTotal}
                        </Badge>
                      )}
                      {isSub && (
                        <Badge variant="primary" size="sm" icon={<Repeat size={10} />}>
                          Assinatura
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Valor e Ações */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: tx.type === 'income' ? colors.income : tx.type === 'expense' ? colors.expense : '#A855F7',
                      }}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔'} {maskValue(formatBrlCurrency(tx.amount))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: colors.textMuted, textTransform: 'capitalize' }}>
                      {tx.type === 'transfer' ? 'Transferência' : tx.paymentMethod === 'credit' ? 'Crédito' : tx.paymentMethod === 'debit' ? 'Débito' : tx.paymentMethod}
                    </div>
                  </div>

                  {/* Botão de Editar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTransaction(tx);
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      color: colors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Editar transação"
                  >
                    <Edit3 size={16} />
                  </button>

                  {/* Botão de Excluir */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tx.isInstallment && tx.installmentGroupId) {
                        setInstallmentTxToDelete(tx);
                      } else {
                        setTxToDelete(tx);
                      }
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      color: colors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Excluir transação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Escolha de Exclusão de Compra Parcelada */}
      {installmentTxToDelete && (
        <Modal
          isOpen={!!installmentTxToDelete}
          onClose={() => setInstallmentTxToDelete(null)}
          title="Excluir Compra Parcelada"
          subtitle={installmentTxToDelete.description}
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.88rem', color: colors.textSecondary, margin: 0, lineHeight: 1.4 }}>
              Esta transação faz parte de uma compra parcelada em <strong>{installmentTxToDelete.installmentTotal}x</strong>. Como você deseja proceder com a exclusão?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button
                variant="outline"
                onClick={async () => {
                  await deleteTransaction(installmentTxToDelete.id);
                  setInstallmentTxToDelete(null);
                }}
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 14px' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    Excluir apenas esta parcela ({installmentTxToDelete.installmentNumber}/{installmentTxToDelete.installmentTotal})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '2px' }}>
                    Mantém as demais parcelas nas faturas dos outros meses
                  </div>
                </div>
              </Button>

              <Button
                variant="danger"
                onClick={async () => {
                  if (installmentTxToDelete.installmentGroupId) {
                    await deleteInstallmentGroup(installmentTxToDelete.installmentGroupId);
                  }
                  setInstallmentTxToDelete(null);
                }}
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 14px' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    Excluir todas as {installmentTxToDelete.installmentTotal} parcelas deste parcelamento
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
                    Cancela o parcelamento completo e libera o limite do cartão
                  </div>
                </div>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setInstallmentTxToDelete(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Moderno de Confirmação de Exclusão de Transação */}
      {txToDelete && (
        <ConfirmModal
          isOpen={!!txToDelete}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            await deleteTransaction(txToDelete.id);
            setTxToDelete(null);
          }}
          title="Excluir Transação"
          description="Deseja realmente remover esta transação do seu extrato? O saldo e os relatórios serão recalculados."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
          itemDetails={{
            title: txToDelete.description,
            amount: `${txToDelete.type === 'income' ? '+' : '-'} R$ ${txToDelete.amount.toFixed(2).replace('.', ',')}`,
            subtitle: `${categoryMap.get(txToDelete.categoryId)?.name || 'Geral'} • ${accountMap.get(txToDelete.accountId)?.name || 'Conta'}`,
          }}
        />
      )}
    </div>
  );
};
