import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '../src/core/parsers/csvParser';

describe('Bank CSV Parser', () => {
  it('deve parsear extrato com separador vírgula e valores com sinal negativo', () => {
    const csvData = `Data,Descrição,Valor
2026-09-01,Supermercado Extra,-185.50
2026-09-02,Salário Mensal,4500.00
2026-09-03,Posto de Gasolina,-120.00`;

    const result = parseBankCsv(csvData);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(3);

    expect(result.rows[0].description).toBe('Supermercado Extra');
    expect(result.rows[0].amount).toBe(185.50);
    expect(result.rows[0].type).toBe('expense');

    expect(result.rows[1].description).toBe('Salário Mensal');
    expect(result.rows[1].amount).toBe(4500.00);
    expect(result.rows[1].type).toBe('income');
  });

  it('deve parsear extrato no formato brasileiro com ponto-e-vírgula e datas DD/MM/YYYY', () => {
    const csvData = `Data;Identificador;Valor
10/09/2026;Restaurante Sabor;-89,90
11/09/2026;Pix Recebido Maria;150,00`;

    const result = parseBankCsv(csvData);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0].date).toBe('2026-09-10');
    expect(result.rows[0].amount).toBe(89.90);
    expect(result.rows[0].type).toBe('expense');

    expect(result.rows[1].date).toBe('2026-09-11');
    expect(result.rows[1].amount).toBe(150.00);
    expect(result.rows[1].type).toBe('income');
  });

  it('deve retornar erro para arquivo vazio ou sem cabeçalho válido', () => {
    const emptyResult = parseBankCsv('');
    expect(emptyResult.success).toBe(false);

    const invalidHeaderResult = parseBankCsv('Nome,Idade\nFelipe,28');
    expect(invalidHeaderResult.success).toBe(false);
  });
});
