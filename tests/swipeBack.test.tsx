import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { calculateSwipeProgress, resetSwipeStackForTests, getActiveSwipeStack } from '../src/hooks/useSwipeBack';
import { SwipeBackIndicator } from '../src/components/common/SwipeBackIndicator';

describe('useSwipeBack & Dual-Edge Navigation System', () => {
  const SCREEN_WIDTH = 400; // Simula tela mobile típica de 400px

  describe('calculateSwipeProgress (Lógica de detecção de bordas)', () => {
    it('detecta toque na borda esquerda (x <= 35) e calcula progresso ao arrastar para a direita', () => {
      // Inicia em x=15 (borda esquerda), arrasta até x=85 (deltaX = 70px)
      const res = calculateSwipeProgress(15, 85, 200, 200, SCREEN_WIDTH, 35, 70);

      expect(res.isEligibleEdge).toBe(true);
      expect(res.edge).toBe('left');
      expect(res.isVerticalScroll).toBe(false);
      expect(res.effectiveDistance).toBe(70);
      expect(res.progress).toBe(1);
      expect(res.isTriggered).toBe(true);
    });

    it('detecta toque na borda direita (x >= screenWidth - 35) e calcula progresso ao arrastar para a esquerda', () => {
      // Inicia em x=385 (borda direita em tela de 400px), arrasta até x=315 (deltaX = -70px)
      const res = calculateSwipeProgress(385, 315, 300, 300, SCREEN_WIDTH, 35, 70);

      expect(res.isEligibleEdge).toBe(true);
      expect(res.edge).toBe('right');
      expect(res.isVerticalScroll).toBe(false);
      expect(res.effectiveDistance).toBe(70);
      expect(res.progress).toBe(1);
      expect(res.isTriggered).toBe(true);
    });

    it('ignora toques iniciados fora das bordas (ex: no centro da tela x = 200)', () => {
      const res = calculateSwipeProgress(200, 300, 200, 200, SCREEN_WIDTH, 35, 70);

      expect(res.isEligibleEdge).toBe(false);
      expect(res.edge).toBe(null);
      expect(res.progress).toBe(0);
      expect(res.isTriggered).toBe(false);
    });

    it('classifica como scroll vertical se o deslocamento vertical for maior que o horizontal', () => {
      // Inicia na borda esquerda (x=20, y=100), move para (x=30, y=150) -> deltaX = 10, deltaY = 50
      const res = calculateSwipeProgress(20, 30, 100, 150, SCREEN_WIDTH, 35, 70);

      expect(res.isEligibleEdge).toBe(true);
      expect(res.isVerticalScroll).toBe(true);
      expect(res.progress).toBe(0);
      expect(res.isTriggered).toBe(false);
    });

    it('não aciona gatilho se o arrasto for parcial (< 70px)', () => {
      // Arrasto de 35px em threshold de 70px -> progresso 50%
      const res = calculateSwipeProgress(10, 45, 200, 200, SCREEN_WIDTH, 35, 70);

      expect(res.isEligibleEdge).toBe(true);
      expect(res.edge).toBe('left');
      expect(res.progress).toBe(0.5);
      expect(res.isTriggered).toBe(false);
    });

    it('não aciona se arrastar na direção oposta (ex: da borda esquerda para a esquerda)', () => {
      const res = calculateSwipeProgress(20, 5, 200, 200, SCREEN_WIDTH, 35, 70);

      expect(res.effectiveDistance).toBe(0);
      expect(res.progress).toBe(0);
      expect(res.isTriggered).toBe(false);
    });
  });

  describe('SwipeBackIndicator Component', () => {
    it('retorna nulo quando não está acontecendo swipe', () => {
      const html = renderToString(
        <SwipeBackIndicator
          swipeState={{
            isSwiping: false,
            edge: null,
            progress: 0,
            touchY: 200,
          }}
        />
      );
      expect(html).toBe('');
    });

    it('renderiza indicador flutuante na borda esquerda quando swipeState estiver na esquerda', () => {
      const html = renderToString(
        <SwipeBackIndicator
          swipeState={{
            isSwiping: true,
            edge: 'left',
            progress: 0.6,
            touchY: 250,
          }}
        />
      );
      expect(html).toContain('left');
      expect(html).toContain('svg');
    });

    it('renderiza indicador flutuante na borda direita quando swipeState estiver na direita', () => {
      const html = renderToString(
        <SwipeBackIndicator
          swipeState={{
            isSwiping: true,
            edge: 'right',
            progress: 0.6,
            touchY: 350,
          }}
        />
      );
      expect(html).toContain('right');
      expect(html).toContain('svg');
    });

    it('muda para cor verde de confirmação (#4ADE80) quando atinge o limiar de disparo (progress >= 0.88)', () => {
      const html = renderToString(
        <SwipeBackIndicator
          swipeState={{
            isSwiping: true,
            edge: 'right',
            progress: 0.88,
            touchY: 350,
          }}
        />
      );
      // Confirma que a cor do indicador pronto está presente com 88% do trajeto
      expect(html).toContain('#4ADE80');
      // Confirma que o ícone na borda direita é rotacionado em 180 graus apontando para a direita
      expect(html).toContain('rotate(180deg)');
    });
  });

  describe('Active Stack Management (Prevenção de conflito entre telas sobrepostas)', () => {
    it('retorna a pilha ativa vazia após reset', () => {
      resetSwipeStackForTests();
      expect(getActiveSwipeStack()).toEqual([]);
    });

    it('garante que a prioridade de OVERLAY_SCREEN (30) é maior que MODAL (20) para responder de primeira', async () => {
      const { BACK_PRIORITY } = await import('../src/core/navigation/backNavigation');
      expect(BACK_PRIORITY.OVERLAY_SCREEN).toBeGreaterThan(BACK_PRIORITY.MODAL);
      expect(BACK_PRIORITY.OVERLAY_SCREEN).toBe(30);
      expect(BACK_PRIORITY.MODAL).toBe(20);
    });

    it('aciona gatilho com facilidade com triggerDistance padrão de 65px ao atingir progress >= 0.88', () => {
      // Inicia em x=10 (borda esquerda), arrasta 58px até x=68
      const res = calculateSwipeProgress(10, 68, 200, 200, SCREEN_WIDTH, 38, 65);
      expect(res.isEligibleEdge).toBe(true);
      expect(res.effectiveDistance).toBe(58);
      expect(res.progress).toBeGreaterThanOrEqual(0.88);
      expect(res.isTriggered).toBe(true);
    });

    it('permite gesto de voltar tanto pela borda esquerda quanto pela borda direita por padrão', () => {
      // Borda esquerda
      const leftRes = calculateSwipeProgress(15, 85, 200, 200, SCREEN_WIDTH);
      expect(leftRes.isEligibleEdge).toBe(true);
      expect(leftRes.edge).toBe('left');
      expect(leftRes.isTriggered).toBe(true);

      // Borda direita
      const rightRes = calculateSwipeProgress(385, 315, 200, 200, SCREEN_WIDTH);
      expect(rightRes.isEligibleEdge).toBe(true);
      expect(rightRes.edge).toBe('right');
      expect(rightRes.isTriggered).toBe(true);
    });
  });
});
