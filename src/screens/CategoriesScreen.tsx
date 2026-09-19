import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Plus, 
  ArrowLeft, 
  Tag, 
  Search, 
  SlidersHorizontal,
  FolderTree
} from 'lucide-react';
import { Category, CategoryType } from '../core/types';
import { IconRenderer } from '../components/common/IconRenderer';
import { SwipeBackView } from '../components/common/SwipeBackView';

interface CategoriesScreenProps {
  onBack?: () => void;
  onOpenNewCategory: () => void;
  onEditCategory: (cat: Category) => void;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  onBack,
  onOpenNewCategory,
  onEditCategory,
}) => {
  const { categories, transactions } = useFinance();
  const { colors } = useTheme();

  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rola para o topo ao carregar a tela
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  // Contagem de lançamentos por categoria
  const txCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(tx => {
      if (tx.categoryId) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + 1);
      }
    });
    return map;
  }, [transactions]);

  // Filtro de categorias
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      if (filterType !== 'all' && cat.type !== filterType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return cat.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [categories, filterType, searchQuery]);

  const expenseCount = categories.filter(c => c.type === 'expense').length;
  const incomeCount = categories.filter(c => c.type === 'income').length;

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          paddingBottom: 'calc(100px + var(--safe-area-bottom, 0px))',
          color: '#FFFFFF',
        }}
      >
        {/* 1. Header de Navegação Superior */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '6px',
          }}
        >
          {/* Botão Voltar Circular */}
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Voltar para Mais"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                e.currentTarget.style.transform = 'scale(1.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <ArrowLeft size={19} />
            </button>
          ) : (
            <div style={{ width: '42px' }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onOpenNewCategory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '22px',
                backgroundColor: '#4ADE80',
                border: 'none',
                color: '#0A0E0C',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(74, 222, 128, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Nova Categoria</span>
            </button>
          </div>
        </div>

        {/* 2. Título & Subtítulo da Tela */}
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
            Categorias
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '3px 0 0 0' }}>
            Organize suas despesas e receitas com ícones e cores personalizadas
          </p>
        </div>

        {/* 3. Barra de Busca e Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Campo de Busca Rápida */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#12161B',
              borderRadius: '16px',
              padding: '10px 14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '10px',
            }}
          >
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '0.88rem',
                outline: 'none',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Pílulas de Filtro (Todas / Despesas / Receitas) */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '24px',
              padding: '4px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => setFilterType('all')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: filterType === 'all' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                color: filterType === 'all' ? '#FFFFFF' : '#9CA3AF',
                fontSize: '0.8rem',
                fontWeight: filterType === 'all' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Todas ({categories.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('expense')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: filterType === 'expense' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                color: filterType === 'expense' ? '#FB7185' : '#9CA3AF',
                fontSize: '0.8rem',
                fontWeight: filterType === 'expense' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Despesas ({expenseCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('income')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: filterType === 'income' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                color: filterType === 'income' ? '#4ADE80' : '#9CA3AF',
                fontSize: '0.8rem',
                fontWeight: filterType === 'income' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Receitas ({incomeCount})
            </button>
          </div>
        </div>

        {/* 4. Grade de Categorias Limpa */}
        {filteredCategories.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#12161B',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Tag size={32} color="#64748B" />
            <span style={{ fontSize: '0.94rem', fontWeight: 600, color: '#E2E8F0' }}>
              Nenhuma categoria encontrada
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              {searchQuery ? 'Tente buscar com outro termo.' : 'Cadastre sua primeira categoria.'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '10px' }}>
            {filteredCategories.map(cat => {
              const txCount = txCountByCategory.get(cat.id) || 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => onEditCategory(cat)}
                  style={{
                    backgroundColor: '#12161B',
                    borderRadius: '18px',
                    padding: '14px 16px',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                    e.currentTarget.style.backgroundColor = '#161B22';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.backgroundColor = '#12161B';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '13px',
                        backgroundColor: `${cat.color}18`,
                        border: `1px solid ${cat.color}30`,
                        color: cat.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconRenderer name={cat.icon} size={20} color={cat.color} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {cat.name}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            backgroundColor: cat.type === 'expense' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                            color: cat.type === 'expense' ? '#FB7185' : '#4ADE80',
                          }}
                        >
                          {cat.type === 'expense' ? 'Despesa' : 'Receita'}
                        </span>

                        {cat.isCustom ? (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                              color: '#38BDF8',
                              fontWeight: 600,
                            }}
                          >
                            Personalizada
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#64748B',
                              fontWeight: 500,
                            }}
                          >
                            Padrão
                          </span>
                        )}

                        <span style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>
                          • {txCount} {txCount === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SwipeBackView>
  );
};
