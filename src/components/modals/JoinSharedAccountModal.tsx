import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { 
  fetchInviteByCode, 
  fetchSharedTransactions, 
  registerSharedAccountMember, 
  fetchSharedAccountMembers 
} from '../../services/supabase';
import { SharedCardInvite, Account, SharedMember } from '../../core/types';
import { db } from '../../database/adapter';
import { BankLogo } from '../common/BankLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { 
  Users, 
  X, 
  Check, 
  Search, 
  AlertCircle, 
  CreditCard,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface JoinSharedAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (account: Account) => void;
}

export const JoinSharedAccountModal: React.FC<JoinSharedAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { saveAccount, accounts, refreshData } = useFinance();

  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [invitePreview, setInvitePreview] = useState<SharedCardInvite | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleSearchCode = async (codeToSearch: string) => {
    const clean = codeToSearch.trim().toUpperCase();
    if (!clean) {
      setInvitePreview(null);
      setErrorMessage(null);
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const invite = await fetchInviteByCode(clean);
      if (!invite) {
        setInvitePreview(null);
        setErrorMessage('Código de convite não encontrado ou expirado.');
      } else {
        // Verifica se já possui esta conta cadastrada
        const alreadyHas = accounts.some(a => a.id === invite.accountId || a.inviteCode === invite.code);
        if (alreadyHas) {
          setErrorMessage('Você já está vinculado a este cartão compartilhado.');
          setInvitePreview(null);
        } else {
          setInvitePreview(invite);
          setErrorMessage(null);
        }
      }
    } catch (err) {
      setErrorMessage('Erro ao consultar convite. Verifique sua conexão.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated || !user) {
      openAuthModal({
        title: 'Entrar em Cartão Compartilhado',
        subtitle: 'Para sincronizar gastos em tempo real com este cartão, é necessário criar uma conta.',
        iconType: 'shared',
        hideGuestOption: true,
      });
      return;
    }

    if (!invitePreview) return;

    setIsJoining(true);
    try {
      // 1. Registra o novo participante na nuvem (Supabase)
      const newMember: SharedMember = {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: 'member',
        joinedAt: new Date().toISOString(),
      };

      try {
        await registerSharedAccountMember(invitePreview.accountId, newMember);
      } catch (regErr) {
        console.warn('Aviso ao registrar membro no Supabase:', regErr);
      }

      // 2. Monta a lista completa e oficial de membros vinculados
      let membersList: SharedMember[] = [
        {
          userId: invitePreview.ownerId,
          displayName: invitePreview.ownerName,
          email: '',
          role: 'owner',
          joinedAt: invitePreview.createdAt,
        },
        newMember,
      ];

      try {
        const remoteMembers = await fetchSharedAccountMembers(invitePreview.accountId);
        if (remoteMembers && remoteMembers.length > 0) {
          const map = new Map<string, SharedMember>();
          membersList.forEach(m => map.set(m.userId, m));
          remoteMembers.forEach(m => map.set(m.userId, m));
          membersList = Array.from(map.values());
        }
      } catch (memErr) {
        console.warn('Aviso ao buscar membros remotos:', memErr);
      }

      const newSharedAccount: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
        id: invitePreview.accountId,
        name: invitePreview.accountName,
        type: invitePreview.type || 'credit_card',
        balance: 0,
        creditLimit: invitePreview.creditLimit !== undefined && invitePreview.creditLimit !== null ? Number(invitePreview.creditLimit) : undefined,
        color: invitePreview.color || '#820AD1',
        icon: 'CreditCard',
        currency: 'BRL',
        bankId: invitePreview.bankId || 'nubank',
        syncStatus: 'synced',
        isShared: true,
        ownerId: invitePreview.ownerId,
        ownerName: invitePreview.ownerName,
        inviteCode: invitePreview.code,
        sharedMembers: membersList,
      };

      const saved = await saveAccount(newSharedAccount);

      // 3. Sincroniza compras prévias já existentes neste cartão compartilhado em lote local
      try {
        const remoteTxs = await fetchSharedTransactions(invitePreview.accountId);
        if (remoteTxs && remoteTxs.length > 0) {
          for (const tx of remoteTxs) {
            await db.saveTransaction({
              ...tx,
              isShared: true,
            });
          }
          await refreshData();
        }
      } catch (txErr) {
        console.warn('Falha não crítica ao puxar histórico inicial:', txErr);
      }

      if (onSuccess) onSuccess(saved);
      onClose();
    } catch (err) {
      console.error('Erro ao ingressar no cartão compartilhado:', err);
      setErrorMessage('Erro ao vincular cartão compartilhado. Tente novamente.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#111713',
          border: '1px solid rgba(74, 222, 128, 0.25)',
          borderRadius: '26px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
          padding: '24px 22px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: 'rgba(74, 222, 128, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ADE80',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                Entrar em Cartão Conjunto
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#8E8E93' }}>
                Insira o código de convite enviado pelo seu parceiro(a)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Input de Código */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
            Código de Convite
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Ex: SOBRA-4892"
              value={code}
              onChange={e => {
                const val = e.target.value.toUpperCase();
                setCode(val);
                if (val.length >= 6) {
                  handleSearchCode(val);
                } else {
                  setInvitePreview(null);
                  setErrorMessage(null);
                }
              }}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: errorMessage ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '0 44px 0 14px',
                color: '#FFFFFF',
                fontSize: '1.05rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => handleSearchCode(code)}
              disabled={isSearching || !code.trim()}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                backgroundColor: '#1C271F',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                color: '#4ADE80',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Search size={15} />
            </button>
          </div>

          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#EF4444', fontSize: '0.76rem' }}>
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Card de Prévia do Convite Encontrado */}
        {invitePreview && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '18px',
              backgroundColor: 'rgba(74, 222, 128, 0.08)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              marginBottom: '20px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BankLogo bankId={invitePreview.bankId || 'nubank'} size={24} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {invitePreview.accountName}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#4ADE80', marginTop: '2px' }}>
                  Criado por <strong>{invitePreview.ownerName}</strong>
                </div>
              </div>
            </div>

            {invitePreview.creditLimit && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#8E8E93' }}>Limite do Cartão:</span>
                <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{formatBrlCurrency(invitePreview.creditLimit)}</span>
              </div>
            )}
          </div>
        )}

        {/* Botão de Ação */}
        <button
          type="button"
          disabled={!invitePreview || isJoining}
          onClick={handleJoin}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: invitePreview ? '#4ADE80' : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: invitePreview ? '#0A150D' : '#64748B',
            fontSize: '0.92rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: invitePreview && !isJoining ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
          }}
        >
          {isJoining ? (
            <span>Vinculando...</span>
          ) : (
            <>
              <span>Vincular e Sincronizar Gastos</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
