import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { GeminiClient } from '../../core/ai/geminiClient';
import { buildFinancialSystemPrompt } from '../../core/ai/geminiPromptBuilder';
import { AiActionExecutor, ActionResolutionContext } from '../../core/ai/aiActionExecutor';
import { ChatMessage, ProposedAiAction } from '../../core/ai/geminiTypes';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';
import { sobraAiEngine } from '../../core/ai/sobraAiEngine';
import { 
  SobiPersonalityId, 
  getSobiPersonality, 
  loadSavedPersonality 
} from '../../core/ai/sobiPersonality';
import { MarkdownView } from '../common/MarkdownView';
import { SobiAvatar, SobiExpression } from '../common/SobiAvatar';
import { SobraAiReportView } from './SobraAiReportView';
import { 
  Send, 
  X, 
  Trash2, 
  Check,
  RefreshCw,
  User, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  Activity,
  Sparkles
} from 'lucide-react';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface SobraAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosis?: SobraFullDiagnosis | null;
  initialPrompt?: string;
  initialTab?: 'chat' | 'report';
  onExecuteAction?: (action: SobraAction) => void;
}

const CHAT_STORAGE_KEY = 'sobra_ai_chat_history_v1';

export const SobraAiChatModal: React.FC<SobraAiChatModalProps> = ({
  isOpen,
  onClose,
  diagnosis,
  initialPrompt,
  initialTab = 'chat',
  onExecuteAction,
}) => {
  const finance = useFinance();

  // Visão Ativa: Conversa com Sobi vs Relatório de Saúde Financeira
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'chat');
    }
  }, [isOpen, initialTab]);

  const hasConfiguredKey = true;

  // Estado da Conversa
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [personalityId, setPersonalityId] = useState<SobiPersonalityId>(() => loadSavedPersonality());

  // Diagnóstico calculado para o Relatório de Saúde Financeira
  const resolvedDiagnosis = useMemo(() => {
    if (diagnosis) return diagnosis;
    return sobraAiEngine.generateFullDiagnosis(
      finance.accounts,
      finance.categories,
      finance.transactions,
      finance.budgets,
      finance.goals,
      finance.subscriptions,
      new Date()
    );
  }, [diagnosis, finance.accounts, finance.categories, finance.transactions, finance.budgets, finance.goals, finance.subscriptions]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza personalidade caso seja alterada nas configurações
  useEffect(() => {
    const handlePersonalityChange = (e: any) => {
      if (e.detail?.personalityId) {
        setPersonalityId(e.detail.personalityId);
      }
    };
    window.addEventListener('sobi:personality_changed', handlePersonalityChange);
    return () => window.removeEventListener('sobi:personality_changed', handlePersonalityChange);
  }, []);

  // Muda para a aba de conversa e envia prompt (chamado a partir do relatório)
  const handleSwitchToChatWithPrompt = (promptText: string) => {
    setActiveTab('chat');
    if (hasConfiguredKey && !isAiTyping) {
      setTimeout(() => {
        handleSendMessage(promptText);
      }, 100);
    } else {
      setInputText(promptText);
    }
  };

  // Carrega histórico ao abrir
  useEffect(() => {
    if (isOpen) {
      // Carrega histórico do cache local
      try {
        const savedHistory = localStorage.getItem(CHAT_STORAGE_KEY);
        if (savedHistory) {
          setMessages(JSON.parse(savedHistory));
        } else {
          // Mensagem inicial de boas-vindas de acordo com a personalidade do Sobi
          const persona = getSobiPersonality(loadSavedPersonality());
          const initialGreeting: ChatMessage = {
            id: 'init-1',
            sender: 'ai',
            text: persona.welcomeGreeting,
            timestamp: new Date().toISOString(),
          };
          setMessages([initialGreeting]);
        }
      } catch {
        // Fallback
      }
    }
  }, [isOpen]);

  // Se tiver um prompt inicial recebido por prop (ex: vindo de um insight)
  useEffect(() => {
    if (isOpen && initialPrompt && hasConfiguredKey && !isAiTyping) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, hasConfiguredKey]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Salva histórico no localStorage
  const persistMessages = (newMsgs: ChatMessage[]) => {
    setMessages(newMsgs);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newMsgs));
    } catch {
      // Ignora erro de quota
    }
  };

  const handleClearHistory = () => {
    if (confirm('Limpar todo o histórico de mensagens deste chat?')) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      const persona = getSobiPersonality(personalityId);
      const greeting: ChatMessage = {
        id: 'init-reset',
        sender: 'ai',
        text: persona.welcomeGreeting,
        timestamp: new Date().toISOString(),
      };
      setMessages([greeting]);
    }
  };

  // Envio de Mensagem
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    persistMessages(updatedMessages);
    setInputText('');
    setIsAiTyping(true);

    const resolutionCtx: ActionResolutionContext = {
      accounts: finance.accounts,
      categories: finance.categories,
      transactions: finance.transactions,
      budgets: finance.budgets,
      subscriptions: finance.subscriptions,
    };

    const systemPrompt = buildFinancialSystemPrompt(
      finance.accounts,
      finance.categories,
      finance.transactions,
      finance.budgets,
      finance.subscriptions,
      diagnosis,
      personalityId
    );

    try {
      const response = await GeminiClient.sendMessage(updatedMessages, systemPrompt, resolutionCtx);

      const aiMsg: ChatMessage = {
        id: 'msg-ai-' + Date.now(),
        sender: 'ai',
        text: response.text,
        timestamp: new Date().toISOString(),
        proposedAction: response.proposedAction,
      };

      persistMessages([...updatedMessages, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        sender: 'ai',
        text: `⚠️ **Aviso do Sobra AI:** ${err.message || 'Houve uma falha ao conectar com o Gemini.'}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      persistMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Execução de Ação Aprovada pelo Usuário (Human-in-the-loop)
  const handleConfirmAction = async (msgId: string, action: ProposedAiAction) => {
    setExecutingActionId(action.id);

    const resolutionCtx: ActionResolutionContext = {
      accounts: finance.accounts,
      categories: finance.categories,
      transactions: finance.transactions,
      budgets: finance.budgets,
      subscriptions: finance.subscriptions,
    };

    const result = await AiActionExecutor.executeAction(action, resolutionCtx, {
      saveTransaction: finance.saveTransaction,
      deleteTransaction: finance.deleteTransaction,
      saveSubscription: finance.saveSubscription,
      saveBudget: finance.saveBudget,
      recordCategoryLearning: finance.recordCategoryLearning,
      saveDescriptionRule: finance.saveDescriptionRule,
      refreshData: finance.refreshData,
    });

    setExecutingActionId(null);

    // Atualiza status da ação na mensagem
    const updated = messages.map(m => {
      if (m.id === msgId && m.proposedAction) {
        return {
          ...m,
          proposedAction: {
            ...m.proposedAction,
            status: (result.success ? 'executed' : 'cancelled') as any,
            errorMessage: result.success ? undefined : result.message,
          },
        };
      }
      return m;
    });

    // Adiciona feedback do sistema no chat
    const followUpMsg: ChatMessage = {
      id: 'msg-sys-' + Date.now(),
      sender: 'ai',
      text: result.success 
        ? `✅ **Feito!** ${result.message}` 
        : `❌ **Falha:** ${result.message}`,
      timestamp: new Date().toISOString(),
    };

    persistMessages([...updated, followUpMsg]);
  };

  const handleCancelAction = (msgId: string) => {
    const updated = messages.map(m => {
      if (m.id === msgId && m.proposedAction) {
        return {
          ...m,
          proposedAction: {
            ...m.proposedAction,
            status: 'cancelled' as any,
          },
        };
      }
      return m;
    });
    persistMessages(updated);
  };

  // Chips Rápidos de Sugestões
  const quickChips = [
    { label: '💡 Onde cortar R$ 200?', prompt: 'Analise meus gastos e sugira onde posso cortar R$ 200,00 este mês com menor impacto.' },
    { label: '✏️ Padronizar nomes (iFood, etc)', prompt: 'Veja todas as compras com nomes confusos ou de iFood no meu extrato/fatura e padronize os nomes como "iFood" para deixar organizado, aplicando também para os próximos.' },
    { label: '💳 Mover gasto de cartão', prompt: 'Gostaria de mover uma compra de um cartão para outro.' },
    { label: '🏷️ Recategorizar delivery', prompt: 'Mude todas as compras que tiverem "ifood" ou "entrega" para a categoria Alimentação.' },
    { label: '🔁 Marcar assinaturas', prompt: 'Quais dos meus gastos recentes deveriam ser marcados como assinaturas fixas?' },
    { label: '🎯 Como atingir minha meta?', prompt: 'Como posso organizar minhas sobras para acelerar a conclusão das minhas metas financeiras?' },
  ];

  // Determina a expressão e subtítulo do Sobi com base na conversa
  const deriveSobiMoodAndSubtitle = (): { mood: SobiExpression; subtitle: string } => {
    if (isAiTyping) {
      return {
        mood: 'pensativo',
        subtitle: 'Analisando seus dados financeiros...',
      };
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return {
        mood: 'normal',
        subtitle: 'Organiza • Orienta • Motiva',
      };
    }

    if (lastMessage.isError) {
      return {
        mood: 'surpreso',
        subtitle: 'Atenção a este detalhe das suas contas',
      };
    }

    if (lastMessage.proposedAction) {
      if (lastMessage.proposedAction.status === 'executed') {
        return {
          mood: 'animado',
          subtitle: 'Pronto! Juntos sobra mais pra você 🎉',
        };
      }
      if (lastMessage.proposedAction.status === 'pending') {
        return {
          mood: 'confiante',
          subtitle: 'Preparei uma recomendação para você',
        };
      }
      if (lastMessage.proposedAction.status === 'cancelled') {
        return {
          mood: 'normal',
          subtitle: 'Sem problemas, mantive como estava!',
        };
      }
    }

    if (lastMessage.sender === 'ai') {
      return {
        mood: 'feliz',
        subtitle: 'Organiza • Orienta • Motiva',
      };
    }

    return {
      mood: 'normal',
      subtitle: 'Organiza • Orienta • Motiva',
    };
  };

  const { mood: sobiMood, subtitle: sobiSubtitle } = deriveSobiMoodAndSubtitle();

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div className="sobra-ai-modal-overlay" onClick={onClose}>
      <div
        className="sobra-ai-modal-box animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Topo / Header do Sobi */}
        <header
          style={{
            padding: 'calc(var(--safe-area-top, 0px) + 14px) 20px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#121814',
          }}
        >
          {/* Lado Esquerdo: Avatar Sobi + Título e Subtítulo limpos sem quebra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <SobiAvatar expression={sobiMood} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.02em',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  Sobi
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: getSobiPersonality(personalityId).accentColor,
                    backgroundColor: `${getSobiPersonality(personalityId).accentColor}18`,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: `1px solid ${getSobiPersonality(personalityId).accentColor}35`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Personalidade ativa: ${getSobiPersonality(personalityId).title} (configurável na aba Mais)`}
                >
                  <span>{getSobiPersonality(personalityId).emoji}</span>
                  <span>{getSobiPersonality(personalityId).shortName}</span>
                </span>
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.76rem',
                  color: '#94A3B8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sobiSubtitle}
              </p>
            </div>
          </div>

          {/* Lado Direito: Limpar Histórico e Fechar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {hasConfiguredKey && (
              <button
                type="button"
                onClick={handleClearHistory}
                title="Limpar conversa"
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '7px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FB7185')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '7px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Switcher de Visão Superior: Conversa vs Saúde Financeira */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            backgroundColor: '#101512',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              border: activeTab === 'chat' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
              backgroundColor: activeTab === 'chat' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'chat' ? '#4ADE80' : '#94A3B8',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare size={16} />
            <span>Conversa com Sobi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              border: activeTab === 'report' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
              backgroundColor: activeTab === 'report' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'report' ? '#4ADE80' : '#94A3B8',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Activity size={16} />
            <span>Saúde Financeira</span>
            {resolvedDiagnosis?.score && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  backgroundColor: activeTab === 'report' ? '#4ADE80' : 'rgba(255, 255, 255, 0.08)',
                  color: activeTab === 'report' ? '#08090A' : '#E2E8F0',
                  fontWeight: 800,
                }}
              >
                {resolvedDiagnosis.score.overallScore}
              </span>
            )}
          </button>
        </div>

        {/* CORPO: RELATÓRIO DE SAÚDE FINANCEIRA OU CHAT ATIVO */}
        {activeTab === 'report' ? (
          <SobraAiReportView
            diagnosis={resolvedDiagnosis}
            onExecuteAction={(action) => {
              if (onExecuteAction) onExecuteAction(action);
              onClose();
            }}
            onOpenChatWithPrompt={handleSwitchToChatWithPrompt}
          />
        ) : (
          /* MODO CHAT ATIVO */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Histórico de Mensagens */}
            <div
              style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  {msg.sender === 'ai' && (
                    <SobiAvatar
                      expression={
                        msg.isError
                          ? 'surpreso'
                          : msg.proposedAction?.status === 'executed'
                          ? 'animado'
                          : msg.proposedAction?.status === 'pending'
                          ? 'confiante'
                          : 'feliz'
                      }
                      size={40}
                      style={{ marginTop: '2px' }}
                    />
                  )}

                  <div
                    style={{
                      flex: msg.sender === 'ai' ? 1 : undefined,
                      maxWidth: msg.sender === 'user' ? '82%' : '100%',
                      minWidth: 0,
                      padding: '14px 16px',
                      borderRadius: '18px',
                      backgroundColor: msg.sender === 'user'
                        ? '#18241D'
                        : msg.isError
                        ? 'rgba(239, 68, 68, 0.12)'
                        : '#131915',
                      color: msg.sender === 'user' ? '#FFFFFF' : '#E2E8F0',
                      border: msg.sender === 'user'
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : msg.isError
                        ? '1px solid rgba(239, 68, 68, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.sender === 'user' ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    ) : (
                      <MarkdownView content={msg.text} />
                    )}

                    {/* CARD INTERATIVO DE AÇÃO DA IA (HUMAN-IN-THE-LOOP) */}
                    {msg.proposedAction && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '16px',
                          borderRadius: '16px',
                          backgroundColor: '#151C17',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                        }}
                      >
                        <h4
                          style={{
                            margin: '0 0 6px',
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            lineHeight: 1.4,
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                            hyphens: 'none',
                          }}
                        >
                          {msg.proposedAction.title}
                        </h4>

                        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                          {msg.proposedAction.description}
                        </p>

                        {/* Detalhes chave/valor organizados em campos estruturados com espaço total */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '14px',
                          }}
                        >
                          {msg.proposedAction.details.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                backgroundColor: '#101612',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {item.label}
                              </span>
                              <span style={{ color: '#F1F5F9', fontWeight: 500, fontSize: '0.86rem', overflowWrap: 'break-word', wordBreak: 'normal', lineHeight: 1.45 }}>
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Botões de Decisão */}
                        {msg.proposedAction.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleConfirmAction(msg.id, msg.proposedAction!)}
                              disabled={executingActionId === msg.proposedAction.id}
                              style={{
                                flex: 1,
                                padding: '9px 14px',
                                borderRadius: '10px',
                                backgroundColor: '#22C55E',
                                color: '#0A0E0C',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                transition: 'transform 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                              {executingActionId === msg.proposedAction.id ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  <span>Aplicando...</span>
                                </>
                              ) : (
                                <>
                                  <Check size={14} strokeWidth={2.8} />
                                  <span>Confirmar e Aplicar</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCancelAction(msg.id)}
                              disabled={executingActionId === msg.proposedAction.id}
                              style={{
                                padding: '9px 14px',
                                borderRadius: '10px',
                                backgroundColor: 'transparent',
                                color: '#94A3B8',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                              }}
                            >
                              Descartar
                            </button>
                          </div>
                        ) : msg.proposedAction.status === 'executed' ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#E2E8F0',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(34, 197, 94, 0.08)',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid rgba(34, 197, 94, 0.2)',
                            }}
                          >
                            <CheckCircle2 size={16} color="#22C55E" style={{ flexShrink: 0 }} />
                            <span style={{ lineHeight: 1.4 }}>Alteração aplicada com sucesso no aplicativo!</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '0.78rem' }}>
                            <XCircle size={15} />
                            <span>Ação descartada pelo usuário.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '11px',
                        backgroundColor: '#1C241E',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <User size={18} color="#94A3B8" />
                    </div>
                  )}
                </div>
              ))}

              {isAiTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SobiAvatar expression="pensativo" size={34} />
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: '16px',
                      backgroundColor: '#131915',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#94A3B8',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Sobi está analisando suas contas...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Sugestões Rápidas (Chips de Pergunta) */}
            <div
              className="hide-scrollbar"
              style={{
                padding: '10px 16px',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor: '#101712',
              }}
            >
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip.prompt)}
                  disabled={isAiTyping}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: '#172019',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#CBD5E1',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: isAiTyping ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#1E2B21';
                    e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.35)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '#172019';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#CBD5E1';
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: '12px 16px calc(12px + var(--safe-area-bottom, 0px))',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#121814',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Converse com o Sobi ou peça: 'mova a compra do posto para o Nubank'..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isAiTyping}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: '#161F18',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isAiTyping}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: !inputText.trim() || isAiTyping ? 'rgba(255, 255, 255, 0.08)' : '#22C55E',
                  color: !inputText.trim() || isAiTyping ? '#64748B' : '#0A0E0C',
                  border: 'none',
                  cursor: !inputText.trim() || isAiTyping ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: !inputText.trim() || isAiTyping ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.35)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title="Enviar mensagem"
              >
                <Send size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};
