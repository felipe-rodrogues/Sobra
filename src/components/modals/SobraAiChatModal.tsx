import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
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
import { FluidAuraWave } from '../common/FluidAuraWave';
import { SobraAiReportView } from './SobraAiReportView';
import { 
  ArrowUp,
  Mic, 
  X, 
  Trash2, 
  Check,
  RefreshCw,
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Activity,
  Sparkles,
  Wallet,
  PiggyBank,
  HelpCircle,
  History,
  Clock,
  Plus,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const CHAT_STORAGE_KEY = 'sobra_ai_chat_history_v1';
const CHAT_SESSIONS_STORAGE_KEY = 'sobra_ai_chat_sessions_v1';

function formatSessionDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recente';

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Hoje às ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Ontem às ${timeStr}`;
    }

    const day = d.getDate().toString().padStart(2, '0');
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const month = monthNames[d.getMonth()];
    return `${day} de ${month}, ${timeStr}`;
  } catch {
    return 'Recente';
  }
}

/**
 * Deduplica sessões evitando que múltiplos registros sejam criados para a mesma conversa.
 * Se duas sessões tiverem a mesma primeira mensagem ou mesmo ID, mescla mantendo a mais completa.
 */
export function deduplicateSessions(sessions: ChatSession[]): ChatSession[] {
  const result: ChatSession[] = [];

  for (const session of sessions) {
    if (!session.messages || session.messages.length === 0) continue;

    const firstUserMsg = session.messages.find(m => m.sender === 'user');
    const existingIndex = result.findIndex(r => {
      if (r.id === session.id) return true;

      const rFirstUser = r.messages.find(m => m.sender === 'user');
      if (firstUserMsg && rFirstUser) {
        // 1. Mesmo ID da primeira mensagem
        if (firstUserMsg.id && rFirstUser.id && firstUserMsg.id === rFirstUser.id) {
          return true;
        }
        // 2. Mesmo timestamp da primeira mensagem
        if (firstUserMsg.timestamp && rFirstUser.timestamp && firstUserMsg.timestamp === rFirstUser.timestamp) {
          return true;
        }
        // 3. Mesmo texto da primeira mensagem criado com diferença inferior a 30 minutos
        if (firstUserMsg.text.trim() === rFirstUser.text.trim()) {
          const t1 = new Date(firstUserMsg.timestamp).getTime();
          const t2 = new Date(rFirstUser.timestamp).getTime();
          if (Math.abs(t1 - t2) < 30 * 60 * 1000) {
            return true;
          }
        }
      }
      return false;
    });

    if (existingIndex >= 0) {
      // Se a sessão atual tiver mais mensagens ou for mais recente, substitui a mais antiga
      if (session.messages.length >= result[existingIndex].messages.length) {
        result[existingIndex] = session;
      }
    } else {
      result.push(session);
    }
  }

  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

interface SobraAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosis?: SobraFullDiagnosis | null;
  initialPrompt?: string;
  initialTab?: 'chat' | 'report';
  initialShowHistory?: boolean;
  onExecuteAction?: (action: SobraAction) => void;
}

export const SobraAiChatModal: React.FC<SobraAiChatModalProps> = ({
  isOpen,
  onClose,
  diagnosis,
  initialPrompt,
  initialTab = 'chat',
  initialShowHistory = false,
  onExecuteAction,
}) => {
  const finance = useFinance();
  const { user } = useAuth();

  // Extrai o primeiro nome real do usuário configurado no app (ex: "Felipe Rodrigues" -> "Felipe")
  const userFirstName = useMemo(() => {
    if (!user?.displayName) return 'você';
    const clean = user.displayName.trim();
    if (!clean) return 'você';
    const first = clean.split(' ')[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user?.displayName]);

  // Visão Ativa: Conversa com Sobi vs Relatório de Saúde Financeira
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'chat');
    }
  }, [isOpen, initialTab]);

  const hasConfiguredKey = true;

  // Estado da Conversa & Histórico de Sessões
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [personalityId, setPersonalityId] = useState<SobiPersonalityId>(() => loadSavedPersonality());
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Histórico de Conversas
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(() => !!initialShowHistory);

  // Mantém o ID da sessão sincronizado no ref e no state
  const setSessionId = (id: string | null) => {
    currentSessionIdRef.current = id;
    setActiveSessionId(id);
  };

  // Carrega sessões salvas do localStorage
  const loadSessionsFromStorage = (): ChatSession[] => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return deduplicateSessions(parsed);
      }
      // Migração de histórico legado caso exista
      const legacyRaw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (Array.isArray(legacy) && legacy.some((m: ChatMessage) => m.sender === 'user')) {
          const firstUser = legacy.find((m: ChatMessage) => m.sender === 'user');
          const legacySession: ChatSession = {
            id: 'session-legacy',
            title: firstUser ? (firstUser.text.length > 55 ? firstUser.text.substring(0, 52) + '...' : firstUser.text) : 'Conversa anterior',
            createdAt: legacy[0]?.timestamp || new Date().toISOString(),
            updatedAt: legacy[legacy.length - 1]?.timestamp || new Date().toISOString(),
            messages: legacy,
          };
          const migrated = [legacySession];
          localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch {
      // Ignora erro
    }
    return [];
  };

  const saveSessionsToStorage = (updatedSessions: ChatSession[]) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const deduped = deduplicateSessions(updatedSessions);
      localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(deduped));
    } catch {
      // Ignora erro
    }
  };

  // Arquiva a conversa atual no histórico de sessões
  const archiveCurrentSession = (msgsToArchive = messages, currentId = currentSessionIdRef.current): string | null => {
    if (!msgsToArchive || msgsToArchive.length === 0) return null;
    const hasUserMsg = msgsToArchive.some(m => m.sender === 'user');
    if (!hasUserMsg) return null;

    const firstUserMsg = msgsToArchive.find(m => m.sender === 'user');
    const title = firstUserMsg 
      ? (firstUserMsg.text.length > 55 ? firstUserMsg.text.substring(0, 52) + '...' : firstUserMsg.text) 
      : 'Conversa com Sobi';
    const nowIso = new Date().toISOString();

    const existingSessions = loadSessionsFromStorage();
    const sessionId = currentId || currentSessionIdRef.current || ('session-' + Date.now());

    if (!currentSessionIdRef.current) {
      setSessionId(sessionId);
    }

    const sessionObj: ChatSession = {
      id: sessionId,
      title,
      createdAt: msgsToArchive[0]?.timestamp || nowIso,
      updatedAt: msgsToArchive[msgsToArchive.length - 1]?.timestamp || nowIso,
      messages: msgsToArchive,
    };

    const sessionIndex = existingSessions.findIndex(s => s.id === sessionId);
    let updatedSessions: ChatSession[];
    if (sessionIndex >= 0) {
      updatedSessions = [...existingSessions];
      updatedSessions[sessionIndex] = sessionObj;
    } else {
      updatedSessions = [sessionObj, ...existingSessions];
    }

    const deduped = deduplicateSessions(updatedSessions);
    saveSessionsToStorage(deduped);
    setSessions(deduped);
    return sessionId;
  };

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

  // Determina se já existem mensagens reais do usuário no chat
  const hasUserMessages = useMemo(() => {
    return messages.some(m => m.sender === 'user');
  }, [messages]);

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

  // Carrega histórico ao abrir o modal. Cada abertura inicia um novo chat fresco.
  useEffect(() => {
    if (isOpen) {
      setPersonalityId(loadSavedPersonality());
      const loadedSessions = loadSessionsFromStorage();
      setSessions(loadedSessions);
      setShowHistory(!!initialShowHistory);

      // Toda vez que abre, inicia um chat novo
      setMessages([]);
      setSessionId(null);
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
    if (hasUserMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiTyping, hasUserMessages]);

  // Salva histórico no localStorage e atualiza a sessão ativa no histórico
  const persistMessages = (newMsgs: ChatMessage[], explicitSessionId?: string) => {
    setMessages(newMsgs);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newMsgs));
    } catch {
      // Ignora erro de quota
    }

    if (newMsgs.some(m => m.sender === 'user')) {
      const sid = explicitSessionId || currentSessionIdRef.current || ('session-' + Date.now());
      if (!currentSessionIdRef.current) {
        setSessionId(sid);
      }
      archiveCurrentSession(newMsgs, sid);
    }
  };

  const handleStartNewChat = () => {
    archiveCurrentSession();
    setMessages([]);
    setSessionId(null);
    setShowHistory(false);
    setActiveTab('chat');
  };

  const handleResumeSession = (session: ChatSession) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
    setActiveTab('chat');
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage(updated);
    setSessions(updated);
    if (currentSessionIdRef.current === sessionId) {
      setMessages([]);
      setSessionId(null);
    }
  };

  const handleClearAllSessions = () => {
    if (confirm('Deseja apagar todo o histórico de conversas anteriores do Sobi?')) {
      saveSessionsToStorage([]);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_SESSIONS_STORAGE_KEY);
      setSessions([]);
      setMessages([]);
      setSessionId(null);
    }
  };

  const handleCloseModal = () => {
    archiveCurrentSession();
    setMessages([]);
    setSessionId(null);
    setShowHistory(false);
    onClose();
  };

  const handleBackOrClose = () => {
    if (showHistory) {
      setShowHistory(false);
    } else {
      handleCloseModal();
    }
  };

  // Reconhecimento de Voz via Web Speech API
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz direto. Digite sua mensagem no campo.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        if (transcript) {
          setInputText(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Envio de Mensagem
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isAiTyping) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    let sid = currentSessionIdRef.current;
    if (!sid) {
      sid = 'session-' + Date.now();
      setSessionId(sid);
    }

    const updatedMessages = [...messages, userMsg];
    persistMessages(updatedMessages, sid);
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

      persistMessages([...updatedMessages, aiMsg], sid);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        sender: 'ai',
        text: `⚠️ **Aviso do Sobra AI:** ${err.message || 'Houve uma falha ao conectar com o Gemini.'}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      persistMessages([...updatedMessages, errorMsg], sid);
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

    persistMessages([...updated, followUpMsg], currentSessionIdRef.current || undefined);
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
    persistMessages(updated, currentSessionIdRef.current || undefined);
  };

  // Sugestões Principais no Estilo PicPay AI (Empilhadas na vertical)
  const primarySuggestions = [
    {
      label: 'Analisar meus gastos',
      prompt: 'Analise meus gastos deste mês e me dê um resumo de onde estou gastando mais e oportunidades de economia.',
      icon: Sparkles,
    },
    {
      label: 'Qual é a minha sobra atual?',
      prompt: 'Qual é a minha sobra estimada para este mês e qual é o meu ritmo de gastos diário?',
      icon: Wallet,
    },
    {
      label: 'Dicas para economizar este mês',
      prompt: 'Onde posso economizar ou cortar gastos este mês com menor impacto no meu estilo de vida?',
      icon: PiggyBank,
    },
    {
      label: 'Ver como você pode me ajudar',
      prompt: 'O que você pode fazer por mim como Sobi no aplicativo? Me mostre seus recursos e como posso te usar.',
      icon: HelpCircle,
    },
  ];

  // Chips Rápidos de Continuidade de Conversa
  const quickChips = [
    { label: 'Onde cortar R$ 200?', prompt: 'Analise meus gastos e sugira onde posso cortar R$ 200,00 este mês com menor impacto.' },
    { label: 'Padronizar nomes', prompt: 'Veja todas as compras com nomes confusos ou de iFood no meu extrato/fatura e padronize os nomes como "iFood" para deixar organizado.' },
    { label: 'Mover gasto de cartão', prompt: 'Gostaria de mover uma compra de um cartão para outro.' },
    { label: 'Recategorizar delivery', prompt: 'Mude todas as compras que tiverem "ifood" ou "entrega" para a categoria Alimentação.' },
    { label: 'Assinaturas ativas', prompt: 'Quais dos meus gastos recentes deveriam ser marcados como assinaturas fixas?' },
    { label: 'Como atingir minha meta?', prompt: 'Como posso organizar minhas sobras para acelerar a conclusão das minhas metas financeiras?' },
  ];

  // Determina a expressão do Sobi com base na conversa
  const deriveSobiMood = (): SobiExpression => {
    if (isAiTyping) return 'pensativo';

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'normal';
    if (lastMessage.isError) return 'surpreso';

    if (lastMessage.proposedAction) {
      if (lastMessage.proposedAction.status === 'executed') return 'animado';
      if (lastMessage.proposedAction.status === 'pending') return 'confiante';
      if (lastMessage.proposedAction.status === 'cancelled') return 'normal';
    }

    if (lastMessage.sender === 'ai') return 'feliz';
    return 'normal';
  };

  const sobiMood = deriveSobiMood();
  const swipeState = useSwipeBack({ onBack: handleBackOrClose, enabled: isOpen });

  if (!isOpen) return null;

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div className="sobra-ai-modal-overlay" onClick={handleCloseModal}>
        <div
          className="sobra-ai-modal-box animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Topo / Header Minimalista Fiel ao PicPay AI */}
          <header
            style={{
              padding: 'calc(var(--safe-area-top, 0px) + 12px) 16px 12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0A0F0D',
              position: 'relative',
              zIndex: 20,
              flexShrink: 0,
            }}
          >
            {/* Lado Esquerdo: Botão Voltar */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: '40px' }}>
              <button
                type="button"
                onClick={handleBackOrClose}
                title={showHistory ? 'Voltar para a conversa' : 'Voltar'}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                }}
              >
                <ArrowLeft size={18} strokeWidth={2.2} />
              </button>
            </div>

            {/* Centro: Título Centrado "Sobi AI" ou "Histórico" */}
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                textAlign: 'center',
              }}
            >
              {showHistory ? 'Histórico de Conversas' : 'Sobi AI'}
            </h3>

            {/* Lado Direito: Histórico no lugar do "X" (no chat principal) ou botão (+) (no histórico) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', minWidth: '40px' }}>
              {showHistory ? (
                /* Na tela de Histórico: apenas o botão circular (+) no mesmo padrão das outras telas */
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  title="Iniciar nova conversa"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Plus size={20} strokeWidth={2.6} />
                </button>
              ) : (
                /* Na tela principal do Chat: Botão circular (+) se houver mensagens + Botão Histórico no lugar do antigo "X" */
                <>
                  {hasUserMessages && (
                    <button
                      type="button"
                      onClick={handleStartNewChat}
                      title="Iniciar nova conversa"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#4ADE80',
                        border: 'none',
                        color: '#000000',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={20} strokeWidth={2.6} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    title="Histórico de conversas"
                    style={{
                      position: 'relative',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#E2E8F0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                      e.currentTarget.style.color = '#4ADE80';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#E2E8F0';
                    }}
                  >
                    <History size={17} strokeWidth={2.2} />
                    {sessions.length > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          minWidth: '16px',
                          height: '16px',
                          padding: '0 4px',
                          borderRadius: '9999px',
                          backgroundColor: '#22C55E',
                          color: '#0A0F0D',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
                        }}
                      >
                        {sessions.length > 9 ? '9+' : sessions.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Segmented Control Minimalista para alternar entre Conversa e Diagnóstico (Oculto quando visualizando Histórico) */}
          {!showHistory && (
            <div
              style={{
                padding: '6px 16px 8px',
                backgroundColor: '#0A0F0D',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '9999px',
                  padding: '3px',
                  gap: '4px',
                  maxWidth: '320px',
                  width: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: activeTab === 'chat' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: activeTab === 'chat' ? '#FFFFFF' : '#8E8E93',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === 'chat' ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <MessageSquare size={13} />
                  <span>Conversa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: activeTab === 'report' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: activeTab === 'report' ? '#FFFFFF' : '#8E8E93',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === 'report' ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Activity size={13} />
                  <span>Diagnóstico</span>
                  {resolvedDiagnosis?.score && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: activeTab === 'report' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        color: activeTab === 'report' ? '#4ADE80' : '#8E8E93',
                        fontWeight: 700,
                      }}
                    >
                      {resolvedDiagnosis.score.overallScore}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* CORPO: HISTÓRICO DE CONVERSAS, DIAGNÓSTICO OU MODO CHAT */}
          {showHistory ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0A0F0D',
                overflowY: 'auto',
                padding: '18px 20px 28px',
                position: 'relative',
                zIndex: 2,
              }}
            >
              {sessions.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(74, 222, 128, 0.08)',
                      border: '1px solid rgba(74, 222, 128, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <History size={26} color="#4ADE80" strokeWidth={2} />
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Nenhuma conversa anterior
                  </h4>
                  <p style={{ margin: '0 0 24px', fontSize: '0.86rem', color: '#94A3B8', maxWidth: '280px', lineHeight: 1.5 }}>
                    Quando você conversar com o Sobi e fechar o chat, suas conversas anteriores ficarão salvas aqui para você continuar depois.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartNewChat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '9999px',
                      backgroundColor: '#22C55E',
                      color: '#0A0F0D',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <Plus size={16} strokeWidth={2.6} />
                    <span>Iniciar nova conversa</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Suas Conversas Salvas
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {sessions.length} {sessions.length === 1 ? 'conversa' : 'conversas'}
                    </span>
                  </div>

                  {sessions.map(session => {
                    const isActive = activeSessionId === session.id;
                    const lastMsg = session.messages[session.messages.length - 1];
                    const previewText = lastMsg ? (lastMsg.text.replace(/[*#_`]/g, '').trim().slice(0, 95) + '...') : '';

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleResumeSession(session)}
                        style={{
                          padding: '16px',
                          borderRadius: '16px',
                          backgroundColor: isActive ? '#142018' : '#141A16',
                          border: isActive ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isActive ? '0 4px 16px rgba(34, 197, 94, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.25)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.45)';
                          e.currentTarget.style.backgroundColor = '#18241D';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = isActive ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.backgroundColor = isActive ? '#142018' : '#141A16';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <MessageSquare size={13} color="#4ADE80" />
                            </div>
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: '#FFFFFF',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {session.title}
                            </h4>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {isActive && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '2px 7px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'rgba(74, 222, 128, 0.18)',
                                  color: '#4ADE80',
                                  fontWeight: 700,
                                }}
                              >
                                Atual
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={e => handleDeleteSession(session.id, e)}
                              title="Excluir esta conversa"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#64748B',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = '#EF4444';
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = '#64748B';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {previewText && (
                          <p
                            style={{
                              margin: '2px 0 4px',
                              fontSize: '0.82rem',
                              color: '#94A3B8',
                              lineHeight: 1.45,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {previewText}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            {formatSessionDate(session.updatedAt)}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              style={{
                                fontSize: '0.70rem',
                                padding: '1px 7px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                color: '#94A3B8',
                                fontWeight: 600,
                              }}
                            >
                              {session.messages.length} {session.messages.length === 1 ? 'msg' : 'msgs'}
                            </span>
                            <ChevronRight size={14} color="#64748B" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleClearAllSessions}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      margin: '16px auto 8px',
                      borderRadius: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                  >
                    <Trash2 size={13} />
                    <span>Limpar todo o histórico de conversas</span>
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'report' ? (
            <SobraAiReportView
              diagnosis={resolvedDiagnosis}
              onExecuteAction={(action) => {
                if (onExecuteAction) onExecuteAction(action);
                onClose();
              }}
              onOpenChatWithPrompt={handleSwitchToChatWithPrompt}
            />
          ) : (
            /* MODO CHAT PICPAY AI */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#0A0F0D',
              }}
            >
              {/* Se o usuário ainda não enviou mensagens: Tela de Boas-Vindas idêntica ao PicPay AI */}
              {!hasUserMessages ? (
                <div
                  style={{
                    flex: 1,
                    padding: '36px 24px 20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    zIndex: 2,
                  }}
                >
                  {/* Ícone de Estrela/IA de 4 pontas idêntico ao do PicPay */}
                  <div style={{ marginBottom: '22px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
                        fill="#FFFFFF"
                      />
                    </svg>
                  </div>

                  {/* Saudação com o nome real do usuário */}
                  <p
                    style={{
                      margin: '0 0 6px',
                      fontSize: '0.98rem',
                      fontWeight: 500,
                      color: '#CBD5E1',
                      letterSpacing: '-0.01em',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                  >
                    {`Olá, ${userFirstName}`}
                  </p>

                  {/* Título de chamada destacado */}
                  <h2
                    style={{
                      margin: '0 0 32px',
                      fontSize: '1.82rem',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      lineHeight: 1.25,
                      letterSpacing: '-0.025em',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      maxWidth: '320px',
                    }}
                  >
                    Me conta como posso te ajudar
                  </h2>

                  {/* Pílulas de Ações Rápidas (Empilhadas na vertical alinhadas à esquerda como no PicPay) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                    {primarySuggestions.map((item, idx) => {
                      const IconComponent = item.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(item.prompt)}
                          disabled={isAiTyping}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 18px 10px 12px',
                            borderRadius: '9999px',
                            backgroundColor: '#141A16',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#FFFFFF',
                            fontSize: '0.92rem',
                            fontWeight: 500,
                            cursor: isAiTyping ? 'not-allowed' : 'pointer',
                            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#1D2720';
                            e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.4)';
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#141A16';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconComponent size={15} color="#FFFFFF" strokeWidth={2.2} />
                          </div>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Histórico de Mensagens Ativo */
                <div
                  style={{
                    flex: 1,
                    padding: '20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    zIndex: 2,
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
                          size={34}
                          showBorder={false}
                          style={{ marginTop: '2px', borderRadius: '50%' }}
                        />
                      )}

                      <div
                        style={{
                          flex: msg.sender === 'ai' ? 1 : undefined,
                          maxWidth: msg.sender === 'user' ? '80%' : '100%',
                          minWidth: 0,
                          padding: '13px 16px',
                          borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          backgroundColor: msg.sender === 'user'
                            ? 'rgba(34, 197, 94, 0.16)'
                            : msg.isError
                            ? 'rgba(239, 68, 68, 0.12)'
                            : '#141B16',
                          color: msg.sender === 'user' ? '#FFFFFF' : '#E2E8F0',
                          border: msg.sender === 'user'
                            ? '1px solid rgba(34, 197, 94, 0.25)'
                            : msg.isError
                            ? '1px solid rgba(239, 68, 68, 0.3)'
                            : '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.88rem',
                          lineHeight: 1.55,
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
                              }}
                            >
                              {msg.proposedAction.title}
                            </h4>

                            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                              {msg.proposedAction.description}
                            </p>

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
                                  <span style={{ color: '#F1F5F9', fontWeight: 500, fontSize: '0.86rem', lineHeight: 1.45 }}>
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>

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
                                  }}
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
                                <span>Alteração aplicada com sucesso no aplicativo!</span>
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
                    </div>
                  ))}

                  {isAiTyping && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SobiAvatar expression="pensativo" size={32} showBorder={false} style={{ borderRadius: '50%' }} />
                      <div
                        style={{
                          padding: '10px 16px',
                          borderRadius: '18px',
                          backgroundColor: '#131915',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          color: '#8E8E93',
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
              )}

              {/* Sugestões Rápidas de Continuidade de Conversa (Quando em chat ativo) */}
              {hasUserMessages && (
                <div
                  className="hide-scrollbar"
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    backgroundColor: 'rgba(10, 15, 13, 0.85)',
                    zIndex: 2,
                  }}
                >
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(chip.prompt)}
                      disabled={isAiTyping}
                      style={{
                        padding: '6px 13px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: '#94A3B8',
                        fontSize: '0.74rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        cursor: isAiTyping ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#94A3B8';
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {/* EFEITO DE FUMAÇA / ONDA VERDE FLUIDA (Inspirado no PicPay AI) */}
              <FluidAuraWave height={220} />

              {/* INPUT BAR FLUTUANTE ESTILO PICPAY AI COM MICROFONE E BOTÃO CIRCULAR */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  padding: '12px 18px calc(14px + var(--safe-area-bottom, 0px))',
                  background: 'linear-gradient(to top, rgba(10, 15, 13, 0.98) 0%, rgba(10, 15, 13, 0.75) 60%, transparent 100%)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#0F1511',
                    border: isListening
                      ? '1.5px solid #22C55E'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    padding: '6px 8px 6px 18px',
                    boxShadow: isListening
                      ? '0 0 16px rgba(34, 197, 94, 0.45)'
                      : '0 4px 20px rgba(0, 0, 0, 0.45)',
                    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={isListening ? 'Ouvindo sua voz...' : 'Escreva sua mensagem...'}
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
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '0.94rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />

                  {/* Botão de Gravação de Voz por Microfone */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    title={isListening ? 'Parar gravação' : 'Falar por voz'}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px',
                      borderRadius: '50%',
                      color: isListening ? '#22C55E' : '#94A3B8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.18s ease, transform 0.15s ease',
                      transform: isListening ? 'scale(1.15)' : 'scale(1)',
                    }}
                    onMouseEnter={e => {
                      if (!isListening) e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={e => {
                      if (!isListening) e.currentTarget.style.color = '#94A3B8';
                    }}
                  >
                    <Mic size={20} strokeWidth={isListening ? 2.5 : 2} />
                  </button>

                  {/* Botão Circular com Seta para Cima (ArrowUp) igual ao PicPay */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isAiTyping}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: !inputText.trim() || isAiTyping ? 'rgba(255, 255, 255, 0.08)' : '#22C55E',
                      color: !inputText.trim() || isAiTyping ? '#52525B' : '#0A0E0C',
                      border: 'none',
                      cursor: !inputText.trim() || isAiTyping ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: !inputText.trim() || isAiTyping ? 'none' : '0 2px 10px rgba(34, 197, 94, 0.4)',
                      transition: 'all 0.18s ease',
                      flexShrink: 0,
                    }}
                    title="Enviar mensagem"
                  >
                    <ArrowUp size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
