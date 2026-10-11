import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BrandLogo } from '../src/components/common/BrandLogo';
import { MerchantCleaner } from '../src/core/categorization/merchantCleaner';

describe('Novos Ícones de Grandes Lojas e Redes', () => {
  const cleaner = new MerchantCleaner();

  it('deve renderizar os logos oficiais das 7 novas marcas fornecidas pelo usuário', () => {
    const brands = [
      { name: 'Shein', alt: 'Shein' },
      { name: 'AliExpress', alt: 'AliExpress' },
      { name: "McDonald's", alt: "McDonald's" },
      { name: 'Burger King', alt: 'Burger King' },
      { name: 'C&A', alt: 'C&A' },
      { name: 'Renner', alt: 'Renner' },
      { name: 'Riachuelo', alt: 'Riachuelo' },
    ];

    brands.forEach(({ name, alt }) => {
      const html = renderToString(<BrandLogo name={name} size={44} />);
      const normalizedHtml = html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
      expect(normalizedHtml).toContain(`alt="${alt}"`);
    });
  });

  it('deve reconhecer variações e nomes brutos de fatura para as marcas', () => {
    const variations = [
      { raw: 'SHEIN*BR', alt: 'Shein' },
      { raw: 'ALIEXPRESS*PEDIDO', alt: 'AliExpress' },
      { raw: 'MC DONALDS SHOPPING', alt: "McDonald's" },
      { raw: 'MEQUI DRIVE', alt: "McDonald's" },
      { raw: 'BURGER KING CENTRO', alt: 'Burger King' },
      { raw: 'BK BRASIL', alt: 'Burger King' },
      { raw: 'LOJAS CEA', alt: 'C&A' },
      { raw: 'C&A MODAS', alt: 'C&A' },
      { raw: 'LOJAS RENNER BR', alt: 'Renner' },
      { raw: 'RCHLO RIACHUELO', alt: 'Riachuelo' },
    ];

    variations.forEach(({ raw, alt }) => {
      const html = renderToString(<BrandLogo name={raw} size={44} />);
      const normalizedHtml = html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
      expect(normalizedHtml).toContain(`alt="${alt}"`);
    });
  });

  it('MerchantCleaner deve padronizar nomes dessas grandes marcas', () => {
    expect(cleaner.clean('aliexpress')).toBe('AliExpress');
    expect(cleaner.clean('mcdonalds')).toBe("McDonald's");
    expect(cleaner.clean('burger king')).toBe('Burger King');
    expect(cleaner.clean('c&a')).toBe('C&A');
    expect(cleaner.clean('renner')).toBe('Renner');
    expect(cleaner.clean('riachuelo')).toBe('Riachuelo');
    expect(cleaner.clean('rchlo')).toBe('Riachuelo');
  });
});
