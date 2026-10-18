import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useLongPress } from '../src/hooks/useLongPress';

describe('useLongPress - Hook de detecção de toque longo', () => {
  it('cria manipuladores de evento e renderiza elemento com sucesso', () => {
    let capturedHandlers: any = null;
    const onLongPress = vi.fn();
    const onClick = vi.fn();

    const TestComponent = () => {
      const { bind } = useLongPress({
        onLongPress,
        onClick,
        threshold: 400,
      });

      const handlers = bind({ id: 'item-1' });
      capturedHandlers = handlers;

      return (
        <div data-testid="pressable" {...handlers}>
          Pressione aqui
        </div>
      );
    };

    const html = renderToString(<TestComponent />);

    expect(html).toContain('Pressione aqui');
    expect(capturedHandlers).toBeDefined();
    expect(typeof capturedHandlers.onPointerDown).toBe('function');
    expect(typeof capturedHandlers.onPointerMove).toBe('function');
    expect(typeof capturedHandlers.onPointerUp).toBe('function');
    expect(typeof capturedHandlers.onPointerCancel).toBe('function');
    expect(typeof capturedHandlers.onClick).toBe('function');
    expect(typeof capturedHandlers.onContextMenu).toBe('function');
  });

  it('aciona onContextMenu prevenindo o menu padrão e invocando onLongPress', () => {
    let capturedHandlers: any = null;
    const onLongPress = vi.fn();
    const onClick = vi.fn();

    const TestComponent = () => {
      const { bind } = useLongPress({
        onLongPress,
        onClick,
      });

      capturedHandlers = bind({ id: 'tx-item-context' });
      return <div>Item</div>;
    };

    renderToString(<TestComponent />);

    const mockPreventDefault = vi.fn();
    const mockStopPropagation = vi.fn();

    const mockRect = { top: 100, bottom: 150, left: 10, right: 300, width: 290, height: 50 } as DOMRect;

    capturedHandlers.onContextMenu({
      preventDefault: mockPreventDefault,
      stopPropagation: mockStopPropagation,
      currentTarget: {
        getBoundingClientRect: () => mockRect,
      },
    });

    expect(mockPreventDefault).toHaveBeenCalled();
    expect(mockStopPropagation).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledWith({ id: 'tx-item-context' }, mockRect);
    expect(onClick).not.toHaveBeenCalled();
  });
});
