/**
 * Sobra - Utilitário de Extração e Normalização de Data/Hora de Notificações
 * 
 * Garante que transações e notificações bancárias recebam a data e hora REAL
 * da ocorrência da compra (via postTime do Android e/ou menção explícita no texto),
 * e NÃO o momento posterior em que o aplicativo foi aberto pelo usuário.
 */

/**
 * Tenta extrair data e hora explícitas contidas no texto ou título da notificação.
 * Suporta formatos brasileiros comuns:
 * - "23/10 às 14:35" ou "23/10 as 14:35"
 * - "23/10/2026 às 14:35" ou "23/10/26 14:35"
 * - "em 23/10 14:35"
 * - "no dia 23/10 às 14:35"
 * - "23/10" (apenas data)
 */
export function extractDateFromNotificationText(
  title: string,
  text: string,
  referenceDate: Date = new Date()
): Date | null {
  const combined = `${title || ''} ${text || ''}`;
  if (!combined.trim()) return null;

  // 1. Data completa com hora: ex "23/10/2026 às 14:35", "23/10 às 15:30", "em 05/11 08:20"
  const dateTimeRegex = /(?:em|no dia|data:?|\b)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:às|as|,|-)?\s*(\d{1,2})[h:](\d{2}))/i;
  const matchWithTime = combined.match(dateTimeRegex);

  if (matchWithTime) {
    const day = parseInt(matchWithTime[1], 10);
    const month = parseInt(matchWithTime[2], 10);
    let year = matchWithTime[3] ? parseInt(matchWithTime[3], 10) : referenceDate.getFullYear();
    if (year < 100) year += 2000;

    const hour = parseInt(matchWithTime[4], 10);
    const minute = parseInt(matchWithTime[5], 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      // Ajuste de virada de ano: se a notificação foi capturada em janeiro e cita dezembro
      if (!matchWithTime[3] && month === 12 && referenceDate.getMonth() === 0) {
        year = referenceDate.getFullYear() - 1;
      }
      const candidate = new Date(year, month - 1, day, hour, minute, referenceDate.getSeconds(), 0);
      if (!isNaN(candidate.getTime())) {
        return candidate;
      }
    }
  }

  // 2. Data sem hora explícita: ex "compra realizada em 23/10/2026", "em 23/10"
  const dateOnlyRegex = /(?:em|no dia|data:?)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i;
  const matchDateOnly = combined.match(dateOnlyRegex);

  if (matchDateOnly) {
    const day = parseInt(matchDateOnly[1], 10);
    const month = parseInt(matchDateOnly[2], 10);
    let year = matchDateOnly[3] ? parseInt(matchDateOnly[3], 10) : referenceDate.getFullYear();
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      if (!matchDateOnly[3] && month === 12 && referenceDate.getMonth() === 0) {
        year = referenceDate.getFullYear() - 1;
      }
      // Preserva a hora/minuto da referenceDate (que pode ser o postTime do Android)
      const candidate = new Date(
        year,
        month - 1,
        day,
        referenceDate.getHours(),
        referenceDate.getMinutes(),
        referenceDate.getSeconds(),
        0
      );
      if (!isNaN(candidate.getTime())) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Determina o timestamp ISO definitivo de uma notificação bancária:
 * Prioridade:
 * 1. Data e hora explícitas no texto da notificação (se presente e coerente)
 * 2. postTime do Android StatusBarNotification (momento em que o banco disparou o alerta no celular)
 * 3. Fallback: Data e hora do momento atual (new Date().toISOString())
 */
export function resolveNotificationTimestamp(
  title: string,
  text: string,
  postTime?: number
): string {
  // 1. Se postTime é válido, usamos ele como referência temporal precisa
  if (postTime && typeof postTime === 'number' && !isNaN(postTime) && postTime > 0) {
    const postDate = new Date(postTime);
    if (!isNaN(postDate.getTime())) {
      // Se o texto cita expressamente outra data específica, respeita o texto com hora do postTime
      const explicitDate = extractDateFromNotificationText(title, text, postDate);
      if (explicitDate) {
        return explicitDate.toISOString();
      }
      return postDate.toISOString();
    }
  }

  // 2. Tenta extrair data do texto usando a data atual como referência de ano/hora
  const now = new Date();
  const explicit = extractDateFromNotificationText(title, text, now);
  if (explicit) {
    return explicit.toISOString();
  }

  // 3. Fallback
  return now.toISOString();
}
