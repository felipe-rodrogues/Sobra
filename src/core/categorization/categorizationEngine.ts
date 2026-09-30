/**
 * Sobra - Motor de Categorização Inteligente Local (100% On-Device)
 * 
 * Processamento local sem IA em nuvem.
 * Prioridade:
 * 1. Regras aprendidas e correções manuais do usuário (CategoryRule) devidamente sanitizadas
 * 2. Mapeamento heurístico profundo de palavras-chave locais e nacionais
 */

import { Category, CategoryRule } from '../types';

export interface KeywordCategoryMapping {
  categoryId?: string;
  categoryMatch: string;
  fallbackMatch?: string;
  keywords: string[];
}

export class CategorizationEngine {
  private defaultRules: KeywordCategoryMapping[] = [
    // 1. Delivery & Restaurantes (Estilo de Vida) - Alta prioridade para capturar pedidos de comida antes de transporte/streaming
    {
      categoryId: 'cat-restaurantes',
      categoryMatch: 'restaurantes',
      fallbackMatch: 'alimentação',
      keywords: [
        'ifood', '99 food', '99food', 'uber eats', 'ubereats', 'rappi', 'aiqfome', 'delivery much', 'deliway', 'ze delivery', 'zedelivery', 'delivery',
        'mcdonalds', 'mc donalds', 'mcdonald', 'burger king', 'burgerking', 'bk', 'habibs', 'habib', 'subway', 'starbucks', 'kfc', 'bobs', 'bob',
        'pizzahut', 'pizza hut', 'dominos', 'domino', 'spoleto', 'giraffas', 'madero', 'jeronymo', 'pobre juan', 'outback', 'applebees', 'coco bambu', 'ragazzo',
        'restaurante', 'pizzaria', 'hamburgueria', 'burger', 'churrascaria', 'sushi', 'temakeria', 'pastelaria', 'choperia', 'cervejaria', 'bar', 'boteco',
        'botequim', 'pub', 'bistro', 'cafeteria', 'cafe', 'doceria', 'confeitaria', 'sorveteria', 'gelateria', 'acai', 'lanchonete', 'lanches',
        'espetinho', 'cantina', 'buffet', 'the coffee', 'havanna', 'kopenhagen', 'cacau show', 'brasil cacau',
        'alimentacao', 'refeicao', 'vale refeicao', 'vr', 'sodexo refeicao', 'ticket restaurante', 'alelo refeicao', 'refeitorio'
      ],
    },

    // 2. Supermercado & Feira (Essenciais)
    {
      categoryId: 'cat-mercado',
      categoryMatch: 'supermercado',
      fallbackMatch: 'alimentação',
      keywords: [
        'supermercado', 'supermercados', 'hipermercado', 'mercado', 'mercadinho', 'pao de acucar', 'carrefour', 'atacadao', 'atacadista', 'atacado',
        'assai', 'sam\'s club', 'sams club', 'sonda', 'mambo', 'st marche', 'marche', 'zaffari', 'super muffato', 'muffato', 'condor', 'prezunic',
        'guanabara', 'mundial', 'savegnago', 'supermercado bh', 'super nosso', 'dia supermercado', 'supermercado dia', 'spani', 'tenda atacado',
        'roldao', 'acougue', 'casa de carnes', 'peixaria', 'hortifruti', 'sacolao', 'feira', 'padaria', 'panificadora', 'emporio', 'quitanda'
      ],
    },

    // 3. Transporte & Mobilidade (Essenciais) - Veículo próprio, carona por app (Uber, 99), transporte público, combustível, pedágio e manutenção
    {
      categoryId: 'cat-transp',
      categoryMatch: 'transporte',
      fallbackMatch: 'mobilidade',
      keywords: [
        // Apps de carona & Táxi
        'uber', '99', '99app', 'app99', '99 pop', '99pop', '99 corrida', '99 corridas', '99 taxi', '99plus', '99 comfort',
        'cabify', 'indrive', 'in drive', 'taxi', 'táxi', 'coopertax', 'radiotaxi',
        // Transporte coletivo & Micromobilidade
        'metro', 'metrô', 'onibus', 'ônibus', 'cptm', 'sptrans', 'bilhete unico', 'bilhete único', 'top transporte', 'top',
        'cartaorio', 'riocard', 'jae', 'vlt', 'bhtrans', 'metrorec', 'metrofor', 'tembici', 'bikeitau', 'bike itau', 'whoosh',
        // Combustível & Postos
        'posto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'ipiranga ampm', 'gasolina', 'etanol', 'combustivel', 'diesel', 'gnv', 'auto posto',
        // Pedágios & Tags
        'pedagio', 'sem parar', 'semparar', 'conectcar', 'conect car', 'veloe', 'tag itau', 'ccr', 'ecovias', 'autoban', 'arteris', 'rodoanel',
        // Estacionamento
        'estacionamento', 'estapar', 'multipark', 'indigo', 'parebem', 'valet', 'garagem',
        // Manutenção Veicular & Taxas
        'oficina mecanica', 'mecanico', 'borracharia', 'pneus', 'pneu', 'troca de oleo', 'lava rapido', 'lava jato', 'estetica automotiva',
        'ipva', 'detran', 'dpvat', 'licenciamento', 'cnh', 'multa de transito'
      ],
    },

    // 4. Farmácia & Remédios (Essenciais)
    {
      categoryId: 'cat-farmacia',
      categoryMatch: 'farmácia',
      fallbackMatch: 'saúde',
      keywords: [
        'farmacia', 'drogaria', 'drogasil', 'droga raia', 'raia drogasil', 'panvel', 'pacheco', 'drogaria sao paulo', 'dpsp',
        'ultrafarma', 'pague menos', 'drogaria araujo', 'bifarma', 'drogal', 'drogaria venancio', 'venancio', 'nissei',
        'farmacias associadas', 'drogaria catarinense', 'remedio', 'medicamento', 'manipulacao'
      ],
    },

    // 5. Saúde & Consultas (Essenciais)
    {
      categoryId: 'cat-saude',
      categoryMatch: 'saúde',
      keywords: [
        'hospital', 'clinica', 'consulta', 'laboratorio', 'medico', 'doutor', 'saude', 'dentista', 'odontologia', 'ortodontia',
        'otica', 'optica', 'terapia', 'psicologo', 'psicoterapia', 'fisioterapia', 'fleury', 'lavoisier', 'dasa', 'a+ medicina',
        'delboni', 'hermes pardini', 'unimed', 'bradesco saude', 'amil', 'notredame', 'intermedica', 'gndi', 'sulamerica saude',
        'prevent senior', 'hapvida', 'porto seguro saude', 'oftalmologista', 'oftalmo', 'pediatra', 'dermatologista', 'cardiologista',
        'ginecologista', 'nutricionista'
      ],
    },

    // 6. Assinaturas & Streaming (Estilo de Vida) - Google, Streamings de Vídeo/Áudio e Software em Nuvem
    {
      categoryId: 'cat-streaming',
      categoryMatch: 'streaming',
      fallbackMatch: 'lazer',
      keywords: [
        'google', 'google play', 'googleplay', 'google services', 'google cloud', 'google workspace', 'google drive',
        'google storage', 'google one', 'google ads', 'youtube', 'youtube premium', 'youtube music',
        'netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'disney plus', 'disney+', 'max', 'hbo', 'paramount',
        'crunchyroll', 'apple tv', 'apple music', 'apple com bill', 'apple.com/bill', 'deezer', 'tidal',
        'chatgpt', 'openai', 'anthropic', 'claude', 'midjourney', 'icloud', 'globo play', 'globoplay', 'telecine',
        'dropbox', 'onedrive', 'microsoft 365', 'office 365', 'adobe', 'creative cloud', 'canva', 'notion', 'figma',
        'github', 'cursor ai', 'linkedin premium', 'duolingo', 'uol', 'globo.com'
      ],
    },

    // 7. Lazer (Estilo de Vida) - Cinema, shows, viagens, jogos e entretenimento digital unificado
    {
      categoryId: 'cat-lazer',
      categoryMatch: 'lazer',
      fallbackMatch: 'entretenimento',
      keywords: [
        'cinema', 'cinemark', 'uci', 'cinepolis', 'kinoplex', 'ingresso', 'ingresso com', 'ticketmaster', 'ticket360', 'eventim',
        'sympla', 'livepass', 'show', 'teatro', 'parque', 'circo', 'museu', 'aquario', 'zoologico',
        'livraria', 'livraria da vila', 'livraria leitura', 'saraiva',
        'viagem', 'hospedagem', 'hotel', 'pousada', 'resort', 'airbnb', 'decolar', 'booking', 'hurb', 'cvc',
        'latam', 'gol linhas aereas', 'azul linhas aereas', 'passagem aerea', 'clickbus', 'buser',
        'steam', 'valve', 'playstation', 'playstation store', 'psn', 'ps plus', 'ps+', 'play 5', 'ps5', 'xbox', 'xbox live',
        'gamepass', 'game pass', 'nintendo', 'nintendo eshop', 'epic games', 'blizzard', 'battle net', 'riot games',
        'valorant', 'league of legends', 'ea games', 'ubisoft', 'roblox', 'minecraft', 'games', 'game'
      ],
    },

    // 8. Contas Residenciais (Essenciais) - Concessionárias de Luz, Água, Gás e Telecom
    {
      categoryId: 'cat-contas',
      categoryMatch: 'contas',
      fallbackMatch: 'moradia',
      keywords: [
        'luz', 'enel', 'cpfl', 'cemig', 'copel', 'light', 'energisa', 'elektro', 'neoenergia', 'equatorial', 'eletricidade', 'energia',
        'agua', 'sabesp', 'copasa', 'sanepar', 'cedae', 'caesb', 'embasa', 'compesa', 'corsan', 'cagece', 'saneamento',
        'gas', 'comgas', 'ultragaz', 'liquigas', 'supergasbras', 'nacional gas',
        'internet', 'fibra', 'nio fibra', 'vivo', 'claro', 'tim', 'oi', 'algar telecom', 'brisanet', 'desktop internet', 'giga+',
        'banda larga', 'recarga celular'
      ],
    },

    // 9. Moradia (Essenciais) - Aluguel, condomínio, IPTU, reforma e materiais de manutenção
    {
      categoryId: 'cat-moradia',
      categoryMatch: 'moradia',
      fallbackMatch: 'manutenção',
      keywords: [
        'aluguel', 'condominio', 'iptu', 'quinto andar', 'quintoandar', 'loft', 'imobiliaria', 'zap imoveis', 'viva real',
        'taxa de lixo', 'seguro residencial', 'caixa habitacao',
        'obramax', 'leroy', 'leroy merlin', 'telhanorte', 'c&c', 'cec', 'sodimac', 'tumelero', 'tok&stok', 'tok stok', 'etna',
        'camicado', 'mobly', 'westwing', 'material de construcao', 'construcao', 'reforma', 'tintas', 'suvinil', 'coral tintas',
        'eletricista', 'encanador', 'marceneiro', 'marcenaria', 'chaveiro', 'vidracaria', 'serralheria', 'madeira', 'eletrica', 'hidraulica'
      ],
    },

    // 10. Pets (Estilo de Vida)
    {
      categoryId: 'cat-pets',
      categoryMatch: 'pets',
      fallbackMatch: 'outras despesas',
      keywords: [
        'pet', 'pets', 'pet shop', 'petz', 'cobasi', 'petlove', 'veterinario', 'veterinaria', 'hospital veterinario', 'clinica veterinaria',
        'agropecuaria', 'pet house', 'banho e tosa', 'racao'
      ],
    },

    // 11. Cuidados & Beleza (Estilo de Vida)
    {
      categoryId: 'cat-cuidados',
      categoryMatch: 'cuidados',
      fallbackMatch: 'compras',
      keywords: [
        'salao', 'salao de beleza', 'barbearia', 'barbeiro', 'cabeleireiro', 'manicure', 'pedicure', 'esmalteria', 'depilacao',
        'estetica', 'massagem', 'spa', 'sobrancelhas', 'boticario', 'o boticario', 'natura', 'sephora', 'quem disse berenice',
        'beleza na web', 'epoca cosmeticos', 'eudora', 'perfumaria', 'cosmeticos'
      ],
    },

    // 12. Dívidas & Financiamentos (Essenciais)
    {
      categoryId: 'cat-dividas',
      categoryMatch: 'dívidas',
      fallbackMatch: 'outras despesas',
      keywords: [
        'consignado', 'emprestimo', 'financiamento', 'renegociacao', 'acordo', 'serasa', 'spc', 'divida', 'parcelamento fatura',
        'juros cartao', 'recuperacao de credito'
      ],
    },

    // 13. Educação (Essenciais)
    {
      categoryId: 'cat-educ',
      categoryMatch: 'educação',
      keywords: [
        'escola', 'colegio', 'faculdade', 'universidade', 'curso', 'udemy', 'coursera', 'alura', 'rocketseat', 'ebac',
        'idiomas', 'ingles', 'escola de ingles', 'wizard', 'cna', 'ccaa', 'cultura inglesa', 'kumon', 'pos graduacao', 'mba', 'mensalidade escolar'
      ],
    },

    // 14. Compras & Vestuário (Estilo de Vida)
    {
      categoryId: 'cat-compras',
      categoryMatch: 'compras',
      keywords: [
        'amazon', 'mercado livre', 'mercadolivre', 'mercado pago', 'mercadopago', 'melimais', 'meli', 'shopee', 'shoppe', 'shein',
        'aliexpress', 'temu', 'magalu', 'magazine luiza', 'casas bahia', 'ponto frio', 'americanas', 'submarino',
        'zara', 'renner', 'riachuelo', 'c&a', 'cea', 'marisa', 'hering', 'shoulder', 'farm rio', 'animale', 'arezzo', 'anacapri',
        'schutz', 'melissa', 'havaianas', 'centauro', 'netshoes', 'nike', 'adidas', 'puma', 'asics', 'olympikus', 'decathlon',
        'loja', 'vestuario', 'roupas', 'calcados', 'moda', 'oticas carol', 'chilli beans',
        'fast shop', 'kabum', 'pichau', 'terabyte', 'dell'
      ],
    },

    // 15. Presentes & Doações (Estilo de Vida)
    {
      categoryId: 'cat-presentes',
      categoryMatch: 'presentes',
      fallbackMatch: 'outras despesas',
      keywords: [
        'presente', 'presentes', 'aniversario', 'casamento', 'flores', 'floricultura', 'giuliana flores',
        'doacao', 'crianca esperanca', 'teleton', 'aacd', 'graacc', 'ong', 'igreja', 'dizimo'
      ],
    },

    // 16. Investimentos & Reserva (Futuro)
    {
      categoryId: 'cat-invest-futuro',
      categoryMatch: 'investimentos',
      fallbackMatch: 'reserva',
      keywords: [
        'investimento', 'investimentos', 'aporte', 'caixinha', 'cofrinho', 'poupanca', 'reserva de emergencia',
        'tesouro direto', 'cdb', 'lci', 'lca', 'acoes', 'fii', 'fiis', 'rico', 'clear', 'xp investimentos', 'nu invest', 'nuinvest', 'inter invest', 'btg pactual'
      ],
    },

    // 17. Salário & Renda (Income)
    {
      categoryId: 'cat-salario',
      categoryMatch: 'salário',
      keywords: [
        'salario', 'empresa', 'pagamento', 'folha', 'pro labore', 'pro-labore', 'remuneracao', 'ted recebida', 'holerite',
        'ordenado', 'rendimento salarial', 'adiantamento salarial', '13 salario', 'ferias'
      ],
    },

    // 18. Freelas & Renda Extra (Income)
    {
      categoryId: 'cat-freelas',
      categoryMatch: 'freelas',
      keywords: [
        'freela', 'freelance', 'freelancer', 'bico', 'renda extra', 'consultoria', 'honorarios',
        'upwork', 'fiverr', 'workana', 'hotmart', 'eduzz', 'kiwify'
      ],
    },

    // 19. Rendimentos (Income)
    {
      categoryId: 'cat-invest',
      categoryMatch: 'rendimentos',
      keywords: [
        'rendimento', 'dividendos', 'proventos', 'juros sobre capital', 'jcp', 'cdi', 'lucro', 'resgate', 'renda fixa', 'tesouro direto'
      ],
    },

    // 20. Outras Receitas (Income)
    {
      categoryId: 'cat-outras-rec',
      categoryMatch: 'outras receitas',
      keywords: [
        'reembolso', 'devolucao', 'cashback', 'premio', 'sorteio', 'estorno recebido'
      ],
    },
  ];

