import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StartupSplashScreen } from '../src/components/common/StartupSplashScreen';

describe('StartupSplashScreen - Animação de Inicialização Oficial', () => {
  it('renderiza o splash screen com os elementos institucionais da marca', () => {
    const html = renderToString(
      <StartupSplashScreen isReady={false} />
    );

    // Contêiner acessível
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Carregando Sobra"');

    // Marca e Tipografia Oficial
    expect(html).toContain('Sobra');
    expect(html).toContain('Mais do seu amanhã');
    expect(html).toContain('Controle Financeiro Inteligente');

    // Imagem do logotipo oficial
    expect(html).toContain('src="/assets/sobra_icon.png"');

    // Classes de animação e acabamento
    expect(html).toContain('splash-icon-anim');
    expect(html).toContain('splash-glow-anim');
    expect(html).toContain('splash-shimmer-anim');
    expect(html).toContain('splash-brand-anim');
    expect(html).toContain('splash-sub-anim');
  });

  it('renderiza o layout em tela cheia com fundo escuro e safe areas', () => {
    const html = renderToString(
      <StartupSplashScreen isReady={false} />
    );

    expect(html).toContain('position:fixed');
    expect(html).toContain('background-color:#070A0E');
    expect(html).toContain('z-index:99999');
  });
});
