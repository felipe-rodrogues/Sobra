import React from 'react';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { UserAvatar } from '../common/UserAvatar';
import { Category } from '../../core/types';
import { GraduationCap, Heart, Sparkles, Users } from 'lucide-react';
import { AuthorBadgeData } from '../../core/cards/cardSelectionHelper';

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
import sheinImg from '../../assets/subscriptions/shein.png';
import aliexpressImg from '../../assets/subscriptions/aliexpress.png';
import mcdonaldsImg from '../../assets/subscriptions/mcdonalds.png';
import burgerKingImg from '../../assets/subscriptions/burger_king.png';
import cAndAImg from '../../assets/subscriptions/c_and_a.png';
import rennerImg from '../../assets/subscriptions/renner.png';
import riachueloImg from '../../assets/subscriptions/riachuelo.png';
import tiktokImg from '../../assets/subscriptions/tiktok.webp';
import outbackImg from '../../assets/subscriptions/outback.webp';
import steamImg from '../../assets/subscriptions/steam.webp';
import claroImg from '../../assets/subscriptions/claro.webp';
import youtubeImg from '../../assets/subscriptions/youtube.webp';

interface SubscriptionLogoProps {
  name: string;
  category?: Category | null;
  bankId?: string;
  authorBadge?: AuthorBadgeData | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackIcon?: string;
}

