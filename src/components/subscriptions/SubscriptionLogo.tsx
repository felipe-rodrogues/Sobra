import React from 'react';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { Category } from '../../core/types';
import { GraduationCap, Heart, Tv, Sparkles } from 'lucide-react';

import netflixImg from '../../assets/subscriptions/netflix.webp';
import primeVideoImg from '../../assets/subscriptions/prime_video.webp';
import maxImg from '../../assets/subscriptions/max.webp';
import disneyPlusImg from '../../assets/subscriptions/disney_plus.webp';
import spotifyImg from '../../assets/subscriptions/spotify.svg';
import ifoodImg from '../../assets/subscriptions/ifood.webp';
import app99Img from '../../assets/subscriptions/app99.webp';
import app99FoodImg from '../../assets/subscriptions/app99_food.webp';
import uberImg from '../../assets/subscriptions/uber.webp';
import googleImg from '../../assets/subscriptions/google.webp';
import chatgptImg from '../../assets/subscriptions/chatgpt.webp';
import canvaImg from '../../assets/subscriptions/canva.webp';
import meliPlusImg from '../../assets/subscriptions/meli_plus.webp';
import deezerImg from '../../assets/subscriptions/deezer.webp';
import amazonImg from '../../assets/subscriptions/amazon.webp';
import mercadoLivreImg from '../../assets/subscriptions/mercado_livre.webp';
import shopeeImg from '../../assets/subscriptions/shopee.webp';

interface SubscriptionLogoProps {
  name: string;
  category?: Category | null;
  bankId?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackIcon?: string;
}

