/**
 * Sobra AI - Resolvedor e Executor de Ações de Ferramentas (Function Calling)
 * Converte chamadas de IA em ações concretas no app com validação e segurança.
 */

import { Account, Category, Transaction, Budget, Subscription } from '../types';
import { ProposedAiAction } from './geminiTypes';
import { merchantCleaner } from '../categorization/merchantCleaner';

export interface ActionResolutionContext {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  subscriptions: Subscription[];
}

export interface ActionExecutionCallbacks {
  saveTransaction: (tx: any, asSub?: any) => Promise<any>;
  deleteTransaction: (id: string) => Promise<void>;
  saveSubscription: (sub: any) => Promise<any>;
  saveBudget: (budget: any) => Promise<any>;
  recordCategoryLearning?: (merchant: string, categoryId: string) => Promise<void>;
  saveDescriptionRule?: (rule: any) => Promise<any>;
  refreshData: () => Promise<void>;
}

export class AiActionExecutor {
  /**
   * Resolve a chamada de ferramenta da IA e constrói a proposta de ação para confirmação do usuário
   */
  static resolveProposedAction(
    toolName: string,
    args: Record<string, any>,
    ctx: ActionResolutionContext
  ): ProposedAiAction | null {
    const actionId = 'act-' + Math.random().toString(36).substring(2, 9);

    switch (toolName) {
      case 'move_transaction_account': {
        const { searchDescription, targetAccountName } = args;
        const targetAcc = this.findAccountByName(targetAccountName, ctx.accounts);
        const matchingTxs = this.findTransactionsByDescription(searchDescription, ctx.transactions);

        if (!targetAcc || matchingTxs.length === 0) {
          return {
            id: actionId,
            type: 'move_transaction_account',
            title: 'Mover Cobrança',
            description: `Não foi possível localizar o cartão "${targetAccountName}" ou lançamentos correspondentes a "${searchDescription}".`,
            status: 'cancelled',
            details: [],
            payload: {},
            errorMessage: 'Dados não encontrados no sistema.'
          };
        }

        const primaryTx = matchingTxs[0];
        const sourceAcc = ctx.accounts.find(a => a.id === primaryTx.accountId);

        return {
          id: actionId,
          type: 'move_transaction_account',
          title: 'Mover Cobrança de Cartão / Conta',
          description: `Mover "${primaryTx.description}" de ${sourceAcc?.name || 'Conta atual'} para ${targetAcc.name}.`,
          status: 'pending',
          details: [
            { label: 'Transação', value: `${primaryTx.description} (R$ ${primaryTx.amount.toFixed(2)})` },
            { label: 'Origem', value: sourceAcc?.name || 'Conta Atual' },
            { label: 'Destino', value: targetAcc.name },
            { label: 'Total de Lançamentos', value: `${matchingTxs.length} lançamento(s)` }
          ],
          payload: {
            transactionIds: matchingTxs.map(t => t.id),
            targetAccountId: targetAcc.id,
            targetAccountName: targetAcc.name
          }
        };
      }

      case 'recategorize_transactions': {
        const { searchDescription, targetCategoryName } = args;
        const targetCat = this.findCategoryByName(targetCategoryName, ctx.categories);
        const matchingTxs = this.findTransactionsByDescription(searchDescription, ctx.transactions);

        if (!targetCat || matchingTxs.length === 0) {
          return {
            id: actionId,
            type: 'recategorize_transactions',
            title: 'Recategorizar Gastos',
            description: `Categoria "${targetCategoryName}" ou transações de "${searchDescription}" não localizadas.`,
            status: 'cancelled',
            details: [],
            payload: {},
            errorMessage: 'Categoria ou transações não encontradas.'
          };
        }

        return {
          id: actionId,
          type: 'recategorize_transactions',
          title: 'Recategorizar Despesas em Lote',
          description: `Atualizar ${matchingTxs.length} lançamento(s) de "${searchDescription}" para a categoria "${targetCat.name}".`,
          status: 'pending',
          details: [
            { label: 'Termo de Busca', value: searchDescription },
            { label: 'Nova Categoria', value: targetCat.name },
            { label: 'Qtd. Encontrada', value: `${matchingTxs.length} transações` }
          ],
          payload: {
            transactionIds: matchingTxs.map(t => t.id),
            targetCategoryId: targetCat.id,
            searchDescription
          }
        };
      }

      case 'rename_transactions': {
        const { searchDescription, newDescription, accountName, applyToFuture = true } = args;
        const targetAcc = accountName ? this.findAccountByName(accountName, ctx.accounts) : undefined;

        let candidates = ctx.transactions;
        if (targetAcc) {
          candidates = candidates.filter(t => t.accountId === targetAcc.id);
        }

        // Localiza transações compatíveis pelo termo de busca (com tokenização inteligente e contenção)
        const matchingTxs = candidates.filter(t => 
          merchantCleaner.matchesPattern(t.description, searchDescription) ||
          t.description.toLowerCase().includes(searchDescription.toLowerCase().trim())
        );

        if (matchingTxs.length === 0 || !newDescription) {
          return {
            id: actionId,
            type: 'rename_transactions',
            title: 'Padronizar Nomes de Transações',
            description: `Nenhuma transação encontrada contendo "${searchDescription}"${targetAcc ? ` no cartão/conta "${targetAcc.name}"` : ''}.`,
            status: 'cancelled',
            details: [],
            payload: {},
            errorMessage: 'Nenhum lançamento localizado com o termo informado.'
          };
        }

        const previewTxs = matchingTxs.slice(0, 3).map(t => `"${t.description}"`).join(', ');
        const extraCount = matchingTxs.length > 3 ? ` e mais ${matchingTxs.length - 3}` : '';

        return {
          id: actionId,
          type: 'rename_transactions',
          title: 'Padronizar Nomes de Transações',
          description: `Renomear ${matchingTxs.length} lançamento(s) para "${newDescription}"${applyToFuture ? ' e ativar regra contínua para gastos futuros' : ''}.`,
          status: 'pending',
          details: [
            { label: 'Termo de Busca', value: searchDescription },
            { label: 'Novo Nome Padronizado', value: newDescription },
            { label: 'Transações Encontradas', value: `${matchingTxs.length} (${previewTxs}${extraCount})` },
            ...(targetAcc ? [{ label: 'Conta/Cartão', value: targetAcc.name }] : []),
            { label: 'Regra para o Futuro', value: applyToFuture ? '✅ Ativada (aplicar nos próximos lançamentos)' : 'Apenas nestas transações' }
          ],
          payload: {
            transactionIds: matchingTxs.map(t => t.id),
            searchDescription,
            newDescription,
            applyToFuture: !!applyToFuture
          }
        };
      }

      case 'set_as_subscription': {
        const { serviceName, amount, cadence = 'monthly' } = args;
        const matchingTxs = this.findTransactionsByDescription(serviceName, ctx.transactions);
        const refTx = matchingTxs[0];

        const finalAmount = amount || (refTx ? refTx.amount : 0);
        const catId = refTx?.categoryId || 'cat-lazer';
        const accId = refTx?.accountId || ctx.accounts[0]?.id;

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        const nextBillingDate = nextDate.toISOString().substring(0, 10);

        return {
          id: actionId,
          type: 'set_as_subscription',
          title: 'Definir Assinatura Recorrente',
          description: `Adicionar "${serviceName}" ao painel de assinaturas ativas com custo de R$ ${finalAmount.toFixed(2)}/${cadence === 'yearly' ? 'ano' : 'mês'}.`,
          status: 'pending',
          details: [
            { label: 'Serviço', value: serviceName },
            { label: 'Valor', value: `R$ ${finalAmount.toFixed(2)}` },
            { label: 'Frequência', value: cadence === 'yearly' ? 'Anual' : 'Mensal' },
            { label: 'Próxima Cobrança', value: nextBillingDate }
          ],
          payload: {
            name: serviceName,
            amount: finalAmount,
            cadence,
            categoryId: catId,
            accountId: accId,
            nextBillingDate
          }
        };
      }

      case 'adjust_budget': {
        const { categoryName, monthlyLimit } = args;
        const targetCat = this.findCategoryByName(categoryName, ctx.categories);

        if (!targetCat) {
          return {
            id: actionId,
            type: 'adjust_budget',
            title: 'Ajustar Orçamento',
            description: `Categoria "${categoryName}" não localizada.`,
            status: 'cancelled',
            details: [],
            payload: {},
            errorMessage: 'Categoria inexistente.'
          };
        }

        const now = new Date();
        return {
          id: actionId,
          type: 'adjust_budget',
          title: 'Ajustar Limite de Orçamento',
          description: `Definir teto de gastos para "${targetCat.name}" em R$ ${Number(monthlyLimit).toFixed(2)} no mês atual.`,
          status: 'pending',
          details: [
            { label: 'Categoria', value: targetCat.name },
            { label: 'Novo Teto Mensal', value: `R$ ${Number(monthlyLimit).toFixed(2)}` },
            { label: 'Mês de Referência', value: `${now.getMonth() + 1}/${now.getFullYear()}` }
          ],
          payload: {
            categoryId: targetCat.id,
            monthlyLimit: Number(monthlyLimit),
            month: now.getMonth() + 1,
            year: now.getFullYear()
          }
        };
      }

      case 'create_transaction': {
        const { description, amount, type, categoryName, accountName, date, isSubscription } = args;
        const matchedCat = categoryName ? this.findCategoryByName(categoryName, ctx.categories) : null;
        const fallbackCat = type === 'income' ? 'cat-salario' : 'cat-outros-desp';
        const finalCatId = matchedCat?.id || fallbackCat;

        const matchedAcc = accountName ? this.findAccountByName(accountName, ctx.accounts) : null;
        const finalAccId = matchedAcc?.id || ctx.accounts[0]?.id || 'acc-padrao';

        const finalDate = date || new Date().toISOString().substring(0, 10);

        return {
          id: actionId,
          type: 'create_transaction',
          title: type === 'income' ? 'Registrar Nova Receita' : 'Registrar Nova Despesa',
          description: `Lançar "${description}" no valor de R$ ${Number(amount).toFixed(2)}.`,
          status: 'pending',
          details: [
            { label: 'Descrição', value: description },
            { label: 'Valor', value: `R$ ${Number(amount).toFixed(2)}` },
            { label: 'Categoria', value: matchedCat?.name || 'Geral' },
            { label: 'Conta/Cartão', value: matchedAcc?.name || 'Padrão' },
            { label: 'Data', value: finalDate }
          ],
          payload: {
            description,
            amount: Number(amount),
            type: type || 'expense',
            categoryId: finalCatId,
            accountId: finalAccId,
            date: finalDate,
            paymentMethod: matchedAcc?.type === 'credit_card' ? 'credit' : 'debit',
            status: 'confirmed',
            source: 'manual',
            isSubscription: !!isSubscription
          }
        };
      }

      default:
        return null;
    }
  }

