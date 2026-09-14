import React, { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeftRight } from 'lucide-react';

interface QuickActionPillsProps {
  onAddIncome: () => void;
  onAddExpense: () => void;
  onTransfer: () => void;
}

export const QuickActionPills: React.FC<QuickActionPillsProps> = ({
  onAddIncome,
  onAddExpense,
  onTransfer,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragDistanceRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    dragDistanceRef.current = 0;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    dragDistanceRef.current = Math.abs(walk);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleButtonClick = (action: () => void) => {
    // Se arrastou mais de 5px, considera drag e não aciona o clique acidental
    if (dragDistanceRef.current > 5) return;
    action();
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        margin: '2px 0 6px 0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingBottom: '4px',
        paddingTop: '2px',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Botão Receita */}
      <button
        type="button"
        onClick={() => handleButtonClick(onAddIncome)}
        className="pill-action-btn"
        style={{
          flex: '1 0 auto',
          minWidth: 'fit-content',
          padding: '9px 12px',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
        }}
        title="Registrar nova receita"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            color: '#4ADE80',
            flexShrink: 0,
          }}
        >
          <ArrowUp size={12} strokeWidth={2.8} />
        </div>
        <span>Receita</span>
      </button>

      {/* Botão Despesa */}
      <button
        type="button"
        onClick={() => handleButtonClick(onAddExpense)}
        className="pill-action-btn"
        style={{
          flex: '1 0 auto',
          minWidth: 'fit-content',
          padding: '9px 12px',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
        }}
        title="Registrar nova despesa"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(244, 63, 94, 0.2)',
            color: '#FB7185',
            flexShrink: 0,
          }}
        >
          <ArrowDown size={12} strokeWidth={2.8} />
        </div>
        <span>Despesa</span>
      </button>

      {/* Botão Transferir */}
      <button
        type="button"
        onClick={() => handleButtonClick(onTransfer)}
        className="pill-action-btn"
        style={{
          flex: '1 0 auto',
          minWidth: 'fit-content',
          padding: '9px 12px',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
        }}
        title="Transferir entre contas"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            color: '#38BDF8',
            flexShrink: 0,
          }}
        >
          <ArrowLeftRight size={12} strokeWidth={2.8} />
        </div>
        <span>Transferir</span>
      </button>
    </div>
  );
};
