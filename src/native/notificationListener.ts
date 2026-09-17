/**
 * Sobra - Bridge de Detecção de Notificações Bancárias
 * Suporte nativo Android (Capacitor / NotificationListenerService),
 * Gerenciamento de Bateria, Auto-Rebind e Simulador integrado para Web/Dev
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

export interface DiagnosticLogEvent {
  id: string;
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
  status: 'captured' | 'debounced' | 'connected' | 'disconnected' | 'ignored';
}

export interface ServiceStatus {
  granted: boolean;
  connected: boolean;
  isIgnoringBattery: boolean;
}

interface SobraNativePlugin {
  isPermissionGranted(): Promise<{ granted: boolean; connected?: boolean }>;
  getServiceStatus(): Promise<ServiceStatus>;
  reconnectService(): Promise<{ success: boolean; connected: boolean }>;
  openSettings(): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  getPendingNotifications(): Promise<{ notifications: NotificationEvent[] }>;
  getDiagnosticLogs(): Promise<{ logs: DiagnosticLogEvent[] }>;
  clearDiagnosticLogs(): Promise<void>;
  addListener(
    eventName: 'notificationReceived' | 'appResumed',
    listenerFunc: (data: any) => void
  ): Promise<any>;
}

const SobraNative = registerPlugin<SobraNativePlugin>('SobraNotificationListener');

type NotificationCallback = (parsed: ParsedBankNotification) => void;

class NotificationListenerBridge {
  private listeners: Set<NotificationCallback> = new Set();
  private simulatedPermissionGranted = false;
  private simulatedConnected = true;
  private simulatedBatteryIgnored = true;
  private simulatedLogs: DiagnosticLogEvent[] = [];

  constructor() {
    if (Capacitor.isNativePlatform()) {
      try {
        // Escuta notificações em tempo real enviadas pelo serviço nativo
        SobraNative.addListener('notificationReceived', (event: NotificationEvent) => {
          this.handleRawNotification(event.title, event.text, event.packageName);
        });

        // Escuta evento de retomada do app (Android onResume)
        SobraNative.addListener('appResumed', () => {
          this.syncPendingNotifications();
        });

        // Escuta eventos web padrão de visibilidade e foco para sincronização contínua
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              this.syncPendingNotifications();
            }
          });
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('focus', () => {
            this.syncPendingNotifications();
          });
        }
      } catch (e) {
        console.warn('Capacitor SobraNative não disponível no ambiente atual:', e);
      }
    }
  }

  /**
   * Consome a fila de notificações acumuladas em SharedPreferences
   */
  async syncPendingNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const res = await SobraNative.getPendingNotifications();
      if (res && res.notifications && res.notifications.length > 0) {
        res.notifications.forEach(n => {
          this.handleRawNotification(n.title, n.text, n.packageName);
        });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar notificações pendentes:', err);
    }
  }

  private handleRawNotification(title: string, text: string, packageName: string) {
    const parsed = notificationEngine.processNotification(title, text, packageName);
    if (parsed) {
      this.notifyListeners(parsed);
    }
  }

  /**
   * Obtém o status completo de conexão, permissão e política de bateria
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await SobraNative.getServiceStatus();
      } catch (e) {
        console.warn('Erro ao obter status do serviço nativo:', e);
      }
    }
    return {
      granted: this.simulatedPermissionGranted,
      connected: this.simulatedConnected,
      isIgnoringBattery: this.simulatedBatteryIgnored,
    };
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
    return this.simulatedPermissionGranted;
  }

  /**
   * Força a reconexão/rebind do serviço com o Android
   */
  async reconnectService(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await SobraNative.reconnectService();
        await this.syncPendingNotifications();
        return !!res?.success;
      } catch (e) {
        console.warn('Erro ao forçar reconexão do serviço nativo:', e);
      }
    }
    this.simulatedConnected = true;
    return true;
  }

  /**
   * Abre a tela nativa de autorização de notificações do Android
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
    this.simulatedPermissionGranted = true;
    return true;
  }

  /**
   * Checa se o app está isento da otimização de bateria
   */
  async isBatteryOptimizationIgnored(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await SobraNative.isBatteryOptimizationIgnored();
        return !!res?.ignored;
      } catch (e) {
        console.warn('Erro ao checar otimização de bateria:', e);
      }
    }
    return this.simulatedBatteryIgnored;
  }

  /**
   * Solicita diálogo nativo do Android para rodar irrestrito em segundo plano
   */
  async requestIgnoreBatteryOptimization(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await SobraNative.requestIgnoreBatteryOptimization();
        return;
      } catch (e) {
        console.warn('Erro ao solicitar isenção de bateria:', e);
      }
    }
    this.simulatedBatteryIgnored = true;
  }

  /**
   * Obtém histórico recente de notificações capturadas pelo sistema para diagnóstico
   */
  async getDiagnosticLogs(): Promise<DiagnosticLogEvent[]> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await SobraNative.getDiagnosticLogs();
        return res?.logs || [];
      } catch (e) {
        console.warn('Erro ao ler logs de diagnóstico:', e);
      }
    }
    return this.simulatedLogs;
  }

  /**
   * Limpa o histórico de diagnóstico
   */
  async clearDiagnosticLogs(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await SobraNative.clearDiagnosticLogs();
      } catch (e) {
        console.warn('Erro ao limpar logs de diagnóstico:', e);
      }
    }
    this.simulatedLogs = [];
  }

  /**
   * Dispara uma notificação simulada para testes do parser e fluxo de revisão
   */
  simulateNotification(title: string, text: string, packageName = 'com.nu.production'): ParsedBankNotification | null {
    const parsed = notificationEngine.processNotification(title, text, packageName);
    if (parsed) {
      this.notifyListeners(parsed);
      this.simulatedLogs.unshift({
        id: `sim-${Date.now()}`,
        packageName,
        title,
        text,
        timestamp: Date.now(),
        status: 'captured',
      });
    }
    return parsed;
  }

  /**
   * Inscreve um ouvinte para notificações recebidas e esvazia fila acumulada
   */
  subscribe(callback: NotificationCallback): () => void {
    this.listeners.add(callback);
    // Sincroniza notificações pendentes assim que o primeiro ouvinte se conectar
    this.syncPendingNotifications();
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