  /**
   * Executa uma ação que foi aprovada pelo usuário
   */
  static async executeAction(
    action: ProposedAiAction,
    ctx: ActionResolutionContext,
    callbacks: ActionExecutionCallbacks
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (action.type) {
        case 'move_transaction_account': {
          const { transactionIds, targetAccountId, targetAccountName } = action.payload;
          for (const txId of transactionIds) {
            const tx = ctx.transactions.find(t => t.id === txId);
            if (tx) {
              await callbacks.saveTransaction({
                ...tx,
                accountId: targetAccountId
              });
            }
          }
          await callbacks.refreshData();
          return { success: true, message: `Cobrança movida com sucesso para o cartão "${targetAccountName}".` };
        }

        case 'recategorize_transactions': {
          const { transactionIds, targetCategoryId, searchDescription } = action.payload;
          for (const txId of transactionIds) {
            const tx = ctx.transactions.find(t => t.id === txId);
            if (tx) {
              await callbacks.saveTransaction({
                ...tx,
                categoryId: targetCategoryId
              });
            }
          }
          if (callbacks.recordCategoryLearning && searchDescription) {
            await callbacks.recordCategoryLearning(searchDescription, targetCategoryId);
          }
          await callbacks.refreshData();
          return { success: true, message: `${transactionIds.length} transação(ões) atualizadas com a nova categoria.` };
        }

        case 'rename_transactions': {
          const { transactionIds, searchDescription, newDescription, applyToFuture } = action.payload;
          for (const txId of transactionIds) {
            const tx = ctx.transactions.find(t => t.id === txId);
            if (tx) {
              await callbacks.saveTransaction({
                ...tx,
                description: newDescription
              });
            }
          }

          // Se o usuário optou por aplicar nos futuros, cria regra persistida
          if (applyToFuture && callbacks.saveDescriptionRule) {
            const rule = merchantCleaner.createRule(searchDescription, newDescription);
            await callbacks.saveDescriptionRule(rule);
          }

          await callbacks.refreshData();
          return {
            success: true,
            message: `${transactionIds.length} transação(ões) renomeada(s) para "${newDescription}"${applyToFuture ? ' e regra salva para gastos futuros.' : '.'}`
          };
        }

        case 'set_as_subscription': {
          const { name, amount, cadence, categoryId, accountId, nextBillingDate } = action.payload;
          await callbacks.saveSubscription({
            name,
            amount,
            cadence,
            categoryId,
            accountId,
            nextBillingDate,
            status: 'active'
          });
          await callbacks.refreshData();
          return { success: true, message: `Assinatura "${name}" ativada no seu controle!` };
        }

        case 'adjust_budget': {
          const { categoryId, monthlyLimit, month, year } = action.payload;
          await callbacks.saveBudget({
            categoryId,
            monthlyLimit,
            month,
            year
          });
          await callbacks.refreshData();
          return { success: true, message: `Teto de orçamento atualizado para R$ ${monthlyLimit.toFixed(2)}.` };
        }

        case 'create_transaction': {
          const { isSubscription, ...txData } = action.payload;
          await callbacks.saveTransaction(
            txData,
            isSubscription ? { cadence: 'monthly' } : undefined
          );
          await callbacks.refreshData();
          return { success: true, message: `Lançamento "${txData.description}" registrado com sucesso!` };
        }

        default:
          return { success: false, message: 'Tipo de ação desconhecido.' };
      }
    } catch (e: any) {
      console.error('Erro ao executar ação da IA:', e);
      return { success: false, message: e.message || 'Falha ao executar ação.' };
    }
  }

  // --- MÉTODOS AUXILIARES DE BUSCA FUZZY ---
  private static findAccountByName(name: string, accounts: Account[]): Account | undefined {
    if (!name) return undefined;
    const clean = name.toLowerCase().trim();
    // 1. Busca exata
    const exact = accounts.find(a => a.name.toLowerCase() === clean);
    if (exact) return exact;
    // 2. Busca parcial (ex: "nu" encontra "Nubank")
    return accounts.find(a => a.name.toLowerCase().includes(clean) || clean.includes(a.name.toLowerCase()));
  }

  private static findCategoryByName(name: string, categories: Category[]): Category | undefined {
    if (!name) return undefined;
    const clean = name.toLowerCase().trim();
    const exact = categories.find(c => c.name.toLowerCase() === clean);
    if (exact) return exact;
    return categories.find(c => c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase()));
  }

  private static findTransactionsByDescription(term: string, transactions: Transaction[]): Transaction[] {
    if (!term) return [];
    const clean = term.toLowerCase().trim();
    return transactions.filter(t => t.description.toLowerCase().includes(clean));
  }
}
