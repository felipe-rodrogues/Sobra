import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from './SwipeBackIndicator';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '480px',
  zIndex = 9999,
}) => {
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const backdrops = Array.from(document.querySelectorAll<HTMLElement>('[data-modal-backdrop]'));
        if (backdrops.length > 0) {
          const maxZ = Math.max(...backdrops.map(b => parseInt(b.getAttribute('data-modal-zindex') || '0', 10)));
          if (zIndex >= maxZ) {
            e.stopPropagation();
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const remainingModals = document.querySelectorAll('[data-modal-backdrop]');
      if (remainingModals.length <= 1) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, onClose, zIndex]);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  const modalElement = (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        data-modal-backdrop="true"
        data-modal-zindex={zIndex}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: zIndex,
          padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
          boxSizing: 'border-box',
        }}
        onClick={onClose}
      >
        <div
          className="animate-slide-up"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px',
            width: '100%',
            maxWidth,
            maxHeight: 'calc(100dvh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 32px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: colors.textPrimary }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginTop: '2px' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '8px',
                color: colors.textSecondary,
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              padding: '20px 18px',
              overflowY: 'auto',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );

  return mounted && typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
