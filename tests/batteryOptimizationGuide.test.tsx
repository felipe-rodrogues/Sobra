import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BatteryOptimizationGuide } from '../src/components/notifications/BatteryOptimizationGuide';
import { notificationListenerBridge } from '../src/native/notificationListener';

describe('BatteryOptimizationGuide', () => {
  it('renderiza o guia com as marcas suportadas', () => {
    const html = renderToString(<BatteryOptimizationGuide />);
    expect(html).toContain('Evitar Suspensão no Celular');
    expect(html).toContain('Xiaomi');
    expect(html).toContain('Samsung');
    expect(html).toContain('Motorola');
    expect(html).toContain('Outros');
    expect(html).toContain('Abrir Configurações do Sobra no Celular');
  });

  it('permite renderização compacta para modais', () => {
    const html = renderToString(<BatteryOptimizationGuide compact={true} />);
    expect(html).toContain('Evitar Suspensão no Celular');
    expect(html).toContain('Xiaomi');
  });

  it('chama openAppSettings pelo bridge de notificação', async () => {
    const spy = vi.spyOn(notificationListenerBridge, 'openAppSettings').mockResolvedValue();
    await notificationListenerBridge.openAppSettings();
    expect(spy).toHaveBeenCalled();
  });
});
