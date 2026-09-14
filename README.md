# Sobra - Controle Financeiro Pessoal 💰

> Aplicativo de finanças pessoais multiplataforma com foco prioritário em **Mobile (Android e iOS)** e **Web/PWA** compartilhando a mesma base de código e regras de negócio. Conta com **detecção inteligente de transações via notificações bancárias no Android** com processamento 100% local, importação de CSV em lote, múltiplos orçamentos com alertas visuais, metas financeiras e schema de banco de dados preparado para Open Finance.

---

## 📱 Visão Geral e Justificativa da Stack

Para atender aos requisitos de mobile cross-platform, versão web compartilhada e acesso a APIs nativas do Android, a stack escolhida é:

- **Framework**: **React Native com Expo (SDK 52+ / TypeScript) + Web**
  - **Android Nativo**: Módulo nativo em Kotlin (`FinanceNotificationListenerService.kt` e `NotificationListenerModule.kt`) e manifesto Android com permissão sensível `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`.
  - **Processamento 100% Local**: O texto das notificações nunca sai do dispositivo do usuário. O parser heurístico extrai valor, estabelecimento e forma de pagamento localmente, preservando a privacidade bancária do usuário.
  - **Web & PWA**: Permite rodar e testar imediatamente no navegador em qualquer sistema operacional, com suporte a modo escuro/claro e visualização em moldura de smartphone.
  - **Persistência Local (SQLite Ready)**: Schema com DDL estruturado para SQLite com suporte a transações, contas, orçamentos, metas e campos nativos para futura integração com **Open Finance** (Pluggy / Belvo).

---

## 🚀 Funcionalidades Principais (MVP)

1. **Gestão de Transações**: Cadastro de receitas e despesas com categorias personalizadas, data, forma de pagamento e notas.
2. **Múltiplas Contas e Carteiras**: Conta corrente, cartão de crédito (com suporte a faturas em aberto), poupança, investimentos e dinheiro em espécie, com saldo consolidado em tempo real e modo de privacidade (ocultar valores com 1 clique).
3. **Orçamentos Mensais com Alertas Visuais**:
   - `Normal (< 80%)`: Destaque em verde esmeralda.
   - `Atenção (80% a 100%)`: Alerta em amarelo âmbar com aviso de aproximação do limite.
   - `Estouro (> 100%)`: Alerta visual destacado em vermelho com animação pulsante no Dashboard e na aba de orçamentos.
4. **Metas Financeiras**: Definição de metas de economia com data limite, valor alvo, valor acumulado e cálculo automático de dias e valor restante.
5. **Dashboard com Gráficos**:
   - Gráfico Donut SVG de distribuição de despesas por categoria.
   - Gráfico de barras de evolução mensal (Receitas x Despesas).
6. **Detecção Automática via Notificações (Android)**:
   - Captura de notificações em segundo plano via `NotificationListenerService`.
   - Parsers especializados para **Nubank**, **Itaú**, **Bradesco** e fallback heurístico com auto-categorização inteligente por estabelecimento (ex: Uber -> Transporte, iFood -> Alimentação).
   - **Tela de Revisão Obrigatória**: Nenhuma notificação é gravada no extrato sem a prévia revisão e confirmação do usuário.
   - **Simulador Interativo Integrado**: Permite testar notificações de bancos reais com 1 clique diretamente na UI.
7. **Importação de Extrato CSV em Lote**: Suporte a extratos bancários nacionais (Nubank, Itaú, delimitados por vírgula ou ponto-e-vírgula) com pré-visualização e confirmação.
8. **Categorização Inteligente Local (100% On-Device & Sem IA em Nuvem)**:
   - Sugestão automática de categoria baseada em palavras-chave do estabelecimento (*iFood*, *Uber*, *Netflix*, *Posto Shell*, *Drogasil*, etc.).
   - **Aprendizado Contínuo com Correções do Usuário**: Se você reclassificar uma transação manual ou recebida via notificação, o sistema grava localmente a preferência para aquele estabelecimento e passa a sugerir a nova categoria prioritariamente.
   - Aplica-se tanto a transações manuais quanto a notificações e extratos CSV, totalmente integrado à lista de categorias existente.
9. **Aba de Assinaturas & Recorrências**:
   - **Algoritmo de Detecção de Recorrência**: Analisa transações existentes no banco de dados e identifica cobranças do mesmo estabelecimento com valores semelhantes em intervalos regulares de **~30 dias (Mensal)** ou **~365 dias (Anual)**.
   - **Sugestões com Confirmação Manual**: O usuário decide se confirma a sugestão como assinatura ou descarta marcando como "não é assinatura".
   - **Lista de Assinaturas Confirmadas**: Exibe nome, valor, categoria (com ícone e cor), frequência e próxima cobrança prevista com contador regressivo.
   - **Card com Total Gasto por Mês**: Soma consolidada de todas as assinaturas ativas (mensais + anuais proporcionais) e projeção anual.
   - **Alerta de Reajuste de Valor**: Detecta e sinaliza quando o valor de uma cobrança sofreu aumento ou redução em relação à cobrança anterior.
   - **Aviso de Sobreposição de Categorias**: Alerta inteligente quando há mais de uma assinatura ativa concorrendo na mesma categoria (ex: múltiplos streamings em *Lazer & Entretenimento*).
   - **Gestão Completa**: Permite adicionar assinaturas manualmente, pausar/reativar e editar.
