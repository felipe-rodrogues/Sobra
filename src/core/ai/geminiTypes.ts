/**
 * Sobra AI - Tipos e Esquemas para Chat e Function Calling com Google Gemini
 */

export type ChatSender = 'user' | 'ai' | 'system';

export type AiActionType = 
  | 'create_transaction'
  | 'move_transaction_account'
  | 'recategorize_transactions'
  | 'rename_transactions'
  | 'set_as_subscription'
  | 'adjust_budget';

export interface ProposedAiAction {
  id: string;
  type: AiActionType;
  title: string;
  description: string;
  status: 'pending' | 'executed' | 'cancelled';
  details: { label: string; value: string }[];
  payload: Record<string, any>;
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  timestamp: string;
  proposedAction?: ProposedAiAction;
  isError?: boolean;
}

// Esquemas de Parâmetros para Chamada de Ferramentas (Function Declarations)
export const GEMINI_TOOLS_DECLARATIONS = [
  {
    name: 'create_transaction',
    description: 'Cadastra uma nova transação financeira de receita ou despesa no Sobra',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING', description: 'Descrição da transação (ex: "Almoço Restaurante", "Salário Extra")' },
        amount: { type: 'NUMBER', description: 'Valor em reais (positivo, ex: 45.50)' },
        type: { type: 'STRING', enum: ['expense', 'income'], description: 'Se é despesa ou receita' },
        categoryName: { type: 'STRING', description: 'Nome da categoria correspondente (ex: "Alimentação", "Transporte")' },
        accountName: { type: 'STRING', description: 'Nome da conta ou cartão onde ocorreu o gasto (ex: "Nubank", "Inter", "Conta Corrente")' },
        date: { type: 'STRING', description: 'Data no formato YYYY-MM-DD. Se for hoje, use a data de hoje' },
        isSubscription: { type: 'BOOLEAN', description: 'Verdadeiro se for uma assinatura recorrente' }
      },
      required: ['description', 'amount', 'type']
    }
  },
  {
    name: 'move_transaction_account',
    description: 'Move uma ou mais cobranças de um cartão/conta para outro cartão/conta diferente',
    parameters: {
      type: 'OBJECT',
      properties: {
        searchDescription: { type: 'STRING', description: 'Termo de busca para encontrar a transação (ex: "posto shell", "mercado", "farmacia")' },
        targetAccountName: { type: 'STRING', description: 'Nome do cartão ou conta de destino (ex: "Inter", "Nubank", "Conta Corrente")' }
      },
      required: ['searchDescription', 'targetAccountName']
    }
  },
  {
    name: 'recategorize_transactions',
    description: 'Altera a categoria de despesas ou receitas existentes que combinem com o termo',
    parameters: {
      type: 'OBJECT',
      properties: {
        searchDescription: { type: 'STRING', description: 'Termo de busca das transações (ex: "ifood", "uber", "padaria")' },
        targetCategoryName: { type: 'STRING', description: 'Nome da nova categoria (ex: "Alimentação", "Transporte")' }
      },
      required: ['searchDescription', 'targetCategoryName']
    }
  },
  {
    name: 'rename_transactions',
    description: 'Renomeia ou padroniza a descrição (nome) de transações existentes na fatura ou extrato, e opcionalmente ativa regra contínua para padronizar lançamentos futuros',
    parameters: {
      type: 'OBJECT',
      properties: {
        searchDescription: { type: 'STRING', description: 'Termo de busca para encontrar as transações existentes (ex: "ifood", "uber", "posto shell")' },
        newDescription: { type: 'STRING', description: 'Nova descrição padronizada e limpa (ex: "iFood", "Uber", "Posto Shell")' },
        accountName: { type: 'STRING', description: 'Nome opcional do cartão ou conta para filtrar (ex: "Nubank", "Inter"). Se omitido, busca em todas as contas' },
        applyToFuture: { type: 'BOOLEAN', description: 'Se verdadeiro, ativa uma regra contínua para padronizar futuros lançamentos automaticamente (padrão true)' }
      },
      required: ['searchDescription', 'newDescription']
    }
  },
  {
    name: 'set_as_subscription',
    description: 'Define um serviço ou transação frequente como assinatura fixa mensal ou anual no painel de assinaturas',
    parameters: {
      type: 'OBJECT',
      properties: {
        serviceName: { type: 'STRING', description: 'Nome do serviço ou estabelecimento (ex: "Netflix", "Spotify", "Academia")' },
        amount: { type: 'NUMBER', description: 'Valor da mensalidade (opcional, busca do histórico se não fornecido)' },
        cadence: { type: 'STRING', enum: ['monthly', 'yearly'], description: 'Periodicidade da cobrança (padrão monthly)' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'adjust_budget',
    description: 'Altera ou define o limite mensal de gastos para uma categoria de despesa',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoryName: { type: 'STRING', description: 'Nome da categoria (ex: "Alimentação", "Lazer", "Transporte")' },
        monthlyLimit: { type: 'NUMBER', description: 'Novo limite mensal em reais' }
      },
      required: ['categoryName', 'monthlyLimit']
    }
  }
];
