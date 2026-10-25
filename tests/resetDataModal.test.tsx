import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ResetDataModal } from '../src/components/modals/ResetDataModal';

describe('ResetDataModal - Modal dedicado de segurança para zerar dados (Padrão Pierre)', () => {
  it('não renderiza nada quando isOpen for false', () => {
    const html = renderToString(
      <ResetDataModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renderiza título, texto direto e exigência de digitação sem caixas aninhadas ou ícones de IA', () => {
    const html = renderToString(
      <ResetDataModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Zerar dados');
    expect(html).toContain('Todos os cartões, contas e lançamentos salvos serão apagados permanentemente deste dispositivo.');
    expect(html).toContain('Esta ação não pode ser desfeita.');
    expect(html).toContain('ZERAR');
    expect(html).toContain('para confirmar:');
    expect(html).toContain('placeholder="ZERAR"');
    expect(html).toContain('Cancelar');
    expect(html).toContain('Zerar dados');

    // Sem card dentro de card nem ícones clichês de alerta
    expect(html).not.toContain('AlertTriangle');
    expect(html).not.toContain('lucide-alert-triangle');
  });

  it('exibe estado de carregamento quando isResetting for true', () => {
    const html = renderToString(
      <ResetDataModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isResetting={true}
      />
    );

    expect(html).toContain('Zerando...');
  });
});
