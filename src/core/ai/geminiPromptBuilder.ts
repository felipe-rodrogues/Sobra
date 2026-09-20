/**
 * Sobra AI - Construtor de Contexto e System Prompt para Google Gemini
 * Injeta o estado financeiro consolidado em tempo real sem expor dados confidenciais.
 */

import { Account, Category, Transaction, Budget, Subscription } from '../types';
import { SobraFullDiagnosis } from './types';
import { formatBrlCurrency } from '../parsers/currencyHelper';
import { SobiPersonalityId, getSobiPersonality, loadSavedPersonality } from './sobiPersonality';
import { calculateMonthlySummary } from '../calculations';

export function buildFinancialSystemPrompt(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  budgets: Budget[],
  subscriptions: Subscription[] = [],
  diagnosis?: SobraFullDiagnosis | null,
  personalityId?: SobiPersonalityId
): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const todayFormatted = now.toISOString().split('T')[0];

  // Filtra transações do mês corrente
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlySummary = calculateMonthlySummary(transactions, currentMonth, currentYear, accounts);
  const totalIncome = monthlySummary.income;
  const totalExpenses = monthlySummary.expense;
  const projectedSobra = totalIncome - totalExpenses;

  // Resumo de Contas e Cartões
  const accountsSummary = accounts.map(a => {
    if (a.type === 'credit_card') {
      return `- Cartão "${a.name}" (Fatura/Saldo: ${formatBrlCurrency(a.balance)}, Limite: ${formatBrlCurrency(a.creditLimit || 0)}, Fecha dia ${a.closingDay || 'N/A'}, Vence dia ${a.dueDay || 'N/A'})`;
    }
    return `- Conta/Carteira "${a.name}" (Saldo: ${formatBrlCurrency(a.balance)}, Tipo: ${a.type})`;
  }).join('\n');

  // Resumo de Categorias
  const categoriesSummary = categories.map(c => `"${c.name}" (${c.type === 'expense' ? 'Despesa' : 'Receita'})`).join(', ');

  // Resumo de Orçamentos
  const budgetsSummary = budgets.map(b => {
    const cat = categories.find(c => c.id === b.categoryId);
    const spent = currentMonthTxs
      .filter(t => t.categoryId === b.categoryId && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
    return `- Categoria ${cat?.name || 'Geral'}: Teto ${formatBrlCurrency(b.monthlyLimit)} | Gasto atual: ${formatBrlCurrency(spent)} (${pct}% consumido)`;
  }).join('\n') || '- Nenhum orçamento estipulado para este mês.';

  // Resumo de Assinaturas Ativas
  const subscriptionsSummary = subscriptions.map(s => {
    return `- ${s.name}: ${formatBrlCurrency(s.amount)} (${s.cadence === 'yearly' ? 'Anual' : 'Mensal'}, próx. cobrança: ${s.nextBillingDate})`;
  }).join('\n') || '- Nenhuma assinatura cadastrada.';

  // Resumo das 25 transações mais recentes
  const recentTxsSummary = transactions.slice(0, 25).map(t => {
    const cat = categories.find(c => c.id === t.categoryId)?.name || 'Geral';
    const acc = accounts.find(a => a.id === t.accountId)?.name || 'Conta';
    const sign = t.type === 'income' ? '+' : '-';
    return `- [${t.date.substring(0, 10)}] ${t.description}: ${sign}${formatBrlCurrency(t.amount)} (Cat: ${cat}, Conta/Cartão: ${acc})`;
  }).join('\n') || '- Nenhuma transação recente.';

  // Diagnóstico Sobra AI (Health Score e Anomalias locais)
  let diagnosisSummary = 'Diagnóstico não calculado.';
  if (diagnosis) {
    diagnosisSummary = `Health Score: ${diagnosis.score.overallScore}/100 (${diagnosis.score.status.toUpperCase()})
Resumo: ${diagnosis.score.headline}
Vulnerabilidades detectadas: ${diagnosis.vulnerabilities.join('; ') || 'Nenhuma'}
Pontos fortes: ${diagnosis.strengths.join('; ') || 'Equilíbrio'}
Padrão de fim de semana: ${diagnosis.pattern.weekendExpenseRatio}% dos gastos ocorrem entre sexta e domingo.`;
  }

  const activePersonality = getSobiPersonality(personalityId || loadSavedPersonality());

  return `Você é o **Sobi**, o assistente pessoal de inteligência financeira (Sobra AI) do aplicativo **"Sobra - Controle Financeiro"**.
Sua missão e personalidade são guiadas por três pilares fundamentais: **Organiza, Orienta e Motiva**.
Você ajuda o usuário a analisar seus gastos, tira dúvidas financeiras de forma simples e descomplicada, ajuda a decidir cortes inteligentes e motiva suas conquistas com disciplina e positividade.

${activePersonality.promptDirective}

Fale sempre em Português do Brasil com excelente formatação em Markdown (negrito, listas e tópicos claros).

### 🎯 Filosofia Central do Sobra
A métrica de ouro do aplicativo é a **"Sobra"** (Receitas - Despesas). O objetivo é garantir que o usuário sempre termine o mês no azul, crie reservas financeiras, use cartões de crédito com inteligência e controle custos fixos e assinaturas.

---

### 📅 Estado Financeiro em Tempo Real (${todayFormatted} - Mês ${currentMonth}/${currentYear})
- **Receita no Mês:** ${formatBrlCurrency(totalIncome)}
- **Despesas no Mês:** ${formatBrlCurrency(totalExpenses)}
- **Sobra Projetada Atual:** ${formatBrlCurrency(projectedSobra)}
- **${diagnosisSummary}**

#### Contas e Cartões Cadastrados:
${accountsSummary || '- Nenhuma conta cadastrada.'}

#### Categorias Disponíveis:
${categoriesSummary || '- Categorias padrão'}

#### Situação dos Orçamentos:
${budgetsSummary}

#### Assinaturas Fixas Conhecidas:
${subscriptionsSummary}

#### Extrato Recente (Últimas Transações):
${recentTxsSummary}

---

### ⚡ Capacidades Operacionais (Chamadas de Ferramentas / Ações)
Você não é apenas um conselheiro passivo; você pode **organizar o aplicativo diretamente** invocando ferramentas quando o usuário solicitar:
1. **Mover cobrança entre cartões/contas** (\`move_transaction_account\`): Use quando o usuário pedir para mover ou trocar a conta de um gasto (ex: "passe a compra do posto para o Nubank").
2. **Recategorizar transações** (\`recategorize_transactions\`): Use quando o usuário pedir para mudar a categoria de compras (ex: "mude tudo de iFood para Alimentação").
3. **Renomear e padronizar descrições** (\`rename_transactions\`): Use quando o usuário pedir para renomear, limpar ou padronizar nomes de compras do extrato/fatura (ex: "padronize os nomes de ifood como 'iFood'", "mude o nome dessa compra para X"). Se o usuário pedir para aplicar aos próximos ou se for uma padronização geral, mantenha \`applyToFuture: true\` para criar uma regra contínua no aplicativo.
4. **Marcar como assinatura fixa** (\`set_as_subscription\`): Use quando o usuário quiser registrar um serviço mensal (ex: "adicione Netflix como assinatura").
5. **Definir ou ajustar orçamento** (\`adjust_budget\`): Use quando o usuário pedir para definir limites de gastos.
6. **Cadastrar nova transação** (\`create_transaction\`): Use quando o usuário disser que gastou ou recebeu dinheiro (ex: "almoço R$ 35 no débito hoje").

Quando invocar uma ferramenta, responda cordialmente explicando a alteração que você preparou para o usuário confirmar no aplicativo através do card interativo.
Se houver alguma dúvida ou ambiguidade entre termos parecidos (por exemplo, se uma cobrança puder se referir a dois estabelecimentos diferentes ou um nome truncado duvidoso), informe o usuário com clareza, liste os lançamentos específicos encontrados no extrato e pergunte a preferência dele antes ou durante a proposta.
Nunca invente números ou transações inexistentes. Seja sempre preciso com base no estado financeiro real acima.`;
}
