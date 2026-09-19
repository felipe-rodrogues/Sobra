import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Subscription, SubscriptionSentiment } from '../core/types';
import { SubscriptionLogo } from '../components/subscriptions/SubscriptionLogo';
import { SubscriptionDetailView } from '../components/subscriptions/SubscriptionDetailView';
import { SubscriptionTransactionPickerModal } from '../components/subscriptions/SubscriptionTransactionPickerModal';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { recurrenceDetector } from '../core/subscriptions/recurrenceDetector';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  List, 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  CalendarClock
} from 'lucide-react';

interface SubscriptionsScreenProps {
  onBack?: () => void;
  onOpenNewSubscription?: () => void;
  onEditSubscription?: (sub: Subscription) => void;
  initialViewMode?: 'list' | 'calendar';
}

export const SubscriptionsScreen: React.FC<SubscriptionsScreenProps> = ({
  onBack,
  onOpenNewSubscription,
  onEditSubscription,
  initialViewMode = 'list',
}) => {
  const { 
    subscriptions, 
    transactions, 
    categories, 
    accounts,
    saveSubscription,
    isPrivacyMode, 
    togglePrivacyMode 
  } = useFinance();
  const { colors } = useTheme();

  // Estados de Visualização e Modais
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialViewMode);
  const [calendarFreqMode, setCalendarFreqMode] = useState<'monthly' | 'daily'>('monthly');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Cálculos de Totais
  const activeSubs = useMemo(() => subscriptions.filter(s => s.status === 'active'), [subscriptions]);
  const totalMonthlyCost = useMemo(() => recurrenceDetector.calculateTotalMonthlyCost(subscriptions), [subscriptions]);
  const totalMonthlyIncome = useMemo(() => recurrenceDetector.calculateTotalMonthlyIncome(subscriptions), [subscriptions]);

  // Data atual do calendário navegável
  const calendarDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + calendarMonthOffset);
    return d;
  }, [calendarMonthOffset]);

  const calMonthIndex = calendarDate.getMonth();
  const calYear = calendarDate.getFullYear();
  const calMonthNameRaw = calendarDate.toLocaleDateString('pt-BR', { month: 'long' });
  const calMonthTitle = calMonthNameRaw.charAt(0).toUpperCase() + calMonthNameRaw.slice(1);

  // Checa status de pagamento de cada assinatura no mês do calendário
  const subStatusList = useMemo(() => {
    return subscriptions.map(sub => {
      const norm = (sub.name || '').toLowerCase().trim();
      const matchedTx = transactions.find(t => {
        if (sub.type === 'income') {
          if (t.type !== 'income') return false;
        } else {
          if (t.type !== 'expense') return false;
        }
        const d = new Date(t.date);
        if (d.getMonth() !== calMonthIndex || d.getFullYear() !== calYear) return false;
        const tDesc = (t.description || '').toLowerCase();
        return tDesc.includes(norm) || norm.includes(tDesc);
      });

      const isPaidThisMonth = !!matchedTx || (
        sub.lastChargeDate &&
        new Date(sub.lastChargeDate).getMonth() === calMonthIndex &&
        new Date(sub.lastChargeDate).getFullYear() === calYear
      );

      // Data de cobrança/vencimento
      const billingDateObj = sub.nextBillingDate
        ? new Date(sub.nextBillingDate)
        : sub.lastChargeDate
        ? new Date(sub.lastChargeDate)
        : new Date();

      const dueDay = billingDateObj.getDate();

      // Formatação da label: se pago ex: "6 Set • Pago" ou "6 Set • Recebido"
      let statusSubtitle = sub.type === 'income' ? `Recebe todo dia ${dueDay}` : `Pago todo dia ${dueDay}`;
      if (isPaidThisMonth) {
        const payDate = matchedTx ? new Date(matchedTx.date) : billingDateObj;
        const dayFormatted = payDate.getDate();
        const monthShort = payDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const capMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
        statusSubtitle = sub.type === 'income'
          ? `${dayFormatted} ${capMonth} • Recebido`
          : `${dayFormatted} ${capMonth} • Pago`;
      }

      return {
        subscription: sub,
        isPaidThisMonth,
        statusSubtitle,
        dueDay,
        category: categoryMap.get(sub.categoryId),
        account: sub.accountId ? accountMap.get(sub.accountId) : null,
      };
    });
  }, [subscriptions, transactions, calMonthIndex, calYear, categoryMap, accountMap]);

  // Agrupamento de assinaturas pelo dia do mês
  const subscriptionsByDay = useMemo(() => {
    const map = new Map<number, typeof subStatusList>();
    for (const item of subStatusList) {
      if (item.subscription.status !== 'active') continue;
      const day = item.dueDay;
      if (!map.has(day)) {
        map.set(day, []);
      }
      map.get(day)!.push(item);
    }
    return map;
  }, [subStatusList]);

  // Quantidade de dias no mês
  const daysInMonth = useMemo(() => {
    return new Date(calYear, calMonthIndex + 1, 0).getDate();
  }, [calYear, calMonthIndex]);

  // Primeiro dia da semana no mês: mapeado para 0=Seg, 1=Ter, ..., 6=Dom
  const firstDayWeekday = useMemo(() => {
    const standardDay = new Date(calYear, calMonthIndex, 1).getDay(); // 0=Dom, 1=Seg...
    return (standardDay + 6) % 7;
  }, [calYear, calMonthIndex]);

  // Se o usuário estiver vendo os detalhes de uma assinatura específica (Screenshot 2)
  if (selectedSubscription) {
    const currentSub = subscriptions.find(s => s.id === selectedSubscription.id) || selectedSubscription;
    return (
      <SwipeBackView onBack={() => setSelectedSubscription(null)}>
        <SubscriptionDetailView
          subscription={currentSub}
          onBack={() => setSelectedSubscription(null)}
          onEdit={(sub) => {
            if (onEditSubscription) {
              onEditSubscription(sub);
            }
          }}
        />
      </SwipeBackView>
    );
  }

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          paddingBottom: '36px',
          color: '#FFFFFF',
        }}
      >
      {/* 1. Barra de Navegação Superior (Compartilhada entre Lista e Calendário) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Botão Voltar Circular */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div style={{ width: '42px' }} />
        )}

        {/* Ferramentas da Direita: Olho + Alternador de Visualização (Lista / Calendário) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botão de Privacidade */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: isPrivacyMode ? '#A3E635' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          >
            {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          {/* Segmented Control Lista / Calendário */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '22px',
              padding: '3px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Visualização em Lista"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px',
                backgroundColor: viewMode === 'list' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? '#FFFFFF' : '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={18} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              title="Visualização em Calendário"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px',
                backgroundColor: viewMode === 'calendar' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                border: 'none',
                color: viewMode === 'calendar' ? '#FFFFFF' : '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <CalendarIcon size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Conteúdo Condicional: VISÃO EM LISTA vs VISÃO EM CALENDÁRIO */}
      {viewMode === 'list' ? (
        <>
          {/* Card Hero: Raio-X de Assinaturas (Consciência e Impacto Anual) */}
          <div
            style={{
              backgroundColor: '#121418',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Cabeçalho do Card */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarClock size={20} color="#FBBF24" />
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Raio-X de Assinaturas
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#94A3B8',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                }}
              >
                {subscriptions.filter(s => s.status === 'active' && s.type !== 'income').length} {subscriptions.filter(s => s.status === 'active' && s.type !== 'income').length === 1 ? 'ativa' : 'ativas'}
              </span>
            </div>

            {/* Valor Mensal em Grande Destaque Tipográfico */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '2px 0' }}>
              <span
                style={{
                  fontSize: '2.55rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                {maskValue(formatBrlCurrency(totalMonthlyCost))}
              </span>
              <span style={{ fontSize: '0.88rem', color: '#9CA3AF', fontWeight: 500 }}>/mês</span>
            </div>

            {/* Linha de Destaque: Pílula de Impacto Anual + Botão Adicionar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '9999px',
                  padding: '5px 12px',
                  color: '#FBBF24',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FBBF24' }} />
                <span>{maskValue(formatBrlCurrency(totalMonthlyCost * 12))} por ano</span>
              </div>

              <button
                type="button"
                onClick={() => setIsPickerModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: '#1E232B',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#282F3A';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1E232B';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Plus size={15} />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          {/* Barra de Contagem e Subtotal: "4 assinaturas" | "R$ 303,50 esse mês" */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              color: '#9CA3AF',
              fontWeight: 500,
              marginTop: '4px',
            }}
          >
            <div>
              {activeSubs.length} {activeSubs.length === 1 ? 'recorrência' : 'recorrências'}
            </div>
            <div>
              {maskValue(formatBrlCurrency(totalMonthlyCost))} em despesas
              {totalMonthlyIncome > 0 && ` • +${maskValue(formatBrlCurrency(totalMonthlyIncome))} em receitas`}
            </div>
          </div>

          {/* Lista de Assinaturas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {subStatusList.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  borderRadius: '20px',
                  backgroundColor: '#121418',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: '#6B7280',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <CalendarClock size={32} color="#9CA3AF" />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Nenhuma assinatura cadastrada
                </div>
                <p style={{ fontSize: '0.82rem', color: '#9CA3AF', maxWidth: '280px', margin: 0 }}>
                  Toque no botão acima para selecionar uma cobrança do seu cartão ou cadastrar manualmente.
                </p>
              </div>
            ) : (
              subStatusList.map(item => {
                const { subscription, isPaidThisMonth, statusSubtitle, category, account } = item;

                return (
                  <div
                    key={subscription.id}
                    onClick={() => setSelectedSubscription(subscription)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 6px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Lado Esquerdo: Logo com Badge Bancário */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                      <SubscriptionLogo
                        name={subscription.name}
                        category={category}
                        bankId={account?.bankId || account?.name}
                        size={44}
                      />

                      {/* Textos Centrais: Nome e Subtítulo de Status */}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subscription.name}
                        </div>

                        {/* Subtítulo: "6 Set • Pago" em verde limão ou "Pago todo dia X" em cinza */}
                        <div
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: isPaidThisMonth ? 600 : 500,
                            color: isPaidThisMonth ? '#A3E635' : '#9CA3AF',
                            marginTop: '2px',
                          }}
                        >
                          {statusSubtitle}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor da Assinatura + Etiqueta de Avaliação (Mockup) */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                      <span
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: subscription.type === 'income' ? '#10B981' : '#FFFFFF',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {subscription.type === 'income' ? '+ ' : ''}
                        {maskValue(formatBrlCurrency(subscription.amount))}
                      </span>

                      {subscription.type !== 'income' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = subscription.sentiment || 'keep';
                            const nextSentiment: SubscriptionSentiment =
                              current === 'keep' ? 'doubt' :
                              current === 'doubt' ? 'cancel' : 'keep';
                            saveSubscription({ ...subscription, sentiment: nextSentiment });
                          }}
                          style={{
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            border: '1px solid',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                            backgroundColor:
                              subscription.sentiment === 'cancel' ? 'rgba(244, 63, 94, 0.15)' :
                              subscription.sentiment === 'doubt' ? 'rgba(245, 158, 11, 0.15)' :
                              'rgba(74, 222, 128, 0.12)',
                            borderColor:
                              subscription.sentiment === 'cancel' ? 'rgba(244, 63, 94, 0.3)' :
                              subscription.sentiment === 'doubt' ? 'rgba(245, 158, 11, 0.3)' :
                              'rgba(74, 222, 128, 0.25)',
                            color:
                              subscription.sentiment === 'cancel' ? '#FB7185' :
                              subscription.sentiment === 'doubt' ? '#FBBF24' :
                              '#4ADE80',
                          }}
                          title="Toque para alternar avaliação (Uso sempre / Em dúvida / Quero cancelar)"
                        >
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                          <span>
                            {subscription.sentiment === 'cancel' ? 'Quero cancelar' :
                             subscription.sentiment === 'doubt' ? 'Em dúvida' :
                             'Uso sempre'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* VISÃO EM CALENDÁRIO FIEL AO NOVO PRINT DO USUÁRIO */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Título do Mês e Total Mensal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {calMonthTitle}
              </h1>

              {/* Controles de Navegação Entre Meses */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset(calendarMonthOffset - 1)}
                  aria-label="Mês anterior"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset(calendarMonthOffset + 1)}
                  aria-label="Próximo mês"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.92rem', color: '#9CA3AF' }}>
              Total mensal <strong style={{ color: '#FFFFFF', fontWeight: 800 }}>{maskValue(formatBrlCurrency(totalMonthlyCost))}</strong>
            </div>
          </div>

          {/* Segmented Control Frequência: [ Mensal | Diária ] Fiel ao Print */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              backgroundColor: '#1E1F24',
              borderRadius: '28px',
              padding: '4px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setCalendarFreqMode('monthly')}
              style={{
                padding: '10px 16px',
                borderRadius: '24px',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: calendarFreqMode === 'monthly' ? '#FFFFFF' : 'transparent',
                color: calendarFreqMode === 'monthly' ? '#000000' : '#9CA3AF',
                transition: 'all 0.15s ease',
              }}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCalendarFreqMode('daily')}
              style={{
                padding: '10px 16px',
                borderRadius: '24px',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: calendarFreqMode === 'daily' ? '#FFFFFF' : 'transparent',
                color: calendarFreqMode === 'daily' ? '#000000' : '#9CA3AF',
                transition: 'all 0.15s ease',
              }}
            >
              Diária
            </button>
          </div>

          {/* Calendário Mensal Matrix (Grade de 7 Colunas Fiel ao Print) */}
          {calendarFreqMode === 'monthly' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Cabeçalho dos Dias da Semana */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '6px',
                  textAlign: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#9CA3AF',
                  padding: '4px 0',
                }}
              >
                <div>Seg</div>
                <div>Ter</div>
                <div>Qua</div>
                <div>Qui</div>
                <div>Sex</div>
                <div>Sáb</div>
                <div>Dom</div>
              </div>

              {/* Grade dos Dias */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '6px',
                }}
              >
                {/* Células vazias antes do dia 1 */}
                {Array.from({ length: firstDayWeekday }).map((_, i) => (
                  <div
                    key={`empty-prev-${i}`}
                    style={{
                      minHeight: '68px',
                      backgroundColor: 'transparent',
                    }}
                  />
                ))}

                {/* Dias do Mês */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const subsOnDay = subscriptionsByDay.get(day) || [];
                  const hasSubs = subsOnDay.length > 0;

                  return (
                    <div
                      key={`cal-day-${day}`}
                      onClick={() => {
                        if (hasSubs) {
                          setSelectedSubscription(subsOnDay[0].subscription);
                        }
                      }}
                      style={{
                        minHeight: '68px',
                        backgroundColor: '#1C1D21',
                        borderRadius: '10px',
                        padding: '6px 5px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: hasSubs ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease, transform 0.15s ease',
                        border: hasSubs ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.02)',
                      }}
                      onMouseEnter={e => {
                        if (hasSubs) {
                          e.currentTarget.style.backgroundColor = '#25272D';
                          e.currentTarget.style.transform = 'scale(1.03)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (hasSubs) {
                          e.currentTarget.style.backgroundColor = '#1C1D21';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {/* Número do Dia no Canto Superior Esquerdo */}
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#FFFFFF',
                          lineHeight: 1,
                        }}
                      >
                        {day}
                      </span>

                      {/* Ícone da Assinatura / Badge do Banco (Fiel ao Print) */}
                      {hasSubs && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 'auto',
                          }}
                        >
                          <SubscriptionLogo
                            name={subsOnDay[0].subscription.name}
                            category={subsOnDay[0].category}
                            bankId={subsOnDay[0].account?.bankId || subsOnDay[0].account?.name}
                            size={24}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Visualização Diária / Agenda Cronológica */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subStatusList.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
                  Nenhuma cobrança prevista para este mês.
                </div>
              ) : (
                [...subStatusList]
                  .sort((a, b) => a.dueDay - b.dueDay)
                  .map(item => {
                    const { subscription, isPaidThisMonth, category, account, dueDay } = item;

                    return (
                      <div
                        key={`daily-${subscription.id}`}
                        onClick={() => setSelectedSubscription(subscription)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: '16px',
                          backgroundColor: '#1C1D21',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#25272D')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1C1D21')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Dia */}
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '12px',
                              backgroundColor: isPaidThisMonth ? 'rgba(163, 230, 53, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                              color: isPaidThisMonth ? '#A3E635' : '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.92rem',
                              fontWeight: 800,
                            }}
                          >
                            {dueDay}
                          </div>

                          <SubscriptionLogo
                            name={subscription.name}
                            category={category}
                            bankId={account?.bankId || account?.name}
                            size={36}
                          />

                          <div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF' }}>
                              {subscription.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: isPaidThisMonth ? '#A3E635' : '#9CA3AF' }}>
                              {isPaidThisMonth ? 'Pago' : 'Aguardando cobrança'} • {account?.name || 'Cartão'}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF' }}>
                          {maskValue(formatBrlCurrency(subscription.amount))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Escolha de Transação para Definir como Assinatura (Screenshot 3) */}
      <SubscriptionTransactionPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        onSubscriptionCreated={(createdSub) => {
          setSelectedSubscription(createdSub);
        }}
        onOpenManualSubscription={() => {
          if (onOpenNewSubscription) {
            onOpenNewSubscription();
          }
        }}
      />
      </div>
    </SwipeBackView>
  );
};
