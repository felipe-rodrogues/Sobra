/**
 * Sobra - Bridge de Detecção de Notificações Bancárias
 * Suporte nativo Android (Capacitor / NotificationListenerService) e Simulador integrado para Web/Dev
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { notificationEngine } from '../core/parsers/notificationEngine';
import { ParsedBankNotification } from '../core/types';

export interface NotificationEvent {
  packageName: string;
  title: string;
  text: string;
  subText?: string;
  postTime: number;
}

interface SobraNativePlugin {
  isPermissionGranted(): Promise<{ granted: boolean }>;
  openSettings(): Promise<void>;
  getPendingNotifications(): Promise<{ notifications: NotificationEvent[] }>;
  addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: NotificationEvent) => void
  ): Promise<any>;
}

const SobraNative = registerPlugin<SobraNativePlugin>('SobraNotificationListener');

type NotificationCallback = (parsed: ParsedBankNotification) => void;

class NotificationListenerBridge {
  private listeners: Set<NotificationCallback> = new Set();
  private simulatedPermissionGranted = false;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      try {
        // Escuta notificações em tempo real enviadas pelo serviço nativo
        SobraNative.addListener('notificationReceived', (event: NotificationEvent) => {
          this.handleRawNotification(event.title, event.text, event.packageName);
        });

        // Consome notificações pendentes da fila persistida enquanto o app esteve fechado
        setTimeout(async () => {
          try {
            const res = await SobraNative.getPendingNotifications();
            if (res && res.notifications) {
              res.notifications.forEach(n => {
                this.handleRawNotification(n.title, n.text, n.packageName);
              });
            }
          } catch (err) {
            console.warn('Erro ao ler notificações pendentes:', err);
          }
        }, 800);
      } catch (e) {
        console.warn('Capacitor SobraNative não disponível no ambiente atual:', e);
      }
    }
  }

  private handleRawNotification(title: string, text: string, packageName: string) {
    const parsed = notificationEngine.processNotification(title, text, packageName);
    if (parsed) {
      this.notifyListeners(parsed);
    }
  }

  /**
   * Verifica se a permissão do Android NotificationListener está ativa
   */
  async isPermissionGranted(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await SobraNative.isPermissionGranted();
        return !!res?.granted;
      } catch (e) {
        console.warn('Erro ao checar permissão nativa:', e);
      }
    }
    // No navegador ou ambiente de desenvolvimento, usar flag simulada
    return this.simulatedPermissionGranted;
  }

  /**
   * Abre a tela nativa do Android (ou habilita o simulador no ambiente web/dev)
   */
  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        await SobraNative.openSettings();
        return true;
      } catch (e) {
        console.warn('Erro ao abrir configurações nativas:', e);
      }
    }
    // No modo de teste/web, ativa a permissão simulada
    this.simulatedPermissionGranted = true;
    return true;
  }

  /**
   * Dispara uma notificação simulada para testes do parser e fluxo de revisão
   */
  simulateNotification(title: string, text: string, packageName = 'com.nu.production'): ParsedBankNotification | null {
    const parsed = notificationEngine.processNotification(title, text, packageName);
    if (parsed) {
      this.notifyListeners(parsed);
    }
    return parsed;
  }

  /**
   * Inscreve um ouvinte para notificações recebidas
   */
  subscribe(callback: NotificationCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(parsed: ParsedBankNotification): void {
    this.listeners.forEach(cb => {
      try {
        cb(parsed);
      } catch (e) {
        console.error('Erro ao processar callback de notificação:', e);
      }
    });
  }
}

export const notificationListenerBridge = new NotificationListenerBridge();
