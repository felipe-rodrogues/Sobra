import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  UploadCloud, 
  DownloadCloud, 
  FileText, 
  Check, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  Database,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { 
  uploadCloudBackup, 
  fetchCloudBackup, 
  CloudBackupInfo,
  isSupabaseConfigured 
} from '../../services/supabase';

interface CloudBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { accounts, transactions, exportFullBackup, importFullBackup } = useFinance();

  const [lastBackup, setLastBackup] = useState<CloudBackupInfo | null>(null);
  const [isLoadingBackup, setIsLoadingBackup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [tableMissingAlert, setTableMissingAlert] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega informações do último backup quando o modal abre
  useEffect(() => {
    if (isOpen && user?.id) {
      loadBackupInfo();
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const loadBackupInfo = async () => {
    if (!user?.id) return;
    setIsLoadingBackup(true);
    try {
      const info = await fetchCloudBackup(user.id);
      setLastBackup(info);
    } catch (e) {
      console.warn('Erro ao carregar metadados do backup:', e);
    } finally {
      setIsLoadingBackup(false);
    }
  };

  // 1. Fazer Backup na Nuvem (Google / Supabase)
  const handleCloudUpload = async () => {
    if (!user?.id) {
      openAuthModal({
        title: 'Fazer Backup na Nuvem',
        subtitle: 'Conecte sua conta do Google para enviar seus dados com segurança.',
        hideGuestOption: true,
      });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    setTableMissingAlert(false);

    try {
      const fullData = await exportFullBackup();
      const meta = await uploadCloudBackup(user.id, fullData);
      setLastBackup(meta);
      setStatusMessage({
        type: 'success',
        text: `Backup salvo na nuvem com sucesso! (${fullData.accounts.length} contas e ${fullData.transactions.length} lançamentos salvos).`,
      });
    } catch (err: any) {
      console.error('Erro ao enviar backup:', err);
      if (err.message === 'TABLE_NOT_FOUND') {
        setTableMissingAlert(true);
        setStatusMessage({
          type: 'error',
          text: 'A tabela de backups em nuvem ainda não foi criada no Supabase. Você pode usar a opção de "Exportar Arquivo" abaixo enquanto o script SQL é executado.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Não foi possível salvar na nuvem. Verifique sua conexão.',
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 2. Restaurar Backup da Nuvem
  const handleCloudRestore = async () => {
    if (!user?.id) return;

    setIsRestoring(true);
    setStatusMessage(null);

    try {
      const backup = await fetchCloudBackup(user.id);
      if (!backup || !backup.data) {
        setStatusMessage({
          type: 'info',
          text: 'Nenhum backup encontrado na nuvem para esta conta Google.',
        });
        return;
      }

      const dateStr = new Date(backup.updatedAt).toLocaleString('pt-BR');
      const confirmRestore = window.confirm(
        `Restaurar Backup da Nuvem?\n\n` +
        `Data do backup: ${dateStr}\n` +
        `Contas salvas: ${backup.accountsCount}\n` +
        `Transações: ${backup.transactionsCount}\n\n` +
        `Isso atualizará os dados deste celular com as informações salvas na nuvem. Deseja continuar?`
      );

      if (!confirmRestore) return;

      await importFullBackup(backup.data);
      setStatusMessage({
        type: 'success',
        text: '🎉 Dados restaurados com sucesso! Seu aplicativo está atualizado com o backup da nuvem.',
      });
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Erro ao restaurar backup:', err);
      setStatusMessage({
        type: 'error',
        text: 'Erro ao restaurar backup. Verifique sua conexão e tente novamente.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 3. Exportar Arquivo JSON (Backup Local Portátil)
  const handleExportFile = async () => {
    try {
      const fullData = await exportFullBackup();
      const jsonStr = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const fileName = `sobra_backup_${dateTag}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Arquivo "${fileName}" baixado com sucesso! Guarde-o no Google Drive ou envie para seu e-mail.`,
      });
    } catch (err) {
      console.error('Erro ao exportar arquivo:', err);
      setStatusMessage({
        type: 'error',
        text: 'Erro ao gerar arquivo de backup.',
      });
    }
  };

  // 4. Importar Arquivo JSON (Restauração Manual)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || (!parsed.accounts && !parsed.transactions)) {
          throw new Error('Arquivo de backup inválido.');
        }

        const confirmRestore = window.confirm(
          `Restaurar Backup do Arquivo "${file.name}"?\n\n` +
          `Contas encontradas: ${parsed.accounts?.length || 0}\n` +
          `Transações encontradas: ${parsed.transactions?.length || 0}\n\n` +
          `Deseja aplicar esses dados ao aplicativo?`
        );

        if (!confirmRestore) return;

        await importFullBackup(parsed);
        setStatusMessage({
          type: 'success',
          text: '🎉 Dados do arquivo restaurados com sucesso!',
        });
        setTimeout(() => {
          onClose();
        }, 1800);
      } catch (err: any) {
        console.error('Erro ao importar arquivo:', err);
        setStatusMessage({
          type: 'error',
          text: 'Arquivo corrompido ou formato incompatível. Certifique-se de usar um arquivo exportado pelo Sobra.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
          maxWidth: '440px',
          maxHeight: '90vh',
          backgroundColor: '#111713',
          border: '1px solid rgba(74, 222, 128, 0.25)',
          borderRadius: '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '-0.02em',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              Backup & Restauração
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '3px 0 0 0' }}>
              Mantenha seus dados salvos ao trocar de aparelho
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              color: '#94A3B8',
              cursor: 'pointer',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo dos Dados Atuais do Dispositivo */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ADE80',
              }}
            >
              <Smartphone size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                Dados neste celular
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                {accounts.length} contas/cartões • {transactions.length} transações
              </div>
            </div>
          </div>
        </div>

        {/* Feedback de Status */}
        {statusMessage && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              backgroundColor:
                statusMessage.type === 'success'
                  ? 'rgba(74, 222, 128, 0.12)'
                  : statusMessage.type === 'error'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(56, 189, 248, 0.12)',
              border: `1px solid ${
                statusMessage.type === 'success'
                  ? 'rgba(74, 222, 128, 0.25)'
                  : statusMessage.type === 'error'
                  ? 'rgba(239, 68, 68, 0.25)'
                  : 'rgba(56, 189, 248, 0.25)'
              }`,
              color:
                statusMessage.type === 'success'
                  ? '#86EFAC'
                  : statusMessage.type === 'error'
                  ? '#FCA5A5'
                  : '#BAE6FD',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              marginBottom: '16px',
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Bloco 1: Backup na Nuvem (Google Account) */}
        <div
          style={{
            background: 'linear-gradient(150deg, rgba(20, 36, 26, 0.8) 0%, rgba(13, 22, 17, 0.95) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.25)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={20} color="#4ADE80" />
              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#FFFFFF' }}>
                Nuvem Sobra (Google)
              </span>
            </div>

            {isAuthenticated ? (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(74, 222, 128, 0.15)',
                  color: '#4ADE80',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                Conectado
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#94A3B8',
                }}
              >
                Desconectado
              </span>
            )}
          </div>

          {isAuthenticated ? (
            <>
              {/* Informações do último backup na nuvem */}
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4 }}>
                {lastBackup ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="#4ADE80" />
                    <span>
                      Último backup: <strong>{new Date(lastBackup.updatedAt).toLocaleString('pt-BR')}</strong> ({lastBackup.accountsCount} contas, {lastBackup.transactionsCount} transações)
                    </span>
                  </div>
                ) : (
                  <span>Nenhum backup em nuvem registrado ainda para esta conta.</span>
                )}
              </div>

              {/* Ações da Nuvem */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloudUpload}
                  disabled={isUploading || isRestoring}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#4ADE80',
                    border: 'none',
                    color: '#0D1410',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(74, 222, 128, 0.25)',
                  }}
                >
                  <UploadCloud size={16} />
                  <span>{isUploading ? 'Salvando...' : 'Salvar na Nuvem'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloudRestore}
                  disabled={isUploading || isRestoring || !lastBackup}
                  title={!lastBackup ? 'Nenhum backup disponível para restaurar' : undefined}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: lastBackup ? '#FFFFFF' : '#64748B',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: isRestoring || !lastBackup ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <DownloadCloud size={16} />
                  <span>{isRestoring ? 'Restaurando...' : 'Restaurar da Nuvem'}</span>
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                Entre com sua conta Google para salvar um backup dos seus dados na nuvem e restaurar quando trocar de telefone.
              </p>
              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    title: 'Backup com Google',
                    subtitle: 'Conecte sua conta para manter seus dados seguros em qualquer dispositivo.',
                    hideGuestOption: true,
                  })
                }
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  color: '#0F172A',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <span>Conectar com Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Bloco 2: Backup Local em Arquivo JSON */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#94A3B8" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#CBD5E1' }}>
              Arquivo de Backup Local (.json)
            </span>
          </div>

          <p style={{ fontSize: '0.76rem', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
            Baixe um arquivo com todas as suas informações para guardar no seu computador, Drive ou enviar por e-mail.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleExportFile}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                color: '#E2E8F0',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <DownloadCloud size={15} />
              <span>Exportar Arquivo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                color: '#E2E8F0',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <UploadCloud size={15} />
              <span>Restaurar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Rodapé Informativo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', justifyContent: 'center' }}>
          <ShieldCheck size={14} color="#4ADE80" />
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            Seus backups são privados e vinculados exclusivamente à sua conta
          </span>
        </div>
      </div>
    </div>
  );
};
