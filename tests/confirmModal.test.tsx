import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ConfirmModal } from '../src/components/common/ConfirmModal';

describe('ConfirmModal - Redesign Minimalista Estilo Pierre', () => {
  it('renderiza modal de exclusão de cartão com padrão refinado e micro-card Pierre', () => {
    const html = renderToString(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Excluir cartão"
        description="Todas as faturas, compras e histórico deste cartão serão removidos permanentemente."
        confirmText="Excluir cartão"
        cancelText="Cancelar"
        variant="danger"
        itemDetails={{
          title: 'Banco Inter',
          subtitle: 'Final •••• 9000',
          bankId: 'inter',
          amount: 'R$ 9.000,00',
          amountLabel: 'Limite',
          isAmountDestructive: false,
        }}
      />
    );

    // Título e Descrição
    expect(html).toContain('Excluir cartão');
    expect(html).toContain('Todas as faturas, compras e histórico deste cartão serão removidos permanentemente.');
    expect(html).toContain('Cancelar');

    // Micro-Card de detalhes
    expect(html).toContain('Banco Inter');
    expect(html).toContain('Final •••• 9000');
    expect(html).toContain('Limite');
    expect(html).toContain('R$ 9.000,00');

    // Não deve conter a borda berrante neon ou texto de limite vermelho agressivo
    expect(html).not.toContain('color:#EF4444;flex-shrink:0">R$ 9.000,00');

    // Não deve conter ícone de lixeira (evita padrão clichê de IA)
    expect(html).not.toContain('lucide-trash-2');
  });

  it('retorna null quando isOpen for false', () => {
    const html = renderToString(
      <ConfirmModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Excluir cartão"
      />
    );

    expect(html).toBe('');
  });
});
