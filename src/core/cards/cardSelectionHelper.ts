import { Account, Transaction, PartnershipSpace } from '../types';
import { isInvoicePayment } from '../calculations';
import { getLocalPartnershipSpace } from '../../services/partnershipService';

/**
 * Extrai os 4 dígitos finais do cartão de crédito ou conta bancária.
 * Prioriza a propriedade `lastDigits`. Se não existir, tenta extrair do nome.
 */
export function extractCardLastDigits(account?: Account | null): string {
  if (!account) return '';
  if (account.lastDigits && account.lastDigits.trim()) {
    const cleaned = account.lastDigits.replace(/\D/g, '');
    if (cleaned.length >= 4) {
      return cleaned.slice(-4);
    }
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  if (!account.name) return '';
  const match = account.name.match(/(?:final|••••|\*+|\()?\s*(\d{4})\)?/i);
  return match ? match[1] : '';
}

/**
 * Remove sufixos redundantes de dígitos ou finais do nome do cartão.
 * Exemplo: "Banco Inter (Final 5023)" -> "Banco Inter", "Nubank (5023)" -> "Nubank"
 */
export function getCleanCardName(rawName?: string | null): string {
  if (!rawName) return '';
  return rawName
    .replace(/\s*\(Final\s*[^)]+\)/i, '')
    .replace(/\s*\(final\s*[^)]+\)/i, '')
    .replace(/\s*•+\s*\d{4}/i, '')
    .replace(/\s*\(?\b\d{4}\)?$/i, '')
    .trim();
}

/**
 * Retorna o título de exibição formatado do cartão/conta.
 * Exemplo: se o nome é "Nubank" e os dígitos são "5023", exibe "Nubank •••• 5023".
 * Se o nome já contiver os dígitos (ex: "Nubank (Final 5023)"), não duplica.
 */
export function getCardDisplayTitle(account: Account): string {
  const digits = extractCardLastDigits(account);
  if (!digits) return account.name;
  
  const nameAlreadyHasDigits = account.name.includes(digits);
  if (nameAlreadyHasDigits) {
    return account.name;
  }
  return `${account.name} •••• ${digits}`;
}

/**
 * Retorna o subtítulo contextual da conta ou cartão.
 * Exemplo: "Cartão de Crédito • Final 5023" ou "Conta Corrente • Final 1234"
 */
export function getCardDisplaySubtitle(account: Account, baseTypeLabel: string): string {
  const digits = extractCardLastDigits(account);
  if (account.type === 'credit_card') {
    return digits ? `Cartão de Crédito • Final ${digits}` : 'Cartão de Crédito';
  }
  return digits ? `${baseTypeLabel} • Final ${digits}` : baseTypeLabel;
}

/**
 * Algoritmo inteligente que analisa o histórico recente de compras e determina
 * o cartão de crédito mais utilizado nos últimos dias.
 * 
 * Critérios:
 * 1. Frequência ponderada por recência:
 *    - Últimos 3 dias: 5 pts
 *    - Últimos 7 dias: 3 pts
 *    - Últimos 15 dias: 2 pts
 *    - Últimos 30 dias: 1 pt
 *    - Até 60 dias: 0.2 pt
 * 2. Desempate por timestamp da transação mais recente
 * 3. Fallback para a ordem padrão dos cartões
 */
