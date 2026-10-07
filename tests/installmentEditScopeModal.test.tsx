import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { InstallmentUpdateScopeModal } from '../src/components/modals/InstallmentUpdateScopeModal';
import { extractInstallmentFromDescription } from '../src/core/parsers/csvParser';
import { merchantCleaner } from '../src/core/categorization/merchantCleaner';

describe('InstallmentUpdateScopeModal & Descrição Limpa de Parcelas', () => {
  it('remove qualquer marcação de parcela da descrição para manter dado limpo e imutável', () => {
    // Caso 1: LOLJA (1/2) vindo de importação de fatura
    const test1 = 'LOLJA (1/2)';
    const clean1 = merchantCleaner.stripBankNoise(extractInstallmentFromDescription(test1).cleanDescription);
    expect(clean1).toBe('LOLJA');

    // Caso 2: PG *LOLJA LOLJA(Parcela 01 de 02)
    const test2 = 'PG *LOLJA LOLJA(Parcela 01 de 02)';
    const clean2 = merchantCleaner.stripBankNoise(extractInstallmentFromDescription(test2).cleanDescription);
    expect(clean2).toBe('LOLJA LOLJA');

    // Caso 3: MarcioRamosDe (7/12)
    const test3 = 'MarcioRamosDe (7/12)';
    const clean3 = merchantCleaner.stripBankNoise(extractInstallmentFromDescription(test3).cleanDescription);
    expect(clean3).toBe('MarcioRamosDe');

    // Caso 4: Shein - Parcela 3/3
    const test4 = 'Shein - Parcela 3/3';
    const clean4 = merchantCleaner.stripBankNoise(extractInstallmentFromDescription(test4).cleanDescription);
    expect(clean4).toBe('Shein');
  });

  it('renderiza o modal de atualização de compra parcelada no padrão Pierre', () => {
    const html = renderToString(
      <InstallmentUpdateScopeModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectScope={vi.fn()}
        installmentNumber={1}
        installmentTotal={2}
        transactionTitle="LOLJA"
      />
    );

    // Título e Contexto Natural
    expect(html).toContain('Atualizar compra parcelada');
    expect(html).toContain('LOLJA');
    expect(html).toContain('2 parcelas');

    // Opções
    expect(html).toContain('Todas as parcelas');
    expect(html).toContain('Aplica a alteração em todas as 2 parcelas desta compra');

    expect(html).toContain('Apenas esta parcela');
    expect(html).toContain('Altera somente a parcela 1 de 2');

    // Cancelar
    expect(html).toContain('Cancelar');

    // Sem termos robóticos ou clichês de IA
    expect(html).not.toContain('IA');
    expect(html).not.toContain('Inteligência Artificial');
    expect(html).not.toContain('Detectamos');
  });

  it('não renderiza nada quando isOpen for false', () => {
    const html = renderToString(
      <InstallmentUpdateScopeModal
        isOpen={false}
        onClose={vi.fn()}
        onSelectScope={vi.fn()}
        installmentNumber={1}
        installmentTotal={2}
      />
    );

    expect(html).toBe('');
  });
});
