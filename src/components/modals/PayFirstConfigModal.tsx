import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Bell, Check } from 'lucide-react';
import { getPayFirstConfig, savePayFirstConfig, PayFirstConfig } from '../../core/payFirst/payFirstHelper';
import { SmartNotificationService } from '../../core/notifications/smartNotificationService';

interface PayFirstConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: PayFirstConfig) => void;
}

const PRESET_AMOUNTS = [50, 100, 150, 200, 300, 500];

export const PayFirstConfigModal: React.FC<PayFirstConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<PayFirstConfig>(() => getPayFirstConfig());
  const [amountInput, setAmountInput] = useState<string>(() => config.monthlyAmount.toString());
  const [savedToast, setSavedToast] = useState(false);

  // Controle tátil de arrasto da gaveta (Native Bottom Sheet)
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getPayFirstConfig();
      setConfig(current);
      setAmountInput(current.monthlyAmount.toString());
      setSavedToast(false);
      setDragY(0);
      touchStartY.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 60) {
      onClose();
    }
    setDragY(0);
    touchStartY.current = null;
  };

  const handleToggleEnabled = () => {
    setConfig(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  const handleToggleNotify = async () => {
    const nextState = !config.notifyOnSalary;
    if (nextState) {
      await SmartNotificationService.requestPermission();
    }
    setConfig(prev => ({
      ...prev,
      notifyOnSalary: nextState,
    }));
  };

  const handleSelectPreset = (val: number) => {
    setConfig(prev => ({ ...prev, monthlyAmount: val }));
    setAmountInput(val.toString());
  };

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = parseInt(raw, 10) || 0;
    setAmountInput(num.toString());
    setConfig(prev => ({ ...prev, monthlyAmount: num }));
  };

  const handleSave = () => {
    const finalAmount = Math.max(0, parseInt(amountInput, 10) || config.monthlyAmount);
    const updated: PayFirstConfig = {
      ...config,
      monthlyAmount: finalAmount,
    };
    savePayFirstConfig(updated);
    if (onSaved) onSaved(updated);
    setSavedToast(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000, // Superior à barra de navegação (que usa zIndex: 3000)
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes payFirstSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '85vh',
          backgroundColor: '#0F1612',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: 'none',
          boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.75)',
          padding: '8px 20px calc(34px + var(--safe-area-bottom, 0px))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxSizing: 'border-box',
          transform: dragY > 0 ? `translateY(${dragY}px)` : 'none',
          transition: dragY > 0 ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: dragY === 0 ? 'payFirstSheetSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        {/* Pílula / Handle de controle da gaveta (Gesto de puxar para fechar padrão nativo) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 6px',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '5px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
            }}
          />
        </div>

        {/* Header da Gaveta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'rgba(74, 222, 128, 0.12)',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ADE80',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              Pague-se Primeiro
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
              Reserva e patrimônio antes dos gastos
            </p>
          </div>
        </div>

        {/* Card Explicativo com Tom Amigo (Pierre) */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '12px 14px',
            fontSize: '0.8rem',
            color: '#94A3B8',
            lineHeight: 1.45,
          }}
        >
          💡 <strong style={{ color: '#E2E8F0' }}>A regra de ouro:</strong> Em vez de esperar o fim do mês para ver se sobrou algo, trate sua meta de reserva como um compromisso sagrado que você transfere logo que o salário cai.
        </div>

        {/* Switch Principal: Ativar/Desativar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF' }}>
              Ativar Pague-se Primeiro
            </span>
            <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748B' }}>
              {config.enabled ? 'Recurso ativado no app' : 'Desativado (você pode ativar quando quiser)'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleEnabled}
            style={{
              width: '48px',
              height: '28px',
              borderRadius: '9999px',
              backgroundColor: config.enabled ? '#4ADE80' : 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              transition: 'background-color 0.25s',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: config.enabled ? '#0A0E0C' : '#FFFFFF',
                transform: config.enabled ? 'translateX(20px)' : 'translateX(0px)',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </button>
        </div>

        {/* Seção de Configuração do Valor (Apenas quando ativado) */}
        {config.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#E2E8F0' }}>
              Quanto você quer guardar todo mês?
            </label>

            {/* Pílulas de Seleção Rápida */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_AMOUNTS.map(val => {
                const isSelected = config.monthlyAmount === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectPreset(val)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? '#4ADE80' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#0A0E0C' : '#E2E8F0',
                      border: isSelected ? '1px solid #4ADE80' : '1px solid rgba(255, 255, 255, 0.1)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    R$ {val}
                  </button>
                );
              })}
            </div>

            {/* Input de Valor Customizado */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '10px 14px',
                gap: '8px',
              }}
            >
              <span style={{ color: '#64748B', fontWeight: 600, fontSize: '0.9rem' }}>R$</span>
              <input
                type="text"
                value={amountInput}
                onChange={handleAmountInputChange}
                placeholder="Outro valor..."
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#FFFFFF',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  width: '100%',
                }}
              />
            </div>

            {/* Opção de Notificações de Salário */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={16} color="#94A3B8" />
                <span style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>
                  Lembrar quando o salário cair
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleNotify}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: config.notifyOnSalary ? '#4ADE80' : 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  transition: 'background-color 0.25s',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: config.notifyOnSalary ? '#0A0E0C' : '#FFFFFF',
                    transform: config.notifyOnSalary ? 'translateX(18px)' : 'translateX(0px)',
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* Botão Principal Salvar Preferências */}
        <button
          type="button"
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            backgroundColor: '#4ADE80',
            color: '#0A0E0C',
            border: 'none',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '4px',
            transition: 'opacity 0.2s',
          }}
        >
          {savedToast ? (
            <>
              <Check size={18} strokeWidth={3} />
              <span>Salvo com sucesso!</span>
            </>
          ) : (
            <span>Salvar preferências</span>
          )}
        </button>
      </div>
    </div>
  );
};
