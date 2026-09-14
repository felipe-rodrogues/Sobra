import React from 'react';

interface MarkdownViewProps {
  content: string;
}

/**
 * Renderizador leve e elegante de Markdown para as respostas da IA
 * Elimina caracteres crus como '#', '**', '*', '---' e estiliza tipografia.
 */
export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (currentList.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            style={{
              margin: '4px 0 10px 18px',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {currentList}
          </ol>
        );
      } else {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            style={{
              margin: '4px 0 10px 18px',
              padding: 0,
              listStyleType: 'disc',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {currentList}
          </ul>
        );
      }
      currentList = [];
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 1. Inline code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        tokens.push(
          <code
            key={`code-${keyIdx++}`}
            style={{
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              fontFamily: 'monospace',
              fontSize: '0.85em',
              color: '#38BDF8',
            }}
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 2. Bold + Italic: ***text***
      const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
      if (boldItalicMatch) {
        tokens.push(
          <strong key={`bi-${keyIdx++}`} style={{ fontWeight: 800, fontStyle: 'italic', color: '#FFFFFF' }}>
            {boldItalicMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldItalicMatch[0].length);
        continue;
      }

      // 3. Bold: **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        tokens.push(
          <strong key={`b-${keyIdx++}`} style={{ fontWeight: 800, color: '#FFFFFF' }}>
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 4. Italic: *text* ou _text_
      const italicMatch = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/);
      if (italicMatch) {
        tokens.push(
          <em key={`i-${keyIdx++}`} style={{ fontStyle: 'italic', color: '#CBD5E1' }}>
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // 5. Texto normal até o próximo caractere formatador
      const nextSpecial = remaining.search(/[\*`_]/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        tokens.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        tokens.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return tokens;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Linha vazia
    if (!line) {
      flushList();
      continue;
    }

    // Linha divisória horizontal: --- ou ***
    if (/^(\-{3,}|\*{3,})$/.test(line)) {
      flushList();
      elements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            margin: '12px 0',
          }}
        />
      );
      continue;
    }

    // Títulos de Markdown: # a ###### (H1 até H6, ex: '#### 1. 🛡️ Garanta...')
    const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      if (!headingText) {
        continue;
      }

      if (level === 1) {
        elements.push(
          <h2
            key={`h1-${i}`}
            style={{
              fontSize: '1.14rem',
              fontWeight: 800,
              margin: '16px 0 8px',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            {parseInline(headingText)}
          </h2>
        );
      } else if (level === 2) {
        elements.push(
          <h3
            key={`h2-${i}`}
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              margin: '14px 0 6px',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            {parseInline(headingText)}
          </h3>
        );
      } else if (level === 3) {
        elements.push(
          <h4
            key={`h3-${i}`}
            style={{
              fontSize: '0.96rem',
              fontWeight: 800,
              margin: '12px 0 4px',
              color: '#F8FAFC',
              letterSpacing: '-0.01em',
            }}
          >
            {parseInline(headingText)}
          </h4>
        );
      } else {
        // Níveis 4, 5 e 6 (ex: '#### 1. 🛡️ Garanta o pagamento...')
        elements.push(
          <h5
            key={`h${level}-${i}`}
            style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              margin: '12px 0 4px',
              color: '#F1F5F9',
              letterSpacing: '-0.01em',
            }}
          >
            {parseInline(headingText)}
          </h5>
        );
      }
      continue;
    }

    // Item de lista não ordenada: * ... ou - ...
    if (/^[\*\-]\s+/.test(line)) {
      isNumberedList = false;
      const text = line.replace(/^[\*\-]\s+/, '');
      currentList.push(
        <li
          key={`li-${i}`}
          style={{
            fontSize: '0.88rem',
            lineHeight: 1.55,
            color: '#E2E8F0',
          }}
        >
          {parseInline(text)}
        </li>
      );
      continue;
    }

    // Item de lista ordenada: 1. ... ou 2. ...
    const orderedMatch = line.match(/^\d+\.\s+(.*)/);
    if (orderedMatch) {
      isNumberedList = true;
      currentList.push(
        <li
          key={`li-ord-${i}`}
          style={{
            fontSize: '0.88rem',
            lineHeight: 1.55,
            color: '#E2E8F0',
          }}
        >
          {parseInline(orderedMatch[1])}
        </li>
      );
      continue;
    }

    // Parágrafo de texto comum
    flushList();
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '0 0 6px',
          fontSize: '0.88rem',
          lineHeight: 1.55,
          color: '#E2E8F0',
        }}
      >
        {parseInline(line.replace(/^#{1,6}\s*/, ''))}
      </p>
    );
  }

  flushList();

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
};
