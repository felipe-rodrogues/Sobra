import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SobiFloatingButton } from '../src/components/common/SobiFloatingButton';
import { FluidAuraWave } from '../src/components/common/FluidAuraWave';
import { SobraTopHeader } from '../src/components/dashboard/SobraTopHeader';

// Mock contexts for SobraAiChatModal
vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    subscriptions: [],
  }),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Felipe Rodrigues',
      email: 'felipe@teste.com',
    },
  }),
}));

import { SobraAiChatModal, deduplicateSessions } from '../src/components/modals/SobraAiChatModal';

describe('PicPay AI Redesign & Sobi Floating System', () => {
  it('1. SobraTopHeader não renderiza mais o robô Sobi no topo do cabeçalho', () => {
    const html = renderToString(
      <SobraTopHeader
        userName="Felipe"
        onOpenNotifications={vi.fn()}
        onOpenAiChat={vi.fn()}
      />
    );

    // O cabeçalho deve ter o nome, olho e sino, mas não a imagem ou título de abrir o robô
    expect(html).toContain('Olá, Felipe');
    expect(html).not.toContain('Abrir Sobi AI');
    expect(html).not.toContain('/assets/sobi/sobi-expr-normal.png');
  });

  it('2. SobiFloatingButton renderiza botão circular flutuante com ícone limpo do Sobi sem anéis concêntricos e reposicionado mais para cima', () => {
    const html = renderToString(
      <SobiFloatingButton onClick={vi.fn()} visible={true} />
    );

    expect(html).toContain('Abrir Sobi AI');
    expect(html).not.toContain('sobi-fab-glow');
    expect(html).toContain('/assets/sobi/sobi-head-clean.png');
    expect(html).toContain('98px');
    // Símbolo de IA (estrela de 4 pontas) presente no botão
    expect(html).toContain('M12 0C12 6.627');
  });

  it('3. FluidAuraWave renderiza efeito de fumaça/onda verde fluida com SVG e blobs', () => {
    const html = renderToString(<FluidAuraWave height={220} />);

    expect(html).toContain('fluid-aura-wave-container');
    expect(html).toContain('fluid-smoke-1');
    expect(html).toContain('fluid-smoke-2');
    expect(html).toContain('fluid-smoke-3');
    expect(html).toContain('fluid-wave-ribbon-a');
    expect(html).toContain('fluid-wave-ribbon-b');
  });

  it('4. SobraAiChatModal renderiza tela inicial estilo PicPay com saudação personalizada e pílulas empilhadas', () => {
    const html = renderToString(
      <SobraAiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Cabeçalho com título centrado
    expect(html).toContain('Sobi AI');

    // Saudação com o primeiro nome real do usuário ("Felipe Rodrigues" -> "Felipe")
    expect(html).toContain('Olá, Felipe');

    // Chamada principal idêntica ao PicPay
    expect(html).toContain('Me conta como posso te ajudar');

    // Pílulas de ações rápidas no padrão do aplicativo
    expect(html).toContain('Analisar meus gastos');
    expect(html).toContain('Qual é a minha sobra atual?');
    expect(html).toContain('Dicas para economizar este mês');
    expect(html).toContain('Ver como você pode me ajudar');

    // Input bar no estilo PicPay com placeholder, microfone e botão circular
    expect(html).toContain('Escreva sua mensagem...');
    expect(html).toContain('Falar por voz');
    expect(html).toContain('Enviar mensagem');
  });

  it('5. SobraAiChatModal posiciona o botão de voltar no topo esquerdo e o Histórico no topo direito, sem botão X', () => {
    const html = renderToString(
      <SobraAiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // O topo esquerdo possui o botão de voltar
    expect(html).toContain('title="Voltar"');
    // O topo direito possui o botão de histórico de conversas no lugar do antigo X
    expect(html).toContain('title="Histórico de conversas"');
    // O botão X de fechar foi totalmente removido
    expect(html).not.toContain('title="Fechar"');
    // Não possui mais o botão destrutivo de lixeira no topo
    expect(html).not.toContain('title="Limpar histórico da conversa"');
  });

  it('6. deduplicateSessions elimina duplicatas da mesma conversa mantendo a sessão mais completa', () => {
    const rawSessions: any[] = [
      {
        id: 'session-1638',
        title: 'Analise meus gastos deste mês ...',
        createdAt: '2026-10-10T16:38:00.000Z',
        updatedAt: '2026-10-10T16:38:30.000Z',
        messages: [
          { id: 'msg-1', sender: 'user', text: 'Analise meus gastos deste mês', timestamp: '2026-10-10T16:36:00.000Z' },
          { id: 'msg-2', sender: 'ai', text: 'Bora dar uma olhada...', timestamp: '2026-10-10T16:36:05.000Z' },
          { id: 'msg-3', sender: 'user', text: 'E os gastos fixos?', timestamp: '2026-10-10T16:38:00.000Z' },
          { id: 'msg-4', sender: 'ai', text: 'Seus gastos fixos são...', timestamp: '2026-10-10T16:38:05.000Z' },
        ],
      },
      {
        id: 'session-1636',
        title: 'Analise meus gastos deste mês ...',
        createdAt: '2026-10-10T16:36:00.000Z',
        updatedAt: '2026-10-10T16:36:00.000Z',
        messages: [
          { id: 'msg-1', sender: 'user', text: 'Analise meus gastos deste mês', timestamp: '2026-10-10T16:36:00.000Z' },
        ],
      },
    ];

    const deduped = deduplicateSessions(rawSessions);
    // Deve conter apenas 1 sessão (a mais completa com 4 mensagens)
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('session-1638');
    expect(deduped[0].messages).toHaveLength(4);
  });

  it('7. deduplicateSessions preserva conversas distintas ocorridas em momentos diferentes', () => {
    const rawSessions: any[] = [
      {
        id: 'session-ontem',
        title: 'Qual minha sobra?',
        createdAt: '2026-10-08T10:00:00.000Z',
        updatedAt: '2026-10-08T10:01:00.000Z',
        messages: [
          { id: 'msg-a', sender: 'user', text: 'Qual minha sobra?', timestamp: '2026-10-08T10:00:00.000Z' },
          { id: 'msg-b', sender: 'ai', text: 'Sua sobra é...', timestamp: '2026-10-08T10:00:05.000Z' },
        ],
      },
      {
        id: 'session-hoje',
        title: 'Qual minha sobra?',
        createdAt: '2026-10-10T15:00:00.000Z',
        updatedAt: '2026-10-10T15:01:00.000Z',
        messages: [
          { id: 'msg-c', sender: 'user', text: 'Qual minha sobra?', timestamp: '2026-10-10T15:00:00.000Z' },
          { id: 'msg-d', sender: 'ai', text: 'Hoje sua sobra é...', timestamp: '2026-10-10T15:00:05.000Z' },
        ],
      },
    ];

    const deduped = deduplicateSessions(rawSessions);
    // Conversas legítimas em dias/momentos diferentes são preservadas
    expect(deduped).toHaveLength(2);
  });

  it('8. Na tela de Histórico, remove o botão "X" e o pill "+ Novo", exibindo apenas o botão circular (+) no mesmo padrão de outras telas', () => {
    const htmlHistory = renderToString(
      <SobraAiChatModal
        isOpen={true}
        onClose={vi.fn()}
        initialShowHistory={true}
      />
    );

    // O cabeçalho deve conter o título "Histórico de Conversas"
    expect(htmlHistory).toContain('Histórico de Conversas');
    // Deve conter o botão de voltar no lado esquerdo
    expect(htmlHistory).toContain('title="Voltar para a conversa"');
    // Deve conter o botão circular (+) para iniciar nova conversa
    expect(htmlHistory).toContain('title="Iniciar nova conversa"');
    // Não deve conter o botão "X" de fechar no cabeçalho do histórico
    expect(htmlHistory).not.toContain('title="Fechar"');
    // Não deve conter o texto pill "+ Novo"
    expect(htmlHistory).not.toContain('>Novo</span>');
  });
});
