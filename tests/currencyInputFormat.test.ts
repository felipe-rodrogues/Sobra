import { describe, it, expect } from 'vitest';
import { formatCurrencyInput, parseBrlCurrency } from '../src/core/parsers/currencyHelper';

describe('formatCurrencyInput - Máscara monetária inteligente e automática', () => {
  it('deve retornar string vazia para entradas vazias, nulas ou zero', () => {
    expect(formatCurrencyInput('')).toBe('');
    expect(formatCurrencyInput(null)).toBe('');
    expect(formatCurrencyInput(undefined)).toBe('');
    expect(formatCurrencyInput(0)).toBe('');
    expect(formatCurrencyInput('0')).toBe('');
    expect(formatCurrencyInput('0,00')).toBe('');
  });

  it('deve formatar números flutuantes corretamente ao carregar dados existentes', () => {
    expect(formatCurrencyInput(3.2)).toBe('3,20');
    expect(formatCurrencyInput(45.9)).toBe('45,90');
    expect(formatCurrencyInput(1250.5)).toBe('1.250,50');
    expect(formatCurrencyInput(0.05)).toBe('0,05');
  });

  it('deve adicionar pontos e vírgulas dinamicamente conforme os números são digitados', () => {
    // Digitando 3 -> 0,03
    expect(formatCurrencyInput('3')).toBe('0,03');

    // Digitando 2 em seguida (input passa a ter "0,032")
    expect(formatCurrencyInput('0,032', '0,03')).toBe('0,32');

    // Digitando 0 em seguida (input passa a ter "0,320")
    expect(formatCurrencyInput('0,320', '0,32')).toBe('3,20');

    // Digitando 0 em seguida (input passa a ter "3,200")
    expect(formatCurrencyInput('3,200', '3,20')).toBe('32,00');

    // Digitando 0 em seguida -> 320,00
    expect(formatCurrencyInput('32,000', '32,00')).toBe('320,00');

    // Digitando 0 em seguida -> 3.200,00 (ponto de milhar surge automaticamente!)
    expect(formatCurrencyInput('320,000', '320,00')).toBe('3.200,00');

    // Digitando 5 em seguida -> 32.000,05
    expect(formatCurrencyInput('3.200,005', '3.200,00')).toBe('32.000,05');
  });

  it('deve lidar com backspace de forma fluida e inteligente', () => {
    // Apagando de 3.200,00 -> 320,00
    expect(formatCurrencyInput('3.200,0', '3.200,00')).toBe('320,00');

    // Apagando de 320,00 -> 32,00
    expect(formatCurrencyInput('320,0', '320,00')).toBe('32,00');

    // Apagando de 32,00 -> 3,20
    expect(formatCurrencyInput('32,0', '32,00')).toBe('3,20');

    // Apagando de 3,20 -> 0,32
    expect(formatCurrencyInput('3,2', '3,20')).toBe('0,32');

    // Apagando de 0,32 -> 0,03
    expect(formatCurrencyInput('0,3', '0,32')).toBe('0,03');

    // Apagando de 0,03 -> vazio
    expect(formatCurrencyInput('0,0', '0,03')).toBe('');
  });

  it('deve permitir apagar quando o cursor estiver antes da vírgula ou ponto', () => {
    // Usuário tinha "3,20" e o backspace apagou a vírgula, gerando "320"
    expect(formatCurrencyInput('320', '3,20')).toBe('0,32');

    // Usuário tinha "1.000,00" e apagou a vírgula
    expect(formatCurrencyInput('1.00000', '1.000,00')).toBe('100,00');
  });

  it('deve ser totalmente compatível com parseBrlCurrency', () => {
    const formatted = formatCurrencyInput('320'); // 3,20
    expect(formatted).toBe('3,20');
    expect(parseBrlCurrency(formatted)).toBe(3.2);

    const thousands = formatCurrencyInput('125000'); // 1.250,00
    expect(thousands).toBe('1.250,00');
    expect(parseBrlCurrency(thousands)).toBe(1250.0);
  });
});
