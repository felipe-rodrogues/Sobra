import React from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight, UploadCloud, X } from 'lucide-react';

interface QuickNewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewExpense: () => void;
  onNewIncome: () => void;
  onNewTransfer: () => void;
  onCsvImport?: () => void;
}

export const QuickNewActionModal: React.FC<QuickNewActionModalProps> = ({
  isOpen,
  onClose,
  onNewExpense,
  onNewIncome,
  onNewTransfer,
  onCsvImport,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      id: 'expense',
      label: 'Nova Despesa',
      subtitle: 'Saída ou compra no cartão',
      icon: ArrowDown,
      color: '#FB7185',
      bgColor: 'rgba(244, 63, 94, 0.15)',
      onClick: () => {
        onClose();
        onNewExpense();
      },
    },
    {
      id: 'income',
      label: 'Nova Receita',
      subtitle: 'Salário, rendimento ou entrada',
      icon: ArrowUp,
      color: '#4ADE80',
      bgColor: 'rgba(34, 197, 94, 0.15)',
      onClick: () => {
        onClose();
        onNewIncome();
      },
    },
    {
      id: 'transfer',
      label: 'Transferir entre Contas',
      subtitle: 'Movimentar saldo sem alterar balanço',
      icon: ArrowLeftRight,
      color: '#38BDF8',
      bgColor: 'rgba(56, 189, 248, 0.15)',
      onClick: () => {
        onClose();
        onNewTransfer();
      },
    },
    ...(onCsvImport ? [{
      id: 'csv',
      label: 'Importar Extrato CSV',
      subtitle: 'Nubank, Itaú, C6, Bradesco e outros',
      icon: UploadCloud,
      color: '#C084FC',
      bgColor: 'rgba(192, 132, 252, 0.15)',
      onClick: () => {
        onClose();
        onCsvImport();
      },
    }] : []),
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 calc(var(--safe-area-bottom, 0px) + 20px) 0',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#131915',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          padding: '24px 20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          margin: '0 16px',
        }}
      >
        {/* Top Header do Action Sheet */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Adicionar Lançamento
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              O que você deseja registrar agora?
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  backgroundColor: '#1A231C',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#232E26';
                  e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1A231C';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: action.bgColor,
                    color: action.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                    {action.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
