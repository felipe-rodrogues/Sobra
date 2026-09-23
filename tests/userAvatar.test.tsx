import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UserAvatar } from '../src/components/common/UserAvatar';

describe('UserAvatar', () => {
  it('renderiza as iniciais quando não há imagem', () => {
    const html = renderToString(<UserAvatar name="Felipe Rodrigues" />);
    expect(html).toContain('FR');
  });

  it('renderiza as primeiras letras quando nome simples', () => {
    const html = renderToString(<UserAvatar name="Felipe" />);
    expect(html).toContain('FE');
  });

  it('renderiza a tag img com referrerPolicy="no-referrer" quando há src', () => {
    const html = renderToString(
      <UserAvatar src="https://lh3.googleusercontent.com/a/test-photo" name="Felipe R" />
    );
    expect(html).toContain('<img');
    expect(html).toContain('src="https://lh3.googleusercontent.com/a/test-photo"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('crossorigin="anonymous"');
  });

  it('renderiza fallback "U" quando name for nulo ou vazio', () => {
    const html = renderToString(<UserAvatar name="" />);
    expect(html).toContain('U');
  });
});
