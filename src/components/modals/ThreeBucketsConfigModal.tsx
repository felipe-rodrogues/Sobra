import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ThreeBucketsConfig } from '../../core/types';
import { getRecommendedBucketPercentages } from '../../core/buckets/threeBucketsEngine';
import { formatBrlCurrency, parseBrlCurrency, formatCurrencyInput } from '../../core/parsers/currencyHelper';
import { useTheme } from '../../context/ThemeContext';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  Lightbulb, 
  AlertCircle, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Home 
} from 'lucide-react';

interface ThreeBucketsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: number;
  year: number;
  detectedIncome: number;
  currentConfig?: ThreeBucketsConfig | null;
  onSaveConfig: (config: ThreeBucketsConfig) => void;
}

export const ThreeBucketsConfigModal: React.FC<ThreeBucketsConfigModalProps> = ({
  isOpen,
  onClose,
  month,
  year,
  detectedIncome,
  currentConfig,
  onSaveConfig,
}) => {
  const { colors } = useTheme();

  const [useAutoIncome, setUseAutoIncome] = useState(true);
  const [customIncomeStr, setCustomIncomeStr] = useState('');
  
  const [essentialsPct, setEssentialsPct] = useState(70);
  const [lifestylePct, setLifestylePct] = useState(20);
  const [futurePct, setFuturePct] = useState(10);
  const [isCustomized, setIsCustomized] = useState(false);

  const prevIsOpenRef = useRef(false);

  // Inicialização ao abrir modal
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (currentConfig?.customIncome && currentConfig.customIncome > 0) {
        setUseAutoIncome(false);
        setCustomIncomeStr(formatCurrencyInput(currentConfig.customIncome));
      } else {
        setUseAutoIncome(true);
        setCustomIncomeStr(detectedIncome > 0 ? formatCurrencyInput(detectedIncome) : '');
      }

      if (currentConfig?.isCustomized) {
        setEssentialsPct(currentConfig.essentialsPct);
        setLifestylePct(currentConfig.lifestylePct);
        setFuturePct(currentConfig.futurePct);
        setIsCustomized(true);
      } else {
        const income = currentConfig?.customIncome || detectedIncome;
        const rec = getRecommendedBucketPercentages(income);
        setEssentialsPct(rec.essentialsPct);
        setLifestylePct(rec.lifestylePct);
        setFuturePct(rec.futurePct);
        setIsCustomized(false);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, currentConfig, detectedIncome]);

  const effectiveIncome = useAutoIncome 
    ? detectedIncome 
    : (parseBrlCurrency(customIncomeStr) || detectedIncome || 1518);

  const totalPct = essentialsPct + lifestylePct + futurePct;
  const is100 = totalPct === 100;

  const handleApplyPreset = (ess: number, life: number, fut: number) => {
    setEssentialsPct(ess);
    setLifestylePct(life);
    setFuturePct(fut);
    setIsCustomized(true);
  };

  const handleResetToRecommended = () => {
    const rec = getRecommendedBucketPercentages(effectiveIncome);
    setEssentialsPct(rec.essentialsPct);
    setLifestylePct(rec.lifestylePct);
    setFuturePct(rec.futurePct);
    setIsCustomized(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!is100) {
      alert('A soma das três porcentagens deve ser exatamente 100%.');
      return;
    }

    const customIncome = useAutoIncome ? undefined : parseBrlCurrency(customIncomeStr);

    const config: ThreeBucketsConfig = {
      month,
      year,
      customIncome: customIncome && customIncome > 0 ? customIncome : undefined,
      essentialsPct,
      lifestylePct,
      futurePct,
      isCustomized,
      updatedAt: new Date().toISOString(),
    };

    onSaveConfig(config);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calibrar os 3 Pilares"
      subtitle={`Ajuste as metas de gastos proporcionais para sua renda (${month}/${year})`}
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* 1. Seleção de Renda Base */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF' }}>
              Renda Mensal de Referência
            </label>
            <button
              type="button"
              onClick={() => setUseAutoIncome(!useAutoIncome)}
              style={{
                fontSize: '0.74rem',
                color: useAutoIncome ? '#A3E635' : '#9CA3AF',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              {useAutoIncome ? 'Definir valor manual' : 'Usar receita detectada'}
            </button>
          </div>

          {useAutoIncome ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>
                {formatBrlCurrency(detectedIncome)}
              </span>
              <span style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>
                (calculada automaticamente pelas suas receitas)
              </span>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#9CA3AF',
                  }}
                >
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customIncomeStr}
                  onChange={e => setCustomIncomeStr(formatCurrencyInput(e.target.value, customIncomeStr))}
                  placeholder="0,00"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: '#1E232B',
                    color: '#FFFFFF',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Sliders e Controles dos 3 Baldes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Balde 1: Essenciais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Home size={15} color="#78BC71" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Essenciais (Pra Viver)
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#78BC71' }}>
                {essentialsPct}% · {formatBrlCurrency((effectiveIncome * essentialsPct) / 100)}
              </div>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              step={1}
              value={essentialsPct}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setEssentialsPct(val);
                setIsCustomized(true);
              }}
              style={{ width: '100%', accentColor: '#78BC71', cursor: 'pointer' }}
            />
          </div>

          {/* Balde 2: Estilo de Vida */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#F97316" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Estilo de Vida (Pra Curtir)
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#F97316' }}>
                {lifestylePct}% · {formatBrlCurrency((effectiveIncome * lifestylePct) / 100)}
              </div>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              value={lifestylePct}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setLifestylePct(val);
                setIsCustomized(true);
              }}
              style={{ width: '100%', accentColor: '#F97316', cursor: 'pointer' }}
            />
          </div>

          {/* Balde 3: Futuro */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#22C55E" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Futuro & Sobra (Pra Amanhã)
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#22C55E' }}>
                {futurePct}% · {formatBrlCurrency((effectiveIncome * futurePct) / 100)}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={futurePct}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setFuturePct(val);
                setIsCustomized(true);
              }}
              style={{ width: '100%', accentColor: '#22C55E', cursor: 'pointer' }}
            />
          </div>

          {/* Totalizador de Porcentagem */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '10px',
              backgroundColor: is100 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              border: is100 ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)',
              fontSize: '0.82rem',
              color: is100 ? '#4ADE80' : '#FB7185',
              fontWeight: 600,
            }}
          >
            <span>Total da distribuição:</span>
            <span>{totalPct}% {is100 ? '✓ Equilibrado' : `(deve fechar em 100%, ajuste ${100 - totalPct > 0 ? `+${100 - totalPct}%` : `${100 - totalPct}%`})`}</span>
          </div>
        </div>

        {/* 3. Atalhos de Presets Rápidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.74rem', color: '#9CA3AF', fontWeight: 600 }}>
            Predefinições Rápidas:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleApplyPreset(80, 15, 5)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              80/15/5 (Básico)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(70, 20, 10)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              70/20/10 (Fôlego)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(60, 25, 15)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              60/25/15 (Consolidação)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(50, 30, 20)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              50/30/20 (Tradicional)
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToRecommended}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#A3E635',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 0',
              marginTop: '4px',
            }}
          >
            <RotateCcw size={13} />
            <span>Restaurar recomendação do Sobra para minha renda</span>
          </button>
        </div>

        {/* 4. Aviso Educativo de Precisão dentro do Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '11px 13px',
            borderRadius: '12px',
            backgroundColor: 'rgba(163, 230, 53, 0.06)',
            border: '1px solid rgba(163, 230, 53, 0.16)',
            fontSize: '0.76rem',
            color: '#D1D5DB',
            lineHeight: 1.4,
          }}
        >
          <Lightbulb size={16} color="#A3E635" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            <strong style={{ color: '#A3E635' }}>Importante:</strong> Para que os tetos funcionem com exatidão, mantenha suas compras na categoria correta ao aprovar notificações (ex: Supermercado vs Delivery).
          </span>
        </div>

        {/* 5. Ações */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!is100}
            style={{ flex: 1, backgroundColor: is100 ? '#10B981' : '#4B5563', color: '#FFFFFF' }}
          >
            Salvar Metas
          </Button>
        </div>
      </form>
    </Modal>
  );
};