export function getSmartDefaultCreditCard(
  accounts: Account[],
  transactions: Transaction[],
  referenceDate: Date = new Date()
): Account | undefined {
  const creditCards = accounts.filter(a => a.type === 'credit_card');
  if (creditCards.length === 0) return undefined;
  if (creditCards.length === 1) return creditCards[0];

  const creditCardIds = new Set(creditCards.map(c => c.id));
  const refTime = referenceDate.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const cardStats: Record<string, { score: number; lastUsedTime: number; count: number }> = {};
  for (const c of creditCards) {
    cardStats[c.id] = { score: 0, lastUsedTime: 0, count: 0 };
  }

  for (const tx of transactions) {
    // Apenas despesas com cartão ou lançadas na conta do cartão
    if (tx.type !== 'expense') continue;
    if (tx.status === 'pending_review') continue;

    const accId = tx.accountId;
    if (!accId || !creditCardIds.has(accId)) continue;

    // Ignora pagamentos de fatura
    if (isInvoicePayment(tx)) continue;
    const descLower = (tx.description || '').toLowerCase();
    if (descLower.includes('pagamento de fatura') || descLower.includes('pagamento fatura')) continue;

    const txTime = new Date(tx.date).getTime();
    if (isNaN(txTime)) continue;

    const diffDays = Math.max(0, (refTime - txTime) / ONE_DAY_MS);

    if (txTime > cardStats[accId].lastUsedTime) {
      cardStats[accId].lastUsedTime = txTime;
    }

    if (diffDays <= 3) {
      cardStats[accId].score += 5;
      cardStats[accId].count += 1;
    } else if (diffDays <= 7) {
      cardStats[accId].score += 3;
      cardStats[accId].count += 1;
    } else if (diffDays <= 15) {
      cardStats[accId].score += 2;
      cardStats[accId].count += 1;
    } else if (diffDays <= 30) {
      cardStats[accId].score += 1;
      cardStats[accId].count += 1;
    } else if (diffDays <= 60) {
      cardStats[accId].score += 0.2;
    }
  }

  const sortedCards = [...creditCards].sort((a, b) => {
    const statsA = cardStats[a.id];
    const statsB = cardStats[b.id];

    if (statsB.score !== statsA.score) {
      return statsB.score - statsA.score;
    }
    if (statsB.lastUsedTime !== statsA.lastUsedTime) {
      return statsB.lastUsedTime - statsA.lastUsedTime;
    }
    return 0;
  });

  return sortedCards[0];
}

/**
 * Retorna a conta/cartão padrão mais adequado para um novo lançamento de despesa,
 * respeitando em prioridade:
 * 1. `defaultAccountId` explícito
 * 2. `activeViewedCardId` (cartão atualmente aberto na tela/fatura do usuário)
 * 3. Detecção inteligente do cartão mais usado recentemente
 * 4. Fallback padrão
 */
export function getSmartDefaultAccountForExpense(
  accounts: Account[],
  transactions: Transaction[],
  options?: {
    defaultAccountId?: string;
    activeViewedCardId?: string | null;
    referenceDate?: Date;
  }
): Account | undefined {
  if (options?.defaultAccountId) {
    const explicit = accounts.find(a => a.id === options.defaultAccountId);
    if (explicit) return explicit;
  }

  if (options?.activeViewedCardId) {
    const viewed = accounts.find(a => a.id === options.activeViewedCardId);
    if (viewed) return viewed;
  }

  const smartCard = getSmartDefaultCreditCard(accounts, transactions, options?.referenceDate);
  if (smartCard) return smartCard;

  return (
    accounts.find(a => a.id === 'acc-conta-principal' || a.name === 'Conta Principal') ||
    accounts.find(a => a.type === 'checking') ||
    accounts.find(a => a.type !== 'credit_card') ||
    accounts[0]
  );
}

/**
 * Retorna todos os dígitos finais de cartões vinculados a esta conta/fatura
 * (incluindo cartão do titular e cartões adicionais do parceiro/dependentes).
 */
export function getAccountAllLastDigits(account?: Account | null): string[] {
  if (!account) return [];
  const digitsSet = new Set<string>();

  const primary = extractCardLastDigits(account);
  if (primary) digitsSet.add(primary);

  if (account.additionalCardLastDigits && account.additionalCardLastDigits.trim()) {
    const cleaned = account.additionalCardLastDigits.replace(/\D/g, '').slice(-4);
    if (cleaned.length === 4) digitsSet.add(cleaned);
  }

  if (account.additionalCards && Array.isArray(account.additionalCards)) {
    for (const card of account.additionalCards) {
      if (card.lastDigits && card.lastDigits.trim()) {
        const cleaned = card.lastDigits.replace(/\D/g, '').slice(-4);
        if (cleaned.length === 4) digitsSet.add(cleaned);
      }
    }
  }

  return Array.from(digitsSet);
}

/**
 * Verifica se os 4 dígitos informados (capturados em uma notificação ou transação)
 * correspondem a este cartão de crédito (seja o cartão titular ou um cartão adicional vinculado).
 */
export function accountMatchesCardDigits(account?: Account | null, digits?: string | null): boolean {
  if (!account || !digits || !digits.trim()) return false;
  const target = digits.replace(/\D/g, '').slice(-4);
  if (!target) return false;

  const allDigits = getAccountAllLastDigits(account);
  return allDigits.includes(target);
}