export const SubscriptionLogo: React.FC<SubscriptionLogoProps> = ({
  name,
  category,
  bankId,
  authorBadge,
  size = 44,
  className = '',
  style = {},
  fallbackIcon,
}) => {
  const normName = (name || '').toLowerCase().trim();

  // Dimensões proporcionais
  const badgeSize = Math.max(16, Math.round(size * 0.40));
  const iconSize = Math.round(size * 0.52);

  // Helper para renderizar logos oficiais com acabamento perfeito (sem bordas ou anéis artificiais)
  const renderOfficialLogo = (
    src: string,
    alt: string,
    bgColor = 'transparent',
    imgScale = '100%',
    objectFit: 'contain' | 'cover' = 'cover'
  ) => (
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
          width: imgScale,
          height: imgScale,
          objectFit,
          display: 'block',
        }}
      />
    </div>
  );

  // Renderizador específico de logos conhecidos (compatível com os prints do usuário)
  const renderBrandContent = () => {
    // 1. Netflix (Logo Oficial)
    if (normName.includes('netflix')) {
      return renderOfficialLogo(netflixImg, 'Netflix', '#000000', '100%', 'cover');
    }

    // 2. Spotify (Logo Oficial)
    if (
      normName.includes('spotify') ||
      normName.includes('spoti') ||
      normName.startsWith('spot*') ||
      normName.includes('spot ')
    ) {
      return renderOfficialLogo(spotifyImg, 'Spotify', '#1ED760', '100%', 'cover');
    }

    // 3. Amazon Prime / Prime Video (Logo Oficial) - Apenas se for explicitamente Prime Video ou Amazon Prime
    const isPrimeVideo =
      normName.includes('amazon prime video') ||
      normName.includes('amazon prime') ||
      normName.includes('prime video') ||
      normName.includes('primevideo') ||
      normName === 'prime';

    if (isPrimeVideo) {
      return renderOfficialLogo(primeVideoImg, 'Prime Video', '#00A8E1', '100%', 'cover');
    }

    // 4. Amazon (Compras / E-commerce) - Logo Oficial com a seta sorridente
    if (
      normName.includes('amazon') ||
      normName.includes('amzn') ||
      normName.startsWith('amz*') ||
      normName.startsWith('amazon*')
    ) {
      return renderOfficialLogo(amazonImg, 'Amazon', '#FFFFFF', '100%', 'cover');
    }

    // 4. Max / HBO Max (Logo Oficial)
    if (
      normName.includes('hbo') ||
      normName.includes('hbomax') ||
      normName.includes('hbo max') ||
      /\bmax\b/i.test(normName)
    ) {
      return renderOfficialLogo(maxImg, 'Max', '#000000', '100%', 'cover');
    }

    // 5. Disney+ (Logo Oficial)
    if (
      normName.includes('disney') ||
      normName.includes('disney+') ||
      normName.includes('disney plus')
    ) {
      return renderOfficialLogo(disneyPlusImg, 'Disney+', '#042442', '100%', 'cover');
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
      return renderOfficialLogo(ifoodImg, 'iFood', '#EA1D2C', '100%', 'cover');
    }

    // 9. 99 Food (Logo Oficial)
    if (
      normName.includes('99 food') ||
      normName.includes('99food') ||
      normName.includes('99_food') ||
      normName.includes('99-food') ||
      /99.*food/i.test(normName)
    ) {
      return renderOfficialLogo(app99FoodImg, '99 Food', '#FFDD00', '100%', 'cover');
    }

    // 10. 99 / 99 Corridas / 99 Pop / 99 Taxi / 99 Pay (Logo Oficial)
    const isCurrencyOrDecimal99 = /(\d+[,.]99|\br\$\s*[\d.,]+)/i.test(name);
    if (
      !isCurrencyOrDecimal99 && (
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
        /(?:^|\s)99(?:\s|$)/.test(normName)
      )
    ) {
      return renderOfficialLogo(app99Img, '99', '#F9C002', '100%', 'cover');
    }

    // 11. Uber / Uber One (Logo Oficial)
    if (normName.includes('uber')) {
      return renderOfficialLogo(uberImg, 'Uber', '#000000', '100%', 'cover');
    }

    // 10. Google / Google One (Logo Oficial)
    if (
      normName.includes('google') ||
      normName.includes('gsuite') ||
      normName.includes('workspace')
    ) {
      return renderOfficialLogo(googleImg, 'Google', '#FFFFFF', '100%', 'cover');
    }

    // 11. ChatGPT / OpenAI (Logo Oficial)
    if (
      normName.includes('chatgpt') ||
      normName.includes('chat gpt') ||
      normName.includes('openai') ||
      normName.includes('open ai')
    ) {
      return renderOfficialLogo(chatgptImg, 'ChatGPT', '#FFFFFF', '100%', 'cover');
    }

    // 12. Canva / Canva Pro (Logo Oficial)
    if (normName.includes('canva')) {
      return renderOfficialLogo(canvaImg, 'Canva', '#00C4CC', '100%', 'cover');
    }

    // 13. Meli+ (Assinatura Oficial) — inclui 'meli' sozinho
    if (
      normName.includes('meli+') ||
      normName.includes('meli plus') ||
      normName.includes('melimais') ||
      normName.includes('meli mais') ||
      normName === 'meli'
    ) {
      return renderOfficialLogo(meliPlusImg, 'Meli+', '#7E00B3', '100%', 'cover');
    }

    // 14. Mercado Livre (Compras) — apenas nomes explícitos de Mercado Livre
    if (
      normName.includes('mercado livre') ||
      normName.includes('mercadolivre') ||
      normName.startsWith('mercadolivre*') ||
      normName.startsWith('mercado*livre')
    ) {
      return renderOfficialLogo(mercadoLivreImg, 'Mercado Livre', '#FFFFFF', '100%', 'cover');
    }

    // 14b. Mercado Pago (Carteira / Banco)
    if (
      normName.includes('mercado pago') ||
      normName.includes('mercadopago') ||
      normName.startsWith('mp*') ||
      normName.startsWith('mp *')
    ) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
          }}
        >
          <BankLogo bankId="mercadopago" size={size} style={{ borderRadius: '50%' }} />
        </div>
      );
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
      return renderOfficialLogo(shopeeImg, 'Shopee', '#EE4D2D', '100%', 'cover');
    }

    // 16. Shein (Moda & E-commerce) - Logo Oficial
    if (
      normName.includes('shein') ||
      normName.includes('shien') ||
      normName.startsWith('shein*') ||
      normName.startsWith('shein ')
    ) {
      return renderOfficialLogo(sheinImg, 'Shein', '#000000', '100%', 'cover');
    }

    // 17. AliExpress (E-commerce) - Logo Oficial
    if (
      normName.includes('aliexpress') ||
      normName.includes('ali express') ||
      normName.includes('alixpress') ||
      normName.startsWith('ali*') ||
      normName.startsWith('aliexpress*')
    ) {
      return renderOfficialLogo(aliexpressImg, 'AliExpress', '#FF4713', '100%', 'cover');
    }

    // 18. McDonald's (Fast Food / Restaurante) - Logo Oficial
    if (
      normName.includes('mcdonald') ||
      normName.includes('mc donald') ||
      normName.includes('mcdonalds') ||
      normName.includes('mc donalds') ||
      normName.includes('mequi') ||
      normName.includes('méqui') ||
      normName.startsWith('mcd*') ||
      normName.startsWith('mc*') ||
      /(?:^|\s)mc(?:\s|$)/i.test(normName)
    ) {
      return renderOfficialLogo(mcdonaldsImg, "McDonald's", '#DA291C', '100%', 'cover');
    }

    // 19. Burger King (Fast Food / Restaurante) - Logo Oficial
    if (
      normName.includes('burger king') ||
      normName.includes('burgerking') ||
      normName.includes('burguer king') ||
      normName.includes('burguerking') ||
      normName.startsWith('bk*') ||
      normName.startsWith('bk ') ||
      normName.endsWith(' bk') ||
      /(?:^|\s)bk(?:\s|$)/i.test(normName)
    ) {
      return renderOfficialLogo(burgerKingImg, 'Burger King', '#FFFFFF', '100%', 'cover');
    }

    // 20. C&A (Moda & Varejo) - Logo Oficial
    if (
      normName.includes('c&a') ||
      normName.includes('c & a') ||
      normName.includes('cea') ||
      normName.includes('c and a') ||
      normName.startsWith('c&a*') ||
      normName.startsWith('cea*') ||
      /(?:^|\s)c&a(?:\s|$)/i.test(normName) ||
      /(?:^|\s)cea(?:\s|$)/i.test(normName)
    ) {
      return renderOfficialLogo(cAndAImg, 'C&A', '#000000', '100%', 'cover');
    }

    // 21. Lojas Renner (Moda & Varejo) - Logo Oficial
    if (
      normName.includes('renner') ||
      normName.includes('lojas renner') ||
      normName.includes('realize renner') ||
      normName.startsWith('renner*')
    ) {
      return renderOfficialLogo(rennerImg, 'Renner', '#E31B23', '100%', 'cover');
    }

    // 22. Riachuelo / RCHLO (Moda & Varejo) - Logo Oficial
    if (
      normName.includes('riachuelo') ||
      normName.includes('rchlo') ||
      normName.includes('midway') ||
      normName.startsWith('riachuelo*') ||
      normName.startsWith('rchlo*')
    ) {
      return renderOfficialLogo(riachueloImg, 'Riachuelo', '#000000', '100%', 'cover');
    }

    // 23. Deezer (Logo Oficial)
    if (normName.includes('deezer')) {
      return renderOfficialLogo(deezerImg, 'Deezer', '#7B16FF', '100%', 'cover');
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

    // 17. Claro / Claro Flex (Telecom) - Logo Oficial
    if (
      normName.includes('claro') ||
      normName.includes('claroflex') ||
      normName.includes('claro flex') ||
      normName.startsWith('claro*')
    ) {
      return renderOfficialLogo(claroImg, 'Claro', '#EE2323', '100%', 'cover');
    }

    // 18. Steam / Valve (Games) - Logo Oficial
    if (
      normName.includes('steam') ||
      normName.includes('valve') ||
      normName.includes('steampowered') ||
      normName.startsWith('steam*')
    ) {
      return renderOfficialLogo(steamImg, 'Steam', '#171A21', '100%', 'cover');
    }

    // 19. YouTube / YouTube Premium / YouTube Music - Logo Oficial
    if (
      normName.includes('youtube') ||
      normName.includes('you tube') ||
      normName.includes('yt premium') ||
      normName.includes('yt music') ||
      normName.startsWith('google*youtube')
    ) {
      return renderOfficialLogo(youtubeImg, 'YouTube', '#FF0000', '100%', 'cover');
    }

    // 20. TikTok / TikTok Shop (Compras & Social) - Logo Oficial
    if (
      normName.includes('tiktok') ||
      normName.includes('tik tok') ||
      normName.includes('tiktokshop') ||
      normName.includes('tiktok shop') ||
      normName.startsWith('tiktok*') ||
      normName.startsWith('tik tok*') ||
      normName.startsWith('pag*tiktok') ||
      normName.includes('bytedance')
    ) {
      return renderOfficialLogo(tiktokImg, 'TikTok', '#000000', '100%', 'cover');
    }

    // 21. Outback Steakhouse (Restaurante) - Logo Oficial
    if (
      normName.includes('outback') ||
      normName.includes('out back') ||
      normName.startsWith('outback*') ||
      normName.startsWith('out back*')
    ) {
      return renderOfficialLogo(outbackImg, 'Outback Steakhouse', '#FFFFFF', '88%', 'contain');
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

      {/* Badge Sobreposto no Canto Inferior Direito: Autor/Parceiro ou Banco */}
      {authorBadge && authorBadge.type !== 'bank' ? (
        <div
          style={{
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            borderRadius: '50%',
            backgroundColor: authorBadge.isJoint ? '#0F172A' : (authorBadge.badgeBg || '#1E293B'),
            border: '1.5px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 2,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
          }}
          title={authorBadge.isJoint ? 'Conjunto' : (authorBadge.name ? `Por ${authorBadge.name}` : undefined)}
        >
          {authorBadge.isJoint ? (
            <Users size={Math.round(badgeSize * 0.58)} color="#38BDF8" />
          ) : (
            <UserAvatar
              src={authorBadge.avatarUrl}
              name={authorBadge.name || authorBadge.initial}
              size={badgeSize}
              backgroundColor={authorBadge.badgeBg || '#1E293B'}
              textColor="#FFFFFF"
              fontSize={`${Math.max(8, Math.round(badgeSize * 0.52))}px`}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
      ) : bankId ? (
        <div
          style={{
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            borderRadius: '50%',
            backgroundColor: '#13161A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 2,
          }}
        >
          <BankLogo bankId={bankId} size={badgeSize} style={{ borderRadius: '50%', boxShadow: 'none' }} />
        </div>
      ) : null}
    </div>
  );
};

export const BrandLogo = SubscriptionLogo;