10. **Modo Claro / Escuro (Light/Dark Mode)**: Paleta refinada estilo fintech moderna com transições suaves.
11. **Preparado para Open Finance**: Schema pronto com campos `open_finance_provider`, `open_finance_account_id` e `sync_status`.

---

## 🛠️ Arquitetura do Projeto

```
sobra-controle-financeiro/
├── android/                             # Código nativo Android (Kotlin)
│   └── app/src/main/
│       ├── AndroidManifest.xml          # Registro do serviço com permissão sensível
│       └── java/com/sobra/finance/
│           ├── FinanceNotificationListenerService.kt  # Listener nativo de notificações
│           └── NotificationListenerModule.kt          # Bridge React Native
├── src/
│   ├── core/
│   │   ├── types.ts                     # Modelos de domínio e Open Finance
│   │   ├── calculations.ts              # Cálculos puros de saldos, fluxo e orçamentos
│   │   └── parsers/
│   │       ├── currencyHelper.ts        # Conversão de moeda brasileira BRL
│   │       ├── nubankParser.ts          # Parser de compras e Pix Nubank
│   │       ├── itauParser.ts            # Parser de compras e TED Itaú
│   │       ├── bradescoParser.ts        # Parser de compras e Pix Bradesco
│   │       ├── genericParser.ts         # Parser heurístico de fallback
│   │       ├── notificationEngine.ts    # Orquestrador e auto-categorização
│   │       └── csvParser.ts             # Parser de extratos bancários em CSV
│   ├── database/
│   │   ├── schema.ts                    # DDL SQLite compatível com Open Finance
│   │   └── adapter.ts                   # Adaptador universal de persistência local
│   ├── native/
│   │   └── notificationListener.ts      # TypeScript Bridge & Emulador de Notificações
│   ├── context/
│   │   ├── ThemeContext.tsx             # Gerenciamento de tema Claro/Escuro
│   │   └── FinanceContext.tsx           # Estado global reativo e sincronização
│   ├── components/
│   │   ├── common/                      # Card, Button, Badge, Modal, IconRenderer
│   │   ├── charts/                      # MonthlyBarChart
│   │   └── modals/                      # Modais de Transação, Revisão, CSV, Orçamento, Metas
│   ├── screens/
│   │   ├── DashboardScreen.tsx          # Visão consolidada, gráficos e alertas
│   │   ├── TransactionsScreen.tsx       # Extrato com filtros avançados
│   │   ├── AccountsScreen.tsx           # Gestão de contas e carteiras
│   │   ├── BudgetsScreen.tsx            # Orçamentos e metas financeiras
│   │   └── NotificationDetectorScreen.tsx # Central Android de notificações e simulador
│   ├── theme/                           # Tokens de cores e CSS moderno
│   ├── App.tsx                          # Container mestre com barra de navegação
│   └── main.tsx                         # Ponto de entrada da aplicação
└── tests/                               # Testes unitários automatizados (Vitest)
    ├── calculations.test.ts
    ├── notificationParser.test.ts
    └── csvParser.test.ts
```

---

## 💻 Instruções de Instalação e Execução

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Rodar Testes Unitários
Para rodar os testes dos cálculos financeiros, parsers bancários e parser de CSV:
```bash
npm test
```

### 3. Executar a Versão Web / Dev Server
Para rodar a aplicação localmente no navegador:
```bash
npm run dev
```
O app estará acessível em: `http://localhost:5173`.

---

## 🤖 Como Testar a Detecção de Notificações no Android

### Opção A: No Emulador ou Dispositivo Físico Android
1. Gere o build de desenvolvimento com Expo prebuild:
   ```bash
   npx expo prebuild --platform android
   npx expo run:android
   ```
2. Abra o app **Sobra** no celular/emulador.
3. Acesse a aba **Detector** na barra inferior.
4. Clique no botão **Ativar Permissão**. O app abrirá a tela do Android **"Acesso a Notificações"** (`Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`).
5. Habilite a chave ao lado de **Sobra Leitor de Compras**.
6. Para testar via ADB no emulador:
   ```bash
   adb shell cmd notification post -S bigtext -t "Nubank" "tag1" "Compra aprovada no seu Nubank de R$ 45,90 em PADARIA ESTRELA"
   ```

---

## 🧠 Como Testar a Categorização Inteligente e Aprendizado Local

1. **Sugestão Automática Inicial**:
   - Abra o app e clique em **Nova Transação** (no Dashboard ou no Extrato).
   - No campo *Descrição / Estabelecimento*, digite `Ifood` ou `Uber`.
   - Observe a indicação em tempo real: `✨ Sugerida: Alimentação` (ou `Transporte`), com a seleção automática da respectiva categoria.