/**
 * Retorna o rótulo do portador para um determinado final de cartão (ex: "Titular", "Adicional" ou nome do portador).
 */
export function getCardHolderLabelForDigits(account?: Account | null, digits?: string | null): string | undefined {
  if (!account || !digits || !digits.trim()) return undefined;
  const target = digits.replace(/\D/g, '').slice(-4);
  if (!target) return undefined;

  const primary = extractCardLastDigits(account);
  if (primary === target) {
    return 'Titular';
  }

  if (account.additionalCardLastDigits) {
    const cleaned = account.additionalCardLastDigits.replace(/\D/g, '').slice(-4);
    if (cleaned === target) {
      return account.additionalCardHolderName?.trim() || 'Adicional';
    }
  }

  if (account.additionalCards) {
    for (const card of account.additionalCards) {
      const cleaned = (card.lastDigits || '').replace(/\D/g, '').slice(-4);
      if (cleaned === target) {
        return card.holderName?.trim() || 'Adicional';
      }
    }
  }

  return undefined;
}

export interface AuthorBadgeData {
  type: 'author' | 'joint' | 'bank';
  name?: string;
  avatarUrl?: string;
  initial?: string;
  isJoint?: boolean;
  badgeBg?: string;
}

/**
 * Resolve o badge de autoria (foto, inicial ou ícone de casal) para transações em contas/cartões compartilhados.
 * 
 * Regras:
 * 1. Se a conta e a transação não forem compartilhadas, retorna { type: 'bank' } para exibir a logo do banco.
 * 2. Se a conta for de cartão de crédito compartilhado:
 *    - Se o usuário NÃO inseriu o final do cartão adicional no cadastro do cartão:
 *      Retorna { type: 'joint', isJoint: true } (não há como diferenciar quem comprou).
 *    - Se os 4 dígitos da transação baterem com o final do adicional:
 *      Retorna { type: 'author', name, avatarUrl: partnerAvatarUrl, initial, badgeBg: '#0284C7' }.
 *    - Se os 4 dígitos baterem com o final do titular (e o adicional estiver cadastrado):
 *      Retorna { type: 'author', name, avatarUrl: currentUserAvatarUrl, initial, badgeBg: '#059669' }.
 * 3. Fallback para `createdByName` da transação:
 *    - Se bate com o parceiro -> foto ou inicial do parceiro.
 *    - Se bate com o usuário titular -> foto ou inicial do titular.
 *    - Outro nome -> inicial desse nome.
 * 4. Fallback final -> { type: 'joint', isJoint: true } (ícone 👥 de casal).
 */
