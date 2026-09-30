import { describe, it, expect } from 'vitest';
import { parseBankCsv, extractInstallmentFromDescription } from '../src/core/parsers/csvParser';

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

  it('deve parsear extrato com linhas de metadados no topo e coluna Historico (ex: Banco do Brasil)', () => {
    const bbCsv = `BANCO DO BRASIL S.A. - EXTRATO CONTA CORRENTE
Cliente: Felipe Rodrigues
Conta: 12345-6 / Periodo: 01 a 15 de Setembro
Data,Historico,Documento,Valor,Saldo
05/09/2026,COMPRA CARTAO 1234,0001,-75.20,1500.00
08/09/2026,DEPOSITO PIX RECEBIDO,0002,300.00,1800.00`;

    const result = parseBankCsv(bbCsv);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].description).toBe('COMPRA CARTAO 1234');
    expect(result.rows[0].amount).toBe(75.20);
    expect(result.rows[0].type).toBe('expense');
    expect(result.rows[1].description).toBe('DEPOSITO PIX RECEBIDO');
    expect(result.rows[1].amount).toBe(300.00);
    expect(result.rows[1].type).toBe('income');
  });

  it('deve parsear extrato com colunas separadas de Débito e Crédito (ex: Bradesco)', () => {
    const bradescoCsv = `Data;Histórico;Docto;Crédito;Débito;Saldo
02/09/2026;Farmácia Popular;123;0,00;45,50;1000,00
03/09/2026;TED Recebida Salário;456;3200,00;0,00;4200,00`;

    const result = parseBankCsv(bradescoCsv);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].description).toBe('Farmácia Popular');
    expect(result.rows[0].amount).toBe(45.50);
    expect(result.rows[0].type).toBe('expense');
    expect(result.rows[1].description).toBe('TED Recebida Salário');
    expect(result.rows[1].amount).toBe(3200.00);
    expect(result.rows[1].type).toBe('income');
  });

  it('deve identificar reembolsos com sinal negativo em fatura de cartão (ex: Nubank)', () => {
    const nubankCardCsv = `date,category,title,amount
2026-09-01,transporte,Uber,25.00
2026-09-02,transporte,Uber,-25.00
2026-09-03,alimentação,iFood,-45.90
2026-09-05,outros,Pagamento recebido,-1500.00`;

    const result = parseBankCsv(nubankCardCsv, { isCreditCard: true });
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(4);

    // Compra Uber
    expect(result.rows[0].description).toBe('Uber');
    expect(result.rows[0].amount).toBe(25.00);
    expect(result.rows[0].type).toBe('expense');
    expect(result.rows[0].isRefund).toBe(false);

    // Estorno Uber (sem a palavra "estorno", apenas com valor negativo -25.00)
    expect(result.rows[1].description).toBe('Uber');
    expect(result.rows[1].amount).toBe(25.00);
    expect(result.rows[1].type).toBe('income');
    expect(result.rows[1].isRefund).toBe(true);

    // Reembolso iFood (valor negativo -45.90)
    expect(result.rows[2].description).toBe('iFood');
    expect(result.rows[2].amount).toBe(45.90);
    expect(result.rows[2].type).toBe('income');
    expect(result.rows[2].isRefund).toBe(true);

    // Pagamento de fatura
    expect(result.rows[3].isInvoicePayment).toBe(true);
    expect(result.rows[3].type).toBe('income');
  });

  it('deve auto-detectar fatura de cartão pelo cabeçalho (title) e tratar valores negativos como reembolso', () => {
    const cardCsv = `date,category,title,amount
2026-09-10,outros,Mercado Livre,-120.00`;

    // Sem options explicitas: deve auto-detectar pelo header 'title'
    const result = parseBankCsv(cardCsv);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(120.00);
    expect(result.rows[0].type).toBe('income');
    expect(result.rows[0].isRefund).toBe(true);
  });

  it('deve reconhecer estornos e reembolsos com palavras-chave e abreviações em extrato bancário', () => {
    const bankCsv = `Data;Descrição;Valor
15/09/2026;EST. COMPRA CANCELADA;75,00
16/09/2026;REEMB. IFOOD REFEICAO;45,00
17/09/2026;DEVOLUCAO PIX RECEBIDA;30,00`;

    const result = parseBankCsv(bankCsv, { isCreditCard: false });
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(3);

    expect(result.rows[0].isRefund).toBe(true);
    expect(result.rows[0].type).toBe('income');
    expect(result.rows[0].amount).toBe(75.00);

    expect(result.rows[1].isRefund).toBe(true);
    expect(result.rows[1].type).toBe('income');
    expect(result.rows[1].amount).toBe(45.00);

    expect(result.rows[2].isRefund).toBe(true);
    expect(result.rows[2].type).toBe('income');
    expect(result.rows[2].amount).toBe(30.00);
  });

  it('deve retornar erro para arquivo vazio ou sem cabeçalho válido', () => {
    const emptyResult = parseBankCsv('');
    expect(emptyResult.success).toBe(false);

    const invalidHeaderResult = parseBankCsv('Nome,Idade\nFelipe,28');
    expect(invalidHeaderResult.success).toBe(false);
  });

  it('deve extrair parcelamento e limpar o título sem deixar parênteses pendentes', () => {
    const res1 = extractInstallmentFromDescription('Shein (1/3)');
    expect(res1.isInstallment).toBe(true);
    expect(res1.installmentNumber).toBe(1);
    expect(res1.installmentTotal).toBe(3);
    expect(res1.cleanDescription).toBe('Shein');

    const res2 = extractInstallmentFromDescription('Ticketmaster (4/4)');
    expect(res2.isInstallment).toBe(true);
    expect(res2.installmentNumber).toBe(4);
    expect(res2.installmentTotal).toBe(4);
    expect(res2.cleanDescription).toBe('Ticketmaster');

    const res3 = extractInstallmentFromDescription('Ballunostudios - Parcela 3/4');
    expect(res3.isInstallment).toBe(true);
    expect(res3.installmentNumber).toBe(3);
    expect(res3.installmentTotal).toBe(4);
    expect(res3.cleanDescription).toBe('Ballunostudios');

    const res4 = extractInstallmentFromDescription('Nio Fibra');
    expect(res4.isInstallment).toBe(false);
    expect(res4.cleanDescription).toBe('Nio Fibra');
  });
});
