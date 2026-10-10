/**
 * Sobra AI - Cliente de Conexão com Google Gemini API (Free Tier)
 * Executa chamadas leves via REST, gerencia API Key e processa Function Calling.
 */

import { GEMINI_TOOLS_DECLARATIONS, ChatMessage, ProposedAiAction } from './geminiTypes';
import { AiActionExecutor, ActionResolutionContext } from './aiActionExecutor';

const API_KEY_STORAGE = 'sobra_gemini_api_key';

// Chave padrão opcional integrada (se não houver .env ou secret)
export const DEFAULT_GEMINI_API_KEY = '';

// Modelos modernos do Google Gemini ordenados por velocidade, disponibilidade e suporte a Function Calling
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash'
];

export class GeminiClient {
  /**
   * Obtém a chave de API em uso.
   * Prioridade: 1) Chave salva pelo usuário (localStorage) -> 2) Variável de ambiente (VITE_GEMINI_API_KEY) -> 3) Chave padrão do sistema
   */
  static getApiKey(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(API_KEY_STORAGE);
      if (stored && stored.trim().length > 0) return stored.trim();
    }
    // Fallback para variável de ambiente opcional
    try {
      const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
        return envKey.trim();
      }
    } catch {
      // Ignora erro de import.meta
    }
    // Chave padrão do app para funcionar direto sem exigir digitação manual
    return DEFAULT_GEMINI_API_KEY;
  }

  /**
   * Indica se o usuário configurou uma chave própria customizada
   */
  static isUsingCustomKey(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(API_KEY_STORAGE);
      return !!(stored && stored.trim().length > 0);
    }
    return false;
  }

  static setApiKey(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(API_KEY_STORAGE, key.trim());
    }
  }

  static removeApiKey(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  }

  static hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Testa a validade de uma chave de API com uma requisição mínima nos modelos suportados
   */
  static async validateApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
    if (!key || key.trim().length < 10) {
      return { valid: false, error: 'A chave fornecida é muito curta ou inválida.' };
    }

    const cleanKey = key.trim();
    let lastError = '';

    for (const model of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
          })
        });

        if (res.ok) {
          return { valid: true };
        }

        if (res.status === 429) {
          // Chave é válida, apenas bateu rate limit momentâneo
          return { valid: true };
        }

        const data = await res.json().catch(() => ({}));
        lastError = data.error?.message || `Erro ${res.status}: Chave não aceita pelo Google.`;

        // Se for 404 (modelo descontinuado/não liberado) ou 503/500 (sobrecarga temporária), tenta o próximo modelo
        if (res.status === 404 || res.status === 503 || res.status === 500) {
          continue;
        }

        // Se for 400 ou 403, a chave em si é inválida
        if (res.status === 400 || res.status === 403) {
          return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
        }
      } catch (e: any) {
        lastError = e.message || 'Erro de conexão';
      }
    }

    return { valid: false, error: lastError || 'Não foi possível validar a chave de API.' };
  }

  /**
   * Envia o histórico da conversa com contexto financeiro e recebe a resposta com possíveis chamadas de ferramentas
   */
  static async sendMessage(
    messages: ChatMessage[],
    systemInstructionText: string,
    resolutionContext: ActionResolutionContext
  ): Promise<{ text: string; proposedAction?: ProposedAiAction }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chave de API do Gemini não configurada. Por favor, conecte sua chave gratuita.');
    }

    // Formata o histórico no padrão aceito pelo Gemini
    const contents: any[] = [];
    
    for (const msg of messages) {
      if (msg.sender === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.text }]
        });
      } else if (msg.sender === 'ai' && !msg.isError) {
        contents.push({
          role: 'model',
          parts: [{ text: msg.text || 'Entendido.' }]
        });
      }
    }

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstructionText }]
      },
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Olá, Sobra AI!' }] }],
      tools: [
        {
          function_declarations: GEMINI_TOOLS_DECLARATIONS
        }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 4096,
        thinkingConfig: {
          thinkingBudget: 512
        }
      }
    };

    let res: Response | null = null;

    for (const model of CANDIDATE_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const attempt = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (attempt.ok) {
          res = attempt;
          break;
        }

        // Se for 404, 503, 500 ou 408, tenta o próximo modelo com resiliência
        if (attempt.status === 404 || attempt.status === 503 || attempt.status === 500 || attempt.status === 408) {
          continue;
        }

        // Se for outro erro (ex: 400 ou 429), salva para tratar
        res = attempt;
        break;
      } catch {
        // Tenta o próximo modelo
      }
    }

    if (!res) {
      throw new Error('Falha de conexão com os servidores do Google Gemini. Tente novamente em alguns instantes.');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 429) {
        throw new Error('Limite de 15 requisições por minuto atingido no plano gratuito. Aguarde alguns segundos e tente novamente.');
      }
      if (res.status === 400 || res.status === 403) {
        throw new Error('Chave de API inválida ou sem permissão. Verifique suas configurações.');
      }
      throw new Error(errData.error?.message || `Erro na comunicação com a IA (${res.status}).`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let textResponse = '';
    let proposedAction: ProposedAiAction | undefined;

    for (const part of parts) {
      // Ignora tokens internos de pensamento caso existam
      if (part.text && !part.thought) {
        textResponse += (textResponse ? '\n\n' : '') + part.text;
      }
      if (part.functionCall) {
        const { name, args } = part.functionCall;
        const resolved = AiActionExecutor.resolveProposedAction(name, args, resolutionContext);
        if (resolved) {
          proposedAction = resolved;
          if (!textResponse) {
            textResponse = `Preparei a seguinte alteração para organizar suas finanças:`;
          }
        }
      }
    }

    // Se por ventura atingiu o teto de tokens e a frase não encerrou com pontuação, sinaliza continuação suave
    if (candidate?.finishReason === 'MAX_TOKENS' && textResponse && !textResponse.trim().endsWith('.')) {
      textResponse += '... *(análise continuará se você pedir mais detalhes)*';
    }

    return {
      text: textResponse || (proposedAction ? 'Preparei a alteração financeira acima para sua revisão.' : 'Analisei suas finanças, mas não consegui formatar a resposta. Pode repetir ou especificar o que gostaria de saber?'),
      proposedAction
    };
  }
}