  /**
   * Normaliza o nome do estabelecimento para comparação insensível a acentos, maiúsculas e símbolos
   */
  normalize(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[*#.,\-_/\\()&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Remove sufixos jurídicos e societários comuns (LTDA, ME, EPP, S/A, EIRELI)
   */
  stripCorporateSuffixes(text: string): string {
    if (!text) return '';
    return text
      .replace(/\b(ltda|eireli|epp|me|s\s*a|cia)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Verifica se o estabelecimento bate com o padrão da regra de forma segura:
   * 1. Correspondência exata (com ou sem sufixo empresarial como LTDA)
   * 2. Ou presença como palavra/frase delimitada
   * 3. Termos compostos substanciais prefixados (>= 2 palavras e >= 8 caracteres)
   * NUNCA permite que um padrão mais longo capture uma busca curta genérica (ex: regra "google play ifood" capturar "google")
   */
  matchesRulePattern(merchant: string, pattern: string): boolean {
    if (merchant === pattern) return true;

    const cleanMerchant = this.stripCorporateSuffixes(merchant);
    const cleanPattern = this.stripCorporateSuffixes(pattern);
    if (cleanMerchant && cleanPattern && cleanMerchant === cleanPattern) return true;

    // Se o merchant contém o padrão completo (ex: merchant "uber trip sao paulo", pattern "uber")
    if (cleanMerchant.length >= cleanPattern.length) {
      if ((cleanPattern === '99' || cleanPattern === 'uber') && (cleanMerchant.includes('food') || cleanMerchant.includes('eats'))) {
        return false;
      }
      if (cleanPattern === '99' && /(\d+[,.]99|\br\$\s*[\d.,]+)/i.test(merchant)) {
        return false;
      }
      const escaped = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
      if (regex.test(cleanMerchant)) return true;
    }

    // Se o padrão começa com o merchant como palavra inteira (ex: pattern "ifood restaurante", merchant "ifood")
    if (cleanPattern.length > cleanMerchant.length && cleanMerchant.length >= 3) {
      const escaped = cleanMerchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const startsWithMerchantWord = new RegExp(`^${escaped}(?:\\s|$)`, 'i').test(cleanPattern);

      if (startsWithMerchantWord) {
        // Exceção de segurança: se o padrão contém termos de comida/delivery específicos (ifood, eats, food)
        // que o merchant não possui (ex: pattern "google play ifood", merchant "google"), NÃO deve casar
        const specificFoodTerms = ['ifood', 'eats', '99food'];
        const patternHasSpecificFood = specificFoodTerms.some(t => cleanPattern.includes(t));
        const merchantHasSpecificFood = specificFoodTerms.some(t => cleanMerchant.includes(t));
        if (patternHasSpecificFood && !merchantHasSpecificFood) {
          return false;
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Sanitiza e auto-cura regras aprendidas do usuário para eliminar contaminações
   * e falsos positivos conhecidos (ex: "google" caindo em alimentação, "99" caindo em transporte genérico)
   */
  sanitizeUserRules(rules: CategoryRule[], categories: Category[]): CategoryRule[] {
    if (!rules || rules.length === 0) return [];

    const streamingCat = categories.find(c => c.id === 'cat-streaming' || this.normalize(c.name).includes('streaming'));
    const transpCat = categories.find(c => c.id === 'cat-transp' || this.normalize(c.name).includes('transporte'));
    const lazerCat = categories.find(c => c.id === 'cat-lazer' || this.normalize(c.name).includes('lazer'));
    const moradiaCat = categories.find(c => c.id === 'cat-moradia' || this.normalize(c.name).includes('moradia'));
    const investCat = categories.find(c => c.id === 'cat-invest-futuro' || this.normalize(c.name).includes('investimento'));
    const mercadoCat = categories.find(c => c.id === 'cat-mercado' || this.normalize(c.name).includes('supermercado'));
    const restCat = categories.find(c => c.id === 'cat-restaurantes' || this.normalize(c.name).includes('restaurante'));

    return rules.filter(rule => {
      if (!rule || !rule.merchantPattern) return false;
      const normPattern = this.normalize(rule.merchantPattern);
      if (normPattern.length < 2) return false;

      // 1. Caso Google caindo em Alimentação / Mercado (contaminação comum do default inicial da tela)
      const isGooglePattern = normPattern === 'google' || normPattern.startsWith('google ') || normPattern.startsWith('googleplay');
      const hasFoodWords = ['ifood', 'lanche', 'burger', 'restaurante', 'pizza', 'comida', 'sushi'].some(w => normPattern.includes(w));
      
      const targetCat = categories.find(c => c.id === rule.categoryId);
      const isTargetFood = rule.categoryId === 'cat-alim' || Boolean(targetCat && (
        targetCat.id === 'cat-alim' || 
        targetCat.id === 'cat-mercado' || 
        targetCat.id === 'cat-restaurantes' ||
        this.normalize(targetCat.name).includes('alimentacao') || 
        this.normalize(targetCat.name).includes('supermercado') ||
        this.normalize(targetCat.name).includes('restaurante')
      ));

      if (isGooglePattern && !hasFoodWords && isTargetFood) {
        if (streamingCat) {
          rule.categoryId = streamingCat.id;
          return true;
        }
        return false;
      }

      // 2. Unificação e auto-cura de categorias legadas:
      // Mobilidade Urbana -> Transporte & Mobilidade
      if (rule.categoryId === 'cat-mobilidade' && transpCat) {
        rule.categoryId = transpCat.id;
        return true;
      }

      // Games & Hobbies -> Lazer
      if (rule.categoryId === 'cat-games' && lazerCat) {
        rule.categoryId = lazerCat.id;
        return true;
      }

      // Casa & Manutenção -> Moradia
      if (rule.categoryId === 'cat-manutencao' && moradiaCat) {
        rule.categoryId = moradiaCat.id;
        return true;
      }

      // Reserva de Emergência -> Investimentos & Reserva
      if (rule.categoryId === 'cat-reserva' && investCat) {
        rule.categoryId = investCat.id;
        return true;
      }

      // Alimentação Geral antiga -> Supermercado ou Restaurantes & Delivery
      if (rule.categoryId === 'cat-alim') {
        const isMarket = ['mercado', 'supermercado', 'feira', 'sacolao', 'acougue', 'padaria', 'hortifruti'].some(w => normPattern.includes(w));
        if (isMarket && mercadoCat) {
          rule.categoryId = mercadoCat.id;
        } else if (restCat) {
          rule.categoryId = restCat.id;
        } else if (mercadoCat) {
          rule.categoryId = mercadoCat.id;
        }
        return true;
      }

      return true;
    });
  }

  /**
   * Sugere a categoria mais adequada para um estabelecimento
   */
  suggestCategory(
    merchantName: string, 
    categories: Category[], 
    userRules: CategoryRule[] = []
  ): Category | undefined {
    if (!merchantName || categories.length === 0) return undefined;

    const normalizedMerchant = this.normalize(merchantName);
    if (!normalizedMerchant) return undefined;

    // 0. Auto-cura e sanitização de regras do usuário
    const sanitizedRules = this.sanitizeUserRules(userRules, categories);

    // 1. PRIORIDADE MÁXIMA: Regras aprendidas com correções do usuário
    // Ordenar por tamanho decrescente do padrão para dar preferência a termos mais específicos
    const sortedUserRules = [...sanitizedRules].sort(
      (a, b) => b.merchantPattern.length - a.merchantPattern.length
    );

    for (const rule of sortedUserRules) {
      const normalizedRulePattern = this.normalize(rule.merchantPattern);
      if (!normalizedRulePattern || normalizedRulePattern.length < 2) continue;

      if (this.matchesRulePattern(normalizedMerchant, normalizedRulePattern)) {
        const found = categories.find(c => c.id === rule.categoryId);
        if (found) return found;
      }
    }

    // 2. SEGUNDA PRIORIDADE: Mapeamento padrão heurístico enriquecido
    for (const rule of this.defaultRules) {
      const match = rule.keywords.some(keyword => {
        const normKeyword = this.normalize(keyword);
        if (!normKeyword) return false;

        // Exceção: "mercado livre" ou "mercado pago" não devem casar com o genérico "mercado" de supermercados
        if (normKeyword === 'mercado' && (normalizedMerchant.includes('mercado livre') || normalizedMerchant.includes('mercado pago') || normalizedMerchant.includes('mercadopago'))) {
          return false;
        }

        // Exceção: "99 food" e "uber eats" não devem casar com os genéricos "99" ou "uber" de transporte
        if (normKeyword === '99') {
          if (normalizedMerchant.includes('food') || normalizedMerchant.includes('99food')) {
            return false;
          }
          // Se "99" veio de centavos ou valor monetário (ex: 6,99, 19,99, R$ 6,99), NUNCA deve casar com transporte
          if (/(\d+[,.]99|\br\$\s*[\d.,]+)/i.test(merchantName)) {
            return false;
          }
        }
        if (normKeyword === 'uber' && (normalizedMerchant.includes('eats') || normalizedMerchant.includes('ubereats'))) {
          return false;
        }

        // Exceção: "obramax" não deve casar com o streaming "max"
        if (normKeyword === 'max' && normalizedMerchant.includes('obramax')) {
          return false;
        }

        // Se a palavra-chave for curta (<= 3 letras ou puramente numérica), exigir palavra isolada
        if (normKeyword.length <= 3 || /^\d+$/.test(normKeyword)) {
          const words = normalizedMerchant.split(' ');
          return words.includes(normKeyword);
        }

        // Para palavras de 4 letras comuns (ex: 'uber', 'loja', 'auto', 'vivo', 'tim', 'bobs'),
        // exigir delimitação por palavras para evitar falsos positivos
        if (normKeyword.length === 4) {
          const escaped = normKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i').test(normalizedMerchant);
        }

        return normalizedMerchant.includes(normKeyword);
      });

      if (match) {
        // 1º Tentar correspondência direta por ID pré-definido se existir na lista de categorias
        if (rule.categoryId) {
          const directMatch = categories.find(c => c.id === rule.categoryId);
          if (directMatch) return directMatch;
        }

        // 2º Tentar correspondência por nome da categoria
        let found = categories.find(c => {
          const normCat = this.normalize(c.name);
          const normMatch = this.normalize(rule.categoryMatch);
          return normCat.includes(normMatch) || normMatch.includes(normCat);
        });

        // 3º Fallback por nome
        if (!found && rule.fallbackMatch) {
          found = categories.find(c => {
            const normCat = this.normalize(c.name);
            const normFallback = this.normalize(rule.fallbackMatch!);
            return normCat.includes(normFallback) || normFallback.includes(normCat);
          });
        }

        if (found) return found;
      }
    }

    return undefined;
  }

  /**
   * Cria uma regra aprendida a partir da escolha do usuário
   */
  createRule(merchantName: string, categoryId: string): CategoryRule {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      merchantPattern: this.normalize(merchantName),
      categoryId,
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const categorizationEngine = new CategorizationEngine();
