import React from 'react';
import { getBankById } from '../../core/banks/bankCatalog';
import { Wallet, Landmark } from 'lucide-react';
import mercadoPagoImg from '../../assets/banks/mercadopago.png';
import santanderImg from '../../assets/banks/santander.png';
import bradescoImg from '../../assets/banks/bradesco.png';
import bbImg from '../../assets/banks/bb.png';
import neonImg from '../../assets/banks/neon.png';
import caixaImg from '../../assets/banks/caixa.png';
import interImg from '../../assets/banks/inter.png';
import pagbankImg from '../../assets/banks/pagbank.png';
import digioImg from '../../assets/banks/digio.png';
import btgImg from '../../assets/banks/btg.png';
import ameImg from '../../assets/banks/ame.png';
import panImg from '../../assets/banks/pan.png';
import originalImg from '../../assets/banks/original.png';
import itiImg from '../../assets/banks/iti.png';
import sicoobImg from '../../assets/banks/sicoob.png';
import sicrediImg from '../../assets/banks/sicredi.png';
import bvImg from '../../assets/banks/bv.png';
import safraImg from '../../assets/banks/safra.png';
import xpImg from '../../assets/banks/xp.png';
import sofisaImg from '../../assets/banks/sofisa.png';
import nextImg from '../../assets/banks/next.png';

interface BankLogoProps {
  bankId?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const BankLogo: React.FC<BankLogoProps> = ({
  bankId,
  size = 32,
  className = '',
  style = {},
}) => {
  const bank = getBankById(bankId);
  const normalized = (bankId || '').toLowerCase();

  const box: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${Math.round(size * 0.28)}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    ...style,
  };

  // Tamanho base do SVG interno
  const ic = size * 0.64;

