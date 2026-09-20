import React, { useState, useRef, useEffect } from 'react';
import { Camera, Trash2, X, Check, User, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(user?.displayName || '');
      setAvatarUrl(user?.avatarUrl);
      setErrorMsg(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Processa e comprime a foto selecionada para ~320px via canvas (alta nitidez, ~30KB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (PNG, JPG ou WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
          setAvatarUrl(compressedDataUrl);
          setErrorMsg(null);
        } else {
          setAvatarUrl(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg('Informe um nome ou apelido válido.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await updateProfile({
        displayName: cleanName,
        avatarUrl: avatarUrl,
      });
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setErrorMsg('Não foi possível salvar o perfil. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Iniciais para o fallback caso não haja avatar
  const initials = displayName.trim()
    ? displayName
        .trim()
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('')
    : 'U';

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
          maxWidth: '420px',
          backgroundColor: '#111713',
          border: '1px solid rgba(74, 222, 128, 0.25)',
          borderRadius: '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
              Personalizar Perfil
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '3px 0 0 0' }}>
              Altere seu nome de exibição e foto de perfil
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Seletor de Foto de Perfil */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  backgroundColor: '#0D1410',
                  border: '2.5px solid #4ADE80',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(74, 222, 128, 0.25)',
                  position: 'relative',
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '1.8rem',
                      fontWeight: 800,
                      color: '#4ADE80',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                  >
                    {initials}
                  </span>
                )}

                {/* Overlay translúcido com ícone de câmera */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: avatarUrl ? 0 : 0.8,
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = avatarUrl ? '0' : '0.8')}
                >
                  <Camera size={26} color="#FFFFFF" />
                </div>
              </div>

              {/* Botão flutuante de câmera */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Trocar foto"
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#4ADE80',
                  border: '2px solid #111713',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                <Camera size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Input escondido para upload de arquivo nativo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Ações de Foto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  borderRadius: '9999px',
                  padding: '5px 14px',
                  color: '#4ADE80',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {avatarUrl ? 'Trocar Foto' : 'Adicionar Foto'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '9999px',
                    padding: '5px 12px',
                    color: '#EF4444',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={13} />
                  <span>Remover</span>
                </button>
              )}
            </div>
          </div>

          {/* Campo de Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#CBD5E1',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Nome de Exibição
            </label>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <User size={18} />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Felipe Rodrigues"
                maxLength={40}
                style={{
                  width: '100%',
                  padding: '13px 14px 13px 42px',
                  backgroundColor: '#161F18',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  color: '#FFFFFF',
                  fontSize: '0.96rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#4ADE80')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
              O primeiro nome será usado na saudação da tela inicial ("Olá, {displayName.trim().split(' ')[0] || '...'}")
            </span>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#FCA5A5',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                flex: 2,
                padding: '13px',
                borderRadius: '14px',
                backgroundColor: '#4ADE80',
                border: 'none',
                color: '#0D1410',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(74, 222, 128, 0.35)',
              }}
            >
              {isSaving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check size={18} strokeWidth={2.5} />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
