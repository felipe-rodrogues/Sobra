import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MarkdownView } from '../src/components/common/MarkdownView';

describe('MarkdownView - Renderizador de Markdown sem caracteres crus', () => {
  it('deve converter títulos sem exibir #', () => {
    const markdown = '### ⚡ 1. Ações Diretas no Aplicativo';
    const html = renderToString(<MarkdownView content={markdown} />);

    expect(html).toContain('⚡ 1. Ações Diretas no Aplicativo');
    expect(html).not.toContain('###');
    expect(html).toContain('<h4');
  });

  it('deve converter negrito sem exibir **', () => {
    const markdown = 'Como seu assistente no **Sobra**, eu posso **analisar suas finanças**!';
    const html = renderToString(<MarkdownView content={markdown} />);

    expect(html).toContain('>Sobra</strong>');
    expect(html).toContain('>analisar suas finanças</strong>');
    expect(html).not.toContain('**');
  });

  it('deve converter listas de marcadores sem exibir * solto', () => {
    const markdown = `* ➕ **Cadastrar Gastos:** Diga algo como *"Gastei 50"*.\n* 💳 **Mover Lançamentos:** De um cartão para outro.`;
    const html = renderToString(<MarkdownView content={markdown} />);

    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('>Cadastrar Gastos:</strong>');
    expect(html).toContain('>&quot;Gastei 50&quot;</em>');
    expect(html).not.toContain('* ➕');
  });

  it('deve converter títulos de quarto nível (####) sem exibir ####', () => {
    const markdown = '#### 1. 🛡️ Garanta o pagamento das obrigações (Blindagem)\n\n#### 2. 📊 Aplique a Estratégia dos 3 Potes para a Sobra Real';
    const html = renderToString(<MarkdownView content={markdown} />);

    expect(html).toContain('1. 🛡️ Garanta o pagamento das obrigações (Blindagem)');
    expect(html).toContain('2. 📊 Aplique a Estratégia dos 3 Potes para a Sobra Real');
    expect(html).not.toContain('####');
    expect(html).toContain('<h5');
  });
});