  switch (normalized) {

    // ────────────────────────────────────────────────────────────────────────
    // NUBANK — monograma "Nu" oficial (Simple Icons)
    // ────────────────────────────────────────────────────────────────────────
    case 'nubank':
      return (
        <div style={{ ...box, backgroundColor: '#820AD1' }} className={className}>
          <svg width={ic} height={ic} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#fff" d="M7.28 5.43c-1.18 0-2.18.46-2.94 1.25h-.16c-1.54 0-2.99.88-3.7 2.26-.31.6-.42 1.24-.46 1.9-.03.59 0 1.19 0 1.77v5.65H3.18s.002-2.78 0-5.18c-.001-1.61-.012-3.05 0-3.34.056-1.39.437-2.31 1.148-3.05 2.36.002 3.886 1.61 3.97 4.17.02.587.026 3.73.026 3.73v3.67h3.168v-4.965c0-1.5.013-2.8-.092-3.695-.292-2.5-1.82-4.168-4.125-4.168zm8.39.3l-3.166.004v4.965c0 1.5-.013 2.8.092 3.695.292 2.5 1.82 4.168 4.125 4.168 1.18 0 2.18-.46 2.94-1.252h.166c1.544 0 2.99-.884 3.697-2.256.309-.6.423-1.244.459-1.9.032-.589 0-1.186 0-1.77V5.738H20.816s-.002 2.784 0 5.178c.001 1.61.012 3.047 0 3.342-.056 1.393-.437 2.305-1.148 3.05-2.36-.002-3.886-1.609-3.97-4.168-.02-.587-.027-2.044-.027-3.732z"/>
          </svg>
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // ITAÚ — fundo laranja, caixa azul com "itaú" amarelo
    // ────────────────────────────────────────────────────────────────────────
    case 'itau':
      return (
        <div style={{ ...box, backgroundColor: '#EC7000' }} className={className}>
          <div style={{
            width: size * 0.68, height: size * 0.68,
            borderRadius: size * 0.14,
            backgroundColor: '#003399',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#FFD100', fontWeight: 900, fontFamily: 'Arial,sans-serif', fontSize: size * 0.24, letterSpacing: '-0.04em' }}>
              itaú
            </span>
          </div>
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BRADESCO — ícone oficial do app (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'bradesco':
      return (
        <div style={box} className={className}>
          <img
            src={bradescoImg}
            alt="Bradesco"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO DO BRASIL — ícone oficial do app (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'bb':
    case 'banco do brasil':
      return (
        <div style={box} className={className}>
          <img
            src={bbImg}
            alt="Banco do Brasil"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // CAIXA — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'caixa':
      return (
        <div style={{ ...box, backgroundColor: '#005CA9' }} className={className}>
          <img
            src={caixaImg}
            alt="Caixa"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scale(1.12)',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // SANTANDER — ícone oficial do app (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'santander':
      return (
        <div style={box} className={className}>
          <img
            src={santanderImg}
            alt="Santander"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO INTER — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'inter':
      return (
        <div style={box} className={className}>
          <img
            src={interImg}
            alt="Banco Inter"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // C6 BANK
    // ────────────────────────────────────────────────────────────────────────
    case 'c6':
    case 'c6 bank':
      return (
        <div style={{ ...box, backgroundColor: '#1C1C1E', border: '1px solid rgba(255,255,255,0.1)' }} className={className}>
          <span style={{ color: '#fff', fontWeight: 900, fontFamily: 'Arial,sans-serif', fontSize: size * 0.33 }}>
            C6
          </span>
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // MERCADO PAGO — aperto de mão oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'mercadopago':
    case 'mercado pago':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={mercadoPagoImg}
            alt="Mercado Pago"
            style={{
              width: '90%',
              height: '90%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // PICPAY — logo oficial (P + quadrado no canto superior direito)
    // ────────────────────────────────────────────────────────────────────────
    case 'picpay':
      return (
        <div style={{ ...box, backgroundColor: '#21C25E' }} className={className}>
          <svg width={ic} height={ic} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#fff" d="M16.46 1.59v7.54H24V1.59zm1.26 1.26h5.02v5.02h-5.02zm1.26 1.26v2.51h2.51V4.1zM3.77 5.35V8.53h3.38c2.14 0 3.36 1.04 3.36 2.94 0 1.95-1.22 3.01-3.36 3.01H3.77V8.53H0v13.88h3.77v-4.76h3.57c4.33 0 6.82-2.35 6.82-6.32C14.16 7.56 11.67 5.35 7.34 5.35z"/>
          </svg>
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BTG PACTUAL — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'btg':
    case 'btg pactual':
      return (
        <div style={box} className={className}>
          <img
            src={btgImg}
            alt="BTG Pactual"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // NEON — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'neon':
      return (
        <div style={box} className={className}>
          <img
            src={neonImg}
            alt="Neon"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // PAGBANK — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'pagbank':
    case 'pag bank':
      return (
        <div style={box} className={className}>
          <img
            src={pagbankImg}
            alt="PagBank"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // AME DIGITAL — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'ame':
    case 'ame digital':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={ameImg}
            alt="Ame Digital"
            style={{
              width: '84%',
              height: '84%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );


    // ────────────────────────────────────────────────────────────────────────
    // DIGIO — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'digio':
      return (
        <div style={box} className={className}>
          <img
            src={digioImg}
            alt="Digio"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO PAN — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'pan':
    case 'banco pan':
      return (
        <div style={box} className={className}>
          <img
            src={panImg}
            alt="Banco PAN"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO ORIGINAL — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'original':
    case 'banco original':
      return (
        <div style={box} className={className}>
          <img
            src={originalImg}
            alt="Banco Original"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // XP INVESTIMENTOS — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'xp':
    case 'xp investimentos':
      return (
        <div style={box} className={className}>
          <img
            src={xpImg}
            alt="XP Investimentos"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // ITI ITAÚ — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'iti':
    case 'iti itau':
    case 'iti itaú':
    case 'itau iti':
    case 'itaú iti':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={itiImg}
            alt="iti Itaú"
            style={{
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // SICOOB — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'sicoob':
    case 'banco sicoob':
      return (
        <div style={box} className={className}>
          <img
            src={sicoobImg}
            alt="Sicoob"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // SICREDI — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'sicredi':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={sicrediImg}
            alt="Sicredi"
            style={{
              width: '92%',
              height: '92%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BV (BANCO VOTORANTIM) — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'bv':
    case 'banco bv':
    case 'votorantim':
    case 'bv - banco votorantim':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={bvImg}
            alt="BV - Banco Votorantim"
            style={{
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO SAFRA — brasão oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'safra':
    case 'banco safra':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={safraImg}
            alt="Banco Safra"
            style={{
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // BANCO NEXT — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'next':
    case 'banco next':
      return (
        <div style={box} className={className}>
          <img
            src={nextImg}
            alt="Banco Next"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // SOFISA DIRETO — ícone oficial (imagem direta enviada pelo usuário)
    // ────────────────────────────────────────────────────────────────────────
    case 'sofisa':
    case 'sofisa direto':
      return (
        <div style={{ ...box, backgroundColor: '#ffffff' }} className={className}>
          <img
            src={sofisaImg}
            alt="Sofisa Direto"
            style={{
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // CARTEIRA / DINHEIRO
    // ────────────────────────────────────────────────────────────────────────
    case 'cash':
    case 'dinheiro':
    case 'carteira':
      return (
        <div style={{ ...box, backgroundColor: '#10B981' }} className={className}>
          <Wallet size={size * 0.55} color="#fff" />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // CONTA PRINCIPAL / GENÉRICA
    // ────────────────────────────────────────────────────────────────────────
    case 'generic':
    case 'checking':
    case 'conta':
    case 'conta principal':
      return (
        <div style={{ ...box, backgroundColor: '#10B981' }} className={className}>
          <Landmark size={size * 0.55} color="#fff" />
        </div>
      );

    // ────────────────────────────────────────────────────────────────────────
    // FALLBACK — usa cor do catálogo ou azul padrão
    // ────────────────────────────────────────────────────────────────────────
    default:
      return (
        <div style={{ ...box, backgroundColor: bank?.color || '#10B981' }} className={className}>
          <Landmark size={size * 0.55} color="#fff" />
        </div>
      );
  }
};