export function resolveTransactionAuthorBadge(params: {
  tx: Transaction;
  account?: Account | null;
  accounts?: Account[];
  currentUser?: { id?: string; displayName?: string; avatarUrl?: string } | null;
  partnershipSpace?: PartnershipSpace | null;
}): AuthorBadgeData {
  const { tx, currentUser } = params;

  // Se account não foi passado diretamente, tenta localizar pelo accounts global
  const account = params.account || (params.accounts && tx.accountId ? params.accounts.find(a => a.id === tx.accountId) : null) || null;

  // Se o partnershipSpace não foi passado ou não possui fotos, tenta o espaço local enriquecido com contas
  const space = params.partnershipSpace || getLocalPartnershipSpace(params.accounts || (account ? [account] : undefined));

  const isShared = account ? Boolean(tx.isShared || account.isShared) : Boolean(tx.isShared || space?.isActive);
  if (!isShared) {
    return { type: 'bank' };
  }

  const isOwner = !space?.ownerId || (currentUser?.id && space.ownerId === currentUser.id);

  const normalize = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  // Membros compartilhados da conta
  const sharedMembers = account?.sharedMembers || [];

  const isOwnerMember = (m: { userId?: string; displayName?: string; role?: string }) => {
    if (currentUser?.id && m.userId === currentUser.id) return true;
    if (space?.ownerId && m.userId === space.ownerId) return true;
    if (m.role === 'owner') return true;
    if (currentUser?.displayName && normalize(m.displayName) === normalize(currentUser.displayName)) return true;
    if (space?.ownerName && normalize(m.displayName) === normalize(space.ownerName)) return true;
    return false;
  };

  const partnerMember = sharedMembers.find(m => isOwner ? !isOwnerMember(m) : isOwnerMember(m));
  const ownerMember = sharedMembers.find(m => isOwner ? isOwnerMember(m) : !isOwnerMember(m));

  const partnerName = isOwner 
    ? (space?.partnerName || account?.additionalCardHolderName || partnerMember?.displayName) 
    : (space?.ownerName || account?.ownerName || ownerMember?.displayName);

  // Procura avatar do parceiro primeiro no space, depois em sharedMembers onde não seja o titular
  const partnerMemberWithAvatar = sharedMembers.find(m => (isOwner ? !isOwnerMember(m) : isOwnerMember(m)) && m.avatarUrl);
  const ownerMemberWithAvatar = sharedMembers.find(m => (isOwner ? isOwnerMember(m) : !isOwnerMember(m)) && m.avatarUrl);

  let partnerAvatarUrl = isOwner 
    ? (space?.partnerAvatarUrl || partnerMemberWithAvatar?.avatarUrl || partnerMember?.avatarUrl) 
    : (space?.ownerAvatarUrl || ownerMemberWithAvatar?.avatarUrl || ownerMember?.avatarUrl);

  const currentUserName = currentUser?.displayName || 
    (isOwner 
      ? (space?.ownerName || account?.ownerName || ownerMember?.displayName) 
      : (space?.partnerName || account?.additionalCardHolderName || partnerMember?.displayName)) || 
    'Você';

  let currentUserAvatarUrl = currentUser?.avatarUrl || 
    (isOwner 
      ? (space?.ownerAvatarUrl || ownerMemberWithAvatar?.avatarUrl || ownerMember?.avatarUrl) 
      : (space?.partnerAvatarUrl || partnerMemberWithAvatar?.avatarUrl || partnerMember?.avatarUrl));

  // Fallback: se partnerAvatarUrl ainda não foi encontrada, busca em qualquer conta compartilhada
  if (!partnerAvatarUrl && params.accounts) {
    for (const acc of params.accounts) {
      if (!acc.isShared || !acc.sharedMembers) continue;
      const other = acc.sharedMembers.find(m => (!currentUser?.id || m.userId !== currentUser.id) && m.avatarUrl);
      if (other?.avatarUrl) {
        partnerAvatarUrl = other.avatarUrl;
        break;
      }
    }
  }

  // Sanitização de string não vazia
  const cleanPartnerAvatar = (partnerAvatarUrl && typeof partnerAvatarUrl === 'string' && partnerAvatarUrl.trim()) ? partnerAvatarUrl.trim() : undefined;
  const cleanUserAvatar = (currentUserAvatarUrl && typeof currentUserAvatarUrl === 'string' && currentUserAvatarUrl.trim()) ? currentUserAvatarUrl.trim() : undefined;

  const titularDigits = account ? extractCardLastDigits(account) : '';
  const additionalDigits = (account?.additionalCardLastDigits || account?.additionalCards?.[0]?.lastDigits || '').replace(/\D/g, '').slice(-4);

  const isCreditCard = account?.type === 'credit_card';
  const txDigits = tx.cardLastDigits || (tx.description?.match(/(?:final|••••|\*+|\()?\s*(\d{4})\)?/i)?.[1]);

  // 1. Verificação por dígitos do cartão (se informado)
  if (isCreditCard && account) {
    // REGRA EXPLÍCITA DO USUÁRIO: Se o usuário não inserir o final do cartão adicional, exibe o símbolo de conjunto mesmo
    if (!additionalDigits) {
      return { type: 'joint', isJoint: true };
    }

    if (txDigits) {
      const cleanTxDigits = txDigits.replace(/\D/g, '').slice(-4);

      if (additionalDigits && cleanTxDigits === additionalDigits) {
        const resolvedName = account.additionalCardHolderName?.trim() || partnerName?.trim() || 'Adicional';
        const initial = resolvedName.charAt(0).toUpperCase();
        return {
          type: 'author',
          name: resolvedName,
          avatarUrl: cleanPartnerAvatar,
          initial,
          badgeBg: '#0284C7',
        };
      }

      if (titularDigits && cleanTxDigits === titularDigits) {
        const resolvedName = account.ownerName?.trim() || currentUserName?.trim() || 'Titular';
        const initial = resolvedName.charAt(0).toUpperCase();
        return {
          type: 'author',
          name: resolvedName,
          avatarUrl: cleanUserAvatar,
          initial,
          badgeBg: '#059669',
        };
      }
    } else if (!additionalDigits && !titularDigits && !tx.createdByName && !tx.createdById) {
      return { type: 'joint', isJoint: true };
    }
  }

  // 2. Verificação por createdById gravado na transação
  if (tx.createdById) {
    if (currentUser?.id && tx.createdById === currentUser.id) {
      const firstName = currentUserName.split(' ')[0];
      return {
        type: 'author',
        name: firstName,
        avatarUrl: cleanUserAvatar,
        initial: firstName.charAt(0).toUpperCase(),
        badgeBg: '#059669',
      };
    }

    const partnerId = isOwner ? space?.partnerId : space?.ownerId;
    if (partnerId && tx.createdById === partnerId) {
      const resolvedName = partnerName || 'Parceiro';
      const firstName = resolvedName.split(' ')[0];
      return {
        type: 'author',
        name: firstName,
        avatarUrl: cleanPartnerAvatar,
        initial: firstName.charAt(0).toUpperCase(),
        badgeBg: '#0284C7',
      };
    }

    const memberById = sharedMembers.find(m => m.userId === tx.createdById);
    if (memberById) {
      const isMe = currentUser?.id && memberById.userId === currentUser.id;
      const firstName = (memberById.displayName || '').split(' ')[0] || (isMe ? 'Você' : 'Parceiro');
      return {
        type: 'author',
        name: firstName,
        avatarUrl: memberById.avatarUrl || (isMe ? cleanUserAvatar : cleanPartnerAvatar),
        initial: firstName.charAt(0).toUpperCase(),
        badgeBg: isMe ? '#059669' : '#0284C7',
      };
    }
  }

  // 3. Fallback para createdByName gravado na transação (com normalização de acentos)
  if (tx.createdByName && tx.createdByName.trim()) {
    const rawName = tx.createdByName.trim();
    const firstName = rawName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();
    const normRaw = normalize(rawName);
    const normPartner = normalize(partnerName);
    const normCurrent = normalize(currentUserName);

    const isPartner = Boolean(normPartner && (
      normRaw.includes(normPartner.split(' ')[0]) || 
      normPartner.includes(normRaw.split(' ')[0])
    ));

    const isCurrentUser = Boolean(normCurrent && (
      normRaw.includes(normCurrent.split(' ')[0]) || 
      normCurrent.includes(normRaw.split(' ')[0])
    ));

    if (isPartner) {
      return {
        type: 'author',
        name: firstName,
        avatarUrl: cleanPartnerAvatar,
        initial,
        badgeBg: '#0284C7',
      };
    }

    if (isCurrentUser) {
      return {
        type: 'author',
        name: firstName,
        avatarUrl: cleanUserAvatar,
        initial,
        badgeBg: '#059669',
      };
    }

    // Procura por membro correspondente em sharedMembers
    const memberByName = sharedMembers.find(m => {
      const normM = normalize(m.displayName);
      return normM.includes(normRaw.split(' ')[0]) || normRaw.includes(normM.split(' ')[0]);
    });

    if (memberByName) {
      const isMe = currentUser?.id && memberByName.userId === currentUser.id;
      return {
        type: 'author',
        name: firstName,
        avatarUrl: memberByName.avatarUrl || (isMe ? cleanUserAvatar : cleanPartnerAvatar),
        initial,
        badgeBg: isMe ? '#059669' : '#0284C7',
      };
    }

    // Se o nome não é o usuário logado e temos avatar do parceiro disponível, é o parceiro
    if (!isCurrentUser && cleanPartnerAvatar) {
      return {
        type: 'author',
        name: firstName,
        avatarUrl: cleanPartnerAvatar,
        initial,
        badgeBg: '#0284C7',
      };
    }

    return {
      type: 'author',
      name: firstName,
      avatarUrl: cleanPartnerAvatar,
      initial,
      badgeBg: '#334155',
    };
  }

  // 4. Fallback final -> Casal / Conjunto (👥)
  return {
    type: 'joint',
    isJoint: true,
  };
}