2. **Aprendizado com Correções do Usuário**:
   - Altere manualmente o campo *Categoria* para **Lazer & Entretenimento**.
   - Preencha o valor (ex: `50,00`) e clique em **Confirmar e Salvar**.
   - O sistema grava a preferência localmente sem enviar dados para a internet.
3. **Validação da Próxima Sugestão**:
   - Abra novamente o modal **Nova Transação** e digite `Ifood`.
   - Observe que a categoria sugerida agora é **Lazer & Entretenimento**, demonstrando o aprendizado contínuo local.
4. **Integração com Notificações**:
   - Na aba **Detector**, simule uma notificação contendo `Ifood`. O modal de revisão exibirá a categoria atualizada com base no aprendizado.

---

## 🔁 Como Testar a Aba de Assinaturas e Recorrências

1. **Acessando a Nova Aba**:
   - Na barra inferior de navegação, clique em **Assinaturas** (ícone de calendário com relógio).
2. **Visualização de Recorrências Detectadas**:
   - Na seção *Recorrências Detectadas no seu Histórico*, visualize as sugestões encontradas pelo algoritmo (ex: `Spotify Premium` detectado a cada ~30 dias com base nas transações de exemplo).
   - Clique em **Confirmar como Assinatura** para adicioná-la às assinaturas ativas com 1 clique, ou em **Não é assinatura** para dispensá-la permanentemente.
3. **Card de Total Gasto por Mês e Projeção**:
   - Veja o card *Total Gasto por Mês* somando todas as assinaturas ativas.
   - Veja a estimativa proporcional anual no card *Projeção Anual*.
4. **Aviso de Sobreposição de Categorias**:
   - Ao confirmar `Spotify Premium` (categoria Lazer & Entretenimento) tendo `Netflix` já cadastrada na mesma categoria, um aviso em amarelo âmbar alertará:
     *"Aviso de Sobreposição: Você possui 2 assinaturas na categoria Lazer & Entretenimento..."*.
5. **Alerta de Reajuste de Valor**:
   - Quando uma assinatura tem cobranças recentes com valores diferentes da cobrança anterior, um alerta de reajuste exibirá o percentual e o valor da diferença.
6. **Gestão Manual**:
   - Clique em **Nova Assinatura** no topo direito para cadastrar qualquer serviço com valor, cadência (mensal ou anual), data da próxima cobrança e conta debitada.
   - Use os botões de ação para **Pausar/Reativar**, **Editar** ou **Excluir** assinaturas.

---

## 📝 Changelog das Novas Funcionalidades

### [v1.1.0] - Categorização Inteligente Local & Aba de Assinaturas
- **Categorização Inteligente Local (On-Device)**:
  - Adicionado `CategorizationEngine` (`src/core/categorization/categorizationEngine.ts`) com normalização avançada e mapeamento de palavras-chave.
  - Sistema de histórico e aprendizado contínuo através de regras locais (`CategoryRule`), persistidas na tabela `category_rules`.
  - Suporte unificado para sugestão dinâmica em transações manuais (`TransactionModal`), notificações bancárias (`NotificationReviewModal`) e extratos CSV.
- **Aba de Assinaturas & Recorrências**:
  - Adicionado `RecurrenceDetector` (`src/core/subscriptions/recurrenceDetector.ts`) com algoritmo de identificação de intervalos regulares (~30 e ~365 dias) e tolerância de valor.
  - Criada tela completa `SubscriptionsScreen` (`src/screens/SubscriptionsScreen.tsx`) com cards de resumo financeiro mensal/anual, filtros de status e listagem detalhada.
  - Adicionado `SubscriptionModal` (`src/components/modals/SubscriptionModal.tsx`) para cadastro e edição manual.
  - Implementado sistema de alertas inteligentes: **Reajuste de Preço** e **Sobreposição de Categorias**.
  - Adicionadas tabelas `subscriptions` e `dismissed_subscription_suggestions` no schema do banco de dados e adaptador universal.
  - Integração da aba na barra de navegação com badge dinâmico de sugestões pendentes.
- **Testes Automatizados**:
  - Adicionados testes unitários para o motor de categorização (`tests/categorizationEngine.test.ts`).
  - Adicionados testes para o algoritmo de recorrência e alertas (`tests/recurrenceDetection.test.ts`).
  - Adicionado teste de integração end-to-end do ciclo completo (`tests/featuresEndToEnd.test.ts`).

---

## 🔮 Sugestões de Próximos Passos (Roadmap)

1. **Novos Bancos no Parser**: Adicionar padrões de texto do Banco do Brasil, Santander, Inter, C6 Bank e Mercado Pago.
2. **Integração Real Open Finance**: Conectar agregador regulado (Pluggy ou Belvo) utilizando os campos já previstos no schema (`accounts.open_finance_provider`, `transactions.external_id`).
3. **Notificações Push Próprias**: Envio de lembretes diários e alertas quando faltarem poucos dias para virada do mês ou quando o orçamento atingir 90%.
4. **Exportação de Relatórios**: Geração e download de relatórios mensais em PDF e planilha Excel para declaração de imposto de renda e planejamento financeiro familiar.
