import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { SobraAiReportView } from './SobraAiReportView';

interface SobraAiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosis: SobraFullDiagnosis;
  onExecuteAction: (action: SobraAction) => void;
  onOpenChat?: (prompt?: string) => void;
}

export const SobraAiAnalysisModal: React.FC<SobraAiAnalysisModalProps> = ({
  isOpen,
  onClose,
  diagnosis,
  onExecuteAction,
  onOpenChat,
}) => {
  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
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
            paddingBottom: 'calc(110px + var(--safe-area-bottom, 0px))',
          }}
        >
          {/* Header Minimalista */}
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
              title="Voltar"
            >
              <ArrowLeft size={19} />
            </button>

            <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              Saúde Financeira
            </span>

            <div style={{ width: '42px' }} />
          </header>

          <SobraAiReportView
            diagnosis={diagnosis}
            onExecuteAction={onExecuteAction}
            onOpenChatWithPrompt={onOpenChat ? (prompt) => {
              onClose();
              onOpenChat(prompt);
            } : undefined}
          />
        </div>
      </div>
    </>
  );
};
