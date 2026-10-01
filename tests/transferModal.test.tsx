import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TransferModal } from '../src/components/modals/TransferModal';

// Mock do FinanceContext
vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [
      {
        id: 'acc-1',
        name: 'Conta Principal',
        type: 'checking',
        balance: 907.41,
        color: '#10B981',
        bankId: 'nubank',
      },
      {
        id: 'acc-2',
        name: 'Reserva de Emergência',
        type: 'savings',
        balance: 5000.00,
        color: '#3B82F6',
        bankId: 'inter',
      },
      {
        id: 'card-1',
        name: 'Cartão de Crédito',
        type: 'credit_card',
        balance: 0,
        color: '#8B5CF6',
      },
    ],
    saveTransaction: vi.fn(),
  }),
}));

describe('TransferModal - Design Neutro e Clean Pierre', () => {
  it('não renderiza nada quando isOpen é false', () => {
    const html = renderToString(
      <TransferModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renderiza título limpo, herói de valor e card conectado de contas quando isOpen é true', () => {
    const html = renderToString(
      <TransferModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Título direto e sem subtítulo redundante
    expect(html).toContain('Transferência');
    expect(html).not.toContain('Mova saldo entre suas contas próprias');

    // Hero do Valor em cápsula limpa
    expect(html).toContain('Valor da Transferência');
    expect(html).toContain('R$');

    // Card unificado de contas (Origem e Destino com nomes legíveis e sem corte)
    expect(html).toContain('De (Origem)');
    expect(html).toContain('Para (Destino)');
    expect(html).toContain('Conta Principal');
    expect(html).toContain('Reserva de Emergência');

    // Não deve conter os botões poluídos de +R$ 50, +R$ 100, etc.
    expect(html).not.toContain('+R$ 50');
    expect(html).not.toContain('+R$ 100');
    expect(html).not.toContain('+R$ 200');
    expect(html).not.toContain('+R$ 500');

    // Botão discreto de transferência total
    expect(html).toContain('Transferir tudo');

    // Não deve conter a tag HTML <select> nativa crua que polui a interface
    expect(html).not.toContain('<select');

    // Alinhamento perfeito de Data e Anotação (labels com height: 18px e sem quebra torta)
    expect(html).toContain('transfer-date-input');
    expect(html).toContain('transfer-desc-input');
    expect(html).toContain('Data');
    expect(html).toContain('Anotação');
    expect(html).toContain('Opcional');

    // Botão de ação principal
    expect(html).toContain('Confirmar Transferência');
  });
});
