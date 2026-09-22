import React, { useState } from 'react';
import { ShieldCheck, Check, ArrowRight, X, Settings2 } from 'lucide-react';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Transaction } from '../../core/types';

interface PayFirstSalaryBannerProps {
  salaryTx: Transaction | null;
  monthlyAmount: number;
  isConfigured: boolean;
  onMarkAsPaid: () => void;
  onTransfer: () => void;
  onOpenConfig: () => void;
  onDismiss: () => void;
}

export const PayFirstSalaryBanner: React.FC<PayFirstSalaryBannerProps> = ({
  salaryTx,
  monthlyAmount,
  isConfigured,
  onMarkAsPaid,
  onTransfer,
  onOpenConfig,
  onDismiss,
}) => {
  const [isMarking, setIsMarking] = useState(false);
  const [markedDone, setMarkedDone] = useState(false);

  const handleMarkPaid = () => {
    setIsMarking(true);
    setMarkedDone(true);
    setTimeout(() => {
      onMarkAsPaid();
    }, 450);
  };

  if (markedDone) {
    return (
      <div
        style={{
          background: 'linear-gradient(145deg, #132418 0%, #0d1611 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(74, 222, 128, 0.4)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#4ADE80',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0A0E0C',
          }}
        >
          <Check size={18} strokeWidth={3} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#4ADE80' }}>
            Meta do mês garantida!
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>
            Você se pagou primeiro. Seu futuro agradece!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #131c16 0%, #0d120f 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(74, 222, 128, 0.18)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Ambient Glow sutil verde esmeralda no topo */}
      <div
        style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: 'rgba(74, 222, 128, 0.12)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header do Card: Tag + Botão Fechar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 9px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.25)',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#4ADE80',
            letterSpacing: '0.02em',
          }}
        >
          <ShieldCheck size={13} strokeWidth={2.4} />
          <span>{isConfigured ? 'PAGUE-SE PRIMEIRO' : 'NOVA DICA DE OURO'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isConfigured && (
            <button
              type="button"
              onClick={onOpenConfig}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
              }}
              title="Ajustar meta"
            >
              <Settings2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            title="Dispensar este mês"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Mensagem e Contexto */}
      <div style={{ position: 'relative' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '0.96rem',
            fontWeight: 700,
            color: '#FFFFFF',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          {isConfigured
            ? `Salário entrou! Hora de separar seus ${formatBrlCurrency(monthlyAmount)}`
            : 'Salário identificado! Que tal se pagar primeiro?'}
        </h4>

        <p
          style={{
            margin: '4px 0 0',
            fontSize: '0.8rem',
            color: '#94A3B8',
            lineHeight: 1.45,
          }}
        >
          {isConfigured
            ? 'Proteja sua reserva antes que o dinheiro se misture com os gastos do mês.'
            : 'Trate sua reserva como um boleto para você mesmo. Guarde uma parte assim que o salário cair!'}
        </p>

        {salaryTx && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '6px',
              fontSize: '0.72rem',
              color: '#64748B',
            }}
          >
            Detectado: {salaryTx.description} ({formatBrlCurrency(salaryTx.amount)})
          </span>
        )}
      </div>

      {/* Botões de Ação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '2px',
          position: 'relative',
        }}
      >
        {isConfigured ? (
          <>
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={isMarking}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: '#4ADE80',
                color: '#0A0E0C',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'transform 0.15s, opacity 0.15s',
              }}
            >
              <Check size={16} strokeWidth={2.6} />
              <span>Já guardei</span>
            </button>

            <button
              type="button"
              onClick={onTransfer}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#E2E8F0',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>Transferir</span>
              <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenConfig}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: '#4ADE80',
                color: '#0A0E0C',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span>Definir minha meta</span>
              <ArrowRight size={15} />
            </button>

            <button
              type="button"
              onClick={onDismiss}
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Agora não
            </button>
          </>
        )}
      </div>
    </div>
  );
};