export const SubscriptionLogo: React.FC<SubscriptionLogoProps> = ({
  name,
  category,
  bankId,
  size = 44,
  className = '',
  style = {},
  fallbackIcon,
}) => {
  const normName = (name || '').toLowerCase().trim();

  // Dimensões proporcionais
  const badgeSize = Math.max(14, Math.round(size * 0.38));
  const iconSize = Math.round(size * 0.52);

  // Helper para renderizar logos oficiais com acabamento perfeito
  const renderOfficialLogo = (src: string, alt: string, bgColor = 'transparent') => (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bgColor,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '82%',
          height: '82%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );

  // Renderizador específico de logos conhecidos (compatível com os prints do usuário)
  const renderBrandContent = () => {
    // 1. Netflix (Logo Oficial)
    if (normName.includes('netflix')) {
      return renderOfficialLogo(netflixImg, 'Netflix', '#000000');
    }

    // 2. Spotify (Logo Oficial)
    if (
      normName.includes('spotify') ||
      normName.includes('spoti') ||
      normName.startsWith('spot*') ||
      normName.includes('spot ')
    ) {
      return renderOfficialLogo(spotifyImg, 'Spotify', '#1ED760');
    }

    // 3. Amazon Prime / Prime Video (Logo Oficial) - Apenas se for explicitamente Prime Video ou Amazon Prime
    const isPrimeVideo =
      normName.includes('amazon prime video') ||
      normName.includes('amazon prime') ||
      normName.includes('prime video') ||
      normName.includes('primevideo') ||
      normName === 'prime';

    if (isPrimeVideo) {
      return renderOfficialLogo(primeVideoImg, 'Prime Video', '#00A8E1');
    }

    // 4. Amazon (Compras / E-commerce) - Logo Oficial com a seta sorridente
    if (
      normName.includes('amazon') ||
      normName.includes('amzn') ||
      normName.startsWith('amz*') ||
      normName.startsWith('amazon*')
    ) {
      return renderOfficialLogo(amazonImg, 'Amazon', '#FFFFFF');
    }

    // 4. Max / HBO Max (Logo Oficial)
    if (
      normName.includes('hbo') ||
      normName.includes('hbomax') ||
      normName.includes('hbo max') ||
      /\bmax\b/i.test(normName)
    ) {
      return renderOfficialLogo(maxImg, 'Max', '#000000');
    }

    // 5. Disney+ (Logo Oficial)
    if (
      normName.includes('disney') ||
      normName.includes('disney+') ||
      normName.includes('disney plus')
    ) {
      return renderOfficialLogo(disneyPlusImg, 'Disney+', '#042442');
    }

    // 6. Xbox / Game Pass (Logo Oficial)
    if (
      normName.includes('xbox') ||
      normName.includes('gamepass') ||
      normName.includes('game pass')
    ) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#107C10',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#FFFFFF" aria-label="Xbox">
            <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z"/>
          </svg>
        </div>
      );
    }

    // 7. PlayStation / PS Plus (Logo Oficial)
    if (
      normName.includes('playstation') ||
      normName.includes('play station') ||
      normName.includes('play 5') ||
      normName.includes('play 4') ||
      normName.includes('play5') ||
      normName.includes('play4') ||
      normName.includes('ps plus') ||
      normName.includes('ps+') ||
      normName.includes('playstation plus') ||
      /\bps5\b/i.test(normName) ||
      /\bps4\b/i.test(normName)
    ) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#003791',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#FFFFFF" aria-label="PlayStation">
            <path d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991c.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152c0-3.237-1.126-4.675-4.438-5.827c-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818c-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661c1.848.601 2.04 1.472 1.576 2.072c-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32c.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826c.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073c-1.939.331-3.996.196-6.038-.479z"/>
          </svg>
        </div>
      );
    }

    // 8. iFood / iFood Clube (Logo Oficial)
    if (normName.includes('ifood') || normName.includes('i food')) {
      return renderOfficialLogo(ifoodImg, 'iFood', '#EA1D2C');
    }

    // 9. 99 Food (Logo Oficial)
    if (
      normName.includes('99 food') ||
      normName.includes('99food') ||
      normName.includes('99_food') ||
      normName.includes('99-food') ||
      /99.*food/i.test(normName)
    ) {
      return renderOfficialLogo(app99FoodImg, '99 Food', '#FFDD00');
    }

    // 10. 99 / 99 Corridas / 99 Pop / 99 Taxi / 99 Pay (Logo Oficial)
    if (
      normName.includes('99 pop') ||
      normName.includes('99pop') ||
      normName.includes('99 taxi') ||
      normName.includes('99 corrida') ||
      normName.includes('99 corridas') ||
      normName.includes('99app') ||
      normName.includes('99 app') ||
      normName.includes('app99') ||
      normName.includes('app 99') ||
      normName.includes('99pay') ||
      normName.includes('99 pay') ||
      normName.includes('corrida 99') ||
      normName.includes('motorista 99') ||
      normName.startsWith('99*') ||
      normName.startsWith('99 *') ||
      normName === '99' ||
      /\b99\b/.test(normName)
    ) {
      return renderOfficialLogo(app99Img, '99', '#F9C002');
    }

    // 11. Uber / Uber One (Logo Oficial)
    if (normName.includes('uber')) {
      return renderOfficialLogo(uberImg, 'Uber', '#000000');
    }

    // 10. Google / Google One (Logo Oficial)
    if (
      normName.includes('google') ||
      normName.includes('gsuite') ||
      normName.includes('workspace')
    ) {
      return renderOfficialLogo(googleImg, 'Google', '#FFFFFF');
    }

    // 11. ChatGPT / OpenAI (Logo Oficial)
    if (
      normName.includes('chatgpt') ||
      normName.includes('chat gpt') ||
      normName.includes('openai') ||
      normName.includes('open ai')
    ) {
      return renderOfficialLogo(chatgptImg, 'ChatGPT', '#FFFFFF');
    }

    // 12. Canva / Canva Pro (Logo Oficial)
    if (normName.includes('canva')) {
      return renderOfficialLogo(canvaImg, 'Canva', '#00C4CC');
    }

    // 13. Meli+ (Assinatura Oficial) — inclui 'meli' sozinho
    if (
      normName.includes('meli+') ||
      normName.includes('meli plus') ||
      normName.includes('melimais') ||
      normName.includes('meli mais') ||
      normName === 'meli'
    ) {
      return renderOfficialLogo(meliPlusImg, 'Meli+', '#7E00B3');
    }

    // 14. Mercado Livre (Compras) — apenas nomes explícitos de Mercado Livre
    if (
      normName.includes('mercado livre') ||
      normName.includes('mercadolivre') ||
      normName.startsWith('mercadolivre*') ||
      normName.startsWith('mercado*livre')
    ) {
      return renderOfficialLogo(mercadoLivreImg, 'Mercado Livre', '#FFFFFF');
    }

    // 15. Shopee (Compras) - Logo Oficial
    if (
      normName.includes('shopee') ||
      normName.includes('shoppe') ||
      normName.includes('shopeepay') ||
      normName.includes('shopee pay') ||
      normName.startsWith('shopee*') ||
      normName.startsWith('shoppe*')
    ) {
      return renderOfficialLogo(shopeeImg, 'Shopee', '#EE4D2D');
    }


    // 14. Deezer (Logo Oficial)
    if (normName.includes('deezer')) {
      return renderOfficialLogo(deezerImg, 'Deezer', '#7B16FF');
    }

    // 15. UVA / Universidade / Faculdade
    if (normName.includes('uva') || normName.includes('veiga') || normName.includes('faculdade') || normName.includes('universidade')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38BDF8',
          }}
        >
          <GraduationCap size={iconSize} />
        </div>
      );
    }

    // 16. Life Fit / Academia / Gym
    if (normName.includes('life fit') || normName.includes('lifefit') || normName.includes('smart fit') || normName.includes('bluefit') || normName.includes('academia')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2DD4BF',
          }}
        >
          <Heart size={iconSize} />
        </div>
      );
    }

    // 17. Claro
    if (normName.includes('claro')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              color: '#DA291C',
              fontWeight: 900,
              fontSize: `${Math.round(size * 0.28)}px`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            Claro'
          </span>
        </div>
      );
    }

    // 18. Steam
    if (normName.includes('steam')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#171A21',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.724L.437 14.77C1.867 20.076 6.48 24 12 24c6.627 0 12-5.373 12-12S18.605 0 11.979 0z" />
          </svg>
        </div>
      );
    }

    // 19. YouTube
    if (normName.includes('youtube')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#FF0000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Tv size={iconSize} />
        </div>
      );
    }

    // 20. Apple / iCloud
    if (normName.includes('apple') || normName.includes('icloud')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#27272A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Sparkles size={iconSize} />
        </div>
      );
    }

    // Fallback: Categoria ou Iniciais
    if (category) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: category.color || '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <IconRenderer name={category.icon || fallbackIcon || 'Repeat'} size={iconSize} />
        </div>
      );
    }

    // Fallback genérico com as primeiras letras
    const initials = (name || 'AS')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: '#374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F3F4F6',
          fontSize: `${Math.round(size * 0.38)}px`,
          fontWeight: 700,
        }}
      >
        {fallbackIcon ? (
          <IconRenderer name={fallbackIcon} size={iconSize} />
        ) : (
          initials
        )}
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {/* Círculo Principal do Avatar */}
      {renderBrandContent()}

      {/* Badge do Banco Sobreposto no Canto Inferior Direito */}
      {bankId && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            borderRadius: '50%',
            backgroundColor: '#0E0F12',
            boxShadow: '0 0 0 2px #0E0F12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <BankLogo bankId={bankId} size={badgeSize} />
        </div>
      )}
    </div>
  );
};

export const BrandLogo = SubscriptionLogo;
