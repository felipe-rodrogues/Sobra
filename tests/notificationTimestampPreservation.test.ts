import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { resolveNotificationTimestamp, extractDateFromNotificationText } from '../src/core/parsers/dateHelper';
import { notificationEngine } from '../src/core/parsers/notificationEngine';
import { notificationListenerBridge } from '../src/native/notificationListener';

// Polyfill localStorage
const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memoryStorage[k] || null,
    setItem: (k: string, v: string) => { memoryStorage[k] = v; },
    removeItem: (k: string) => { delete memoryStorage[k]; },
    clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
  };
}

describe('Preservação Rigorosa do Momento Real da Compra (Timestamp / PostTime)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. dateHelper: Resolução de Timestamp', () => {
    it('deve converter postTime numérico (ex: compra feita há 3 dias) para ISO string idêntica ao instante original', () => {
      // 3 dias atrás
      const threeDaysAgoMs = Date.now() - (3 * 24 * 60 * 60 * 1000);
      const expectedIso = new Date(threeDaysAgoMs).toISOString();

      const resolved = resolveNotificationTimestamp('Compra aprovada', 'R$ 50,00 no Supermercado', threeDaysAgoMs);
      expect(resolved).toBe(expectedIso);
      expect(new Date(resolved).getTime()).toBe(threeDaysAgoMs);
    });

    it('deve extrair data e hora explícitas do texto da notificação bancária com prioridade máxima', () => {
      const text = 'Compra aprovada no seu cartão em 18/10 às 14:35 no valor de R$ 120,00 em Posto Ipiranga';
      const extracted = extractDateFromNotificationText(text);

      expect(extracted).not.toBeNull();
      const date = new Date(extracted!);
      expect(date.getMonth() + 1).toBe(10);
      expect(date.getDate()).toBe(18);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(35);
    });

    it('deve lidar com formatos de data "dd/mm/aaaa"', () => {
      const text = 'Transferência recebida em 05/09/2026 de R$ 500,00';
      const extracted = extractDateFromNotificationText(text);

      expect(extracted).not.toBeNull();
      const date = new Date(extracted!);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth() + 1).toBe(9);
      expect(date.getDate()).toBe(5);
    });

    it('deve priorizar data explícita do texto mesmo se postTime for fornecido', () => {
      const text = 'Compra realizada em 12/08 às 09:15 no valor de R$ 80,00';
      const nowMs = Date.now();

      const resolved = resolveNotificationTimestamp('Aviso de Compra', text, nowMs);
      const date = new Date(resolved);
      expect(date.getMonth() + 1).toBe(8);
      expect(date.getDate()).toBe(12);
      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(15);
    });
  });

  describe('2. notificationEngine: Repasse de postTime aos Parsers', () => {
    it('deve repassar postTime ao resultado do parser do Nubank', () => {
      const purchaseTime = new Date('2026-10-20T15:30:00.000Z').getTime();
      const parsed = notificationEngine.processNotification(
        'Nubank',
        'Compra aprovada no seu Nubank de R$ 42,90 em PADARIA ESTRELA com final 1234',
        'com.nu.production',
        purchaseTime
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(42.90);
      expect(parsed?.merchant).toBe('PADARIA ESTRELA');
      expect(parsed?.timestamp).toBe('2026-10-20T15:30:00.000Z');
    });

    it('deve repassar postTime ao resultado do parser do Inter', () => {
      const purchaseTime = new Date('2026-10-21T18:45:00.000Z').getTime();
      const parsed = notificationEngine.processNotification(
        'Inter: Compra aprovada',
        'Compra aprovada no Cartão Inter final 5678 de R$ 150,00 no Restaurante Fogão',
        'br.com.intermedium',
        purchaseTime
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(150.00);
      expect(parsed?.timestamp).toBe('2026-10-21T18:45:00.000Z');
    });

    it('deve repassar postTime ao resultado do parser do C6 Bank', () => {
      const purchaseTime = new Date('2026-10-19T11:20:00.000Z').getTime();
      const parsed = notificationEngine.processNotification(
        'C6 Bank',
        'Compra aprovada no seu C6 Bank: R$ 99,00 na Farmácia São Paulo',
        'com.c6bank.app',
        purchaseTime
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(99.00);
      expect(parsed?.timestamp).toBe('2026-10-19T11:20:00.000Z');
    });
  });

  describe('3. notificationListenerBridge: Simulação e Sincronização com Timestamp', () => {
    it('deve repassar postTime através de simulateNotification e subscribe', () => {
      const pastTime = new Date('2026-10-15T12:00:00.000Z').getTime();
      let capturedTimestamp: string | undefined;

      const unsubscribe = notificationListenerBridge.subscribe((parsed) => {
        capturedTimestamp = parsed.timestamp;
      });

      notificationListenerBridge.simulateNotification(
        'Nubank',
        'Compra aprovada no seu Nubank de R$ 85,00 no Mercado Central',
        'com.nu.production',
        pastTime
      );

      expect(capturedTimestamp).toBe('2026-10-15T12:00:00.000Z');
      unsubscribe();
    });
  });
});
