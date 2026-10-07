import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBankCsv, ParsedCsvRow } from '../../core/parsers/csvParser';
import { parseSmartInvoiceText, parseInvoicePdf } from '../../core/parsers/smartInvoiceParser';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { MONTH_NAMES } from '../../core/installments/installmentHelper';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileText,
  FileSpreadsheet,
  PenTool,
  Loader2,
  Calendar,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccountId?: string;
  targetMonth?: number;
  targetYear?: number;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ 
  isOpen, 
  onClose,
  initialAccountId,
  targetMonth,
  targetYear
}) => {
  const { accounts, importCsvTransactions } = useFinance();
  const { colors } = useTheme();

  type ImportMode = 'pdf' | 'csv' | 'manual';
  const [importMode, setImportMode] = useState<ImportMode>('pdf');
  const [accountId, setAccountId] = useState(initialAccountId || accounts[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [manualText, setManualText] = useState('');
  // Automações executadas silenciosamente e de forma inteligente (filosofia Pierre)
  const ignoreInvoicePayments = true;
  const projectFutureInstallments = true;
  
  const [rawCsvText, setRawCsvText] = useState('');
  const [importSuccessData, setImportSuccessData] = useState<{
    count: number;
    amount: number;
    accountName: string;
    monthName?: string;
    year?: number;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialAccountId) {
      setAccountId(initialAccountId);
    }
  }, [initialAccountId, isOpen]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const isCardAccount = selectedAccount?.type === 'credit_card';

  const defaultDate = useMemo(() => {
    if (targetYear && targetMonth) {
      return `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    }
    return undefined;
  }, [targetYear, targetMonth]);

  const processCsv = (text: string, isCreditCard?: boolean) => {
    setParseError(null);
    const cardFlag = isCreditCard !== undefined ? isCreditCard : isCardAccount;
    const result = parseBankCsv(text, { 
      isCreditCard: cardFlag,
      defaultYear: targetYear,
      defaultMonth: targetMonth,
    });
    if (!result.success) {
      setParseError(result.errors.join('. ') || 'Erro ao interpretar o arquivo.');
      setParsedRows([]);
    } else {
      setParsedRows(result.rows);
    }
  };

  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
    const acc = accounts.find(a => a.id === newAccId);
    const isCard = acc?.type === 'credit_card';
    if (rawCsvText && importMode === 'csv') {
      processCsv(rawCsvText, isCard);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setRawCsvText(content);
      processCsv(content, isCardAccount);
    };
    reader.readAsText(file);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsingPdf(true);
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await parseInvoicePdf(buffer, defaultDate);
      if (rows.length === 0) {
        setParseError('Nenhuma transação identificada no PDF. Verifique se o arquivo contém o detalhamento da fatura ou use a aba "Digitar / Colar".');
        setParsedRows([]);
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setParseError(err.message || 'Erro ao processar arquivo PDF.');
      setParsedRows([]);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleProcessManualText = () => {
    if (!manualText.trim()) return;
    setParseError(null);
    const rows = parseSmartInvoiceText(manualText, defaultDate);
    if (rows.length === 0) {
      setParseError('Nenhuma transação identificada no texto. Exemplo: 12/09 iFood 45,90');
    } else {
      setParsedRows(rows);
      setFileName(`${rows.length} transações reconhecidas`);
    }
  };

  const effectiveRows = useMemo(() => {
    return parsedRows.filter(r => !ignoreInvoicePayments || !r.isInvoicePayment);
  }, [parsedRows, ignoreInvoicePayments]);

  const totalAmount = useMemo(() => {
    return effectiveRows.reduce((acc, row) => {
      const isCreditOrRefund = row.type === 'income' || row.isRefund;
      return acc + (isCreditOrRefund ? -row.amount : row.amount);
    }, 0);
  }, [effectiveRows]);

  const handleReset = () => {
    setFileName('');
    setParsedRows([]);
    setParseError(null);
    setManualText('');
    setImportSuccessData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleConfirmImport = async () => {
    if (!accountId) {
      setParseError('Selecione uma conta ou cartão de destino.');
      return;
    }
    if (parsedRows.length === 0) {
      setParseError('Nenhum lançamento identificado para importar.');
      return;
    }

    setIsImporting(true);
    setParseError(null);
    try {
      const count = await importCsvTransactions(parsedRows, accountId, {
        ignoreInvoicePayments,
        projectFutureInstallments,
      });
      setImportSuccessData({
        count,
        amount: Math.abs(totalAmount),
        accountName: selectedAccount?.name || 'Cartão Selecionado',
        monthName: targetMonth ? MONTH_NAMES[targetMonth - 1] : undefined,
        year: targetYear,
      });
    } catch (e: any) {
      setParseError(`Erro ao importar: ${e.message || 'Falha na importação'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={importSuccessData ? 'Importação Concluída' : 'Importar Fatura ou Extrato'}
      maxWidth={importSuccessData ? '500px' : '600px'}
    >
      {importSuccessData ? (
        /* ─────────────────────────────────────────────────────────────
           ESTADO DE SUCESSO: LIMPO, MINIMALISTA E DIRETO (ESTILO PIERRE)
           ───────────────────────────────────────────────────────────── */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '20px 8px 10px',
          }}
        >
          {/* Indicador refinado de sucesso */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              marginBottom: '18px',
            }}
          >
            <CheckCircle2 size={28} />
          </div>

          <div
            style={{
              fontSize: '1.24rem',
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            Importação concluída com sucesso
          </div>

          {/* Valor Monetário Hero */}
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              color: colors.textPrimary,
              letterSpacing: '-0.03em',
              marginTop: '10px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatBrlCurrency(importSuccessData.amount)}
          </div>

          {/* Microcópia conversacional em linguagem natural */}
          <p
            style={{
              fontSize: '0.90rem',
              color: colors.textSecondary,
              marginTop: '8px',
              marginBottom: '20px',
              lineHeight: 1.55,
              maxWidth: '380px',
            }}
          >
            {importSuccessData.count === 1
              ? '1 lançamento foi adicionado '
              : `${importSuccessData.count} lançamentos foram adicionados `}
            {importSuccessData.monthName
              ? `à fatura de ${importSuccessData.monthName} de ${importSuccessData.year} `
              : 'ao extrato '}
            no <strong>{importSuccessData.accountName}</strong>.
          </p>

          {fileName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                fontSize: '0.76rem',
                marginBottom: '26px',
              }}
            >
              <FileText size={13} />
              <span>{fileName}</span>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              backgroundColor: '#FFFFFF',
              color: '#0A0E0C',
              border: 'none',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
            }}
          >
            Concluir
          </Button>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           ESTADO DE SELEÇÃO E CONFIRMAÇÃO DE IMPORTAÇÃO
           ───────────────────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Contexto do Mês Selecionado */}
          {targetMonth && targetYear && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  flexShrink: 0,
                }}
              >
                <Calendar size={17} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.90rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Fatura de {MONTH_NAMES[targetMonth - 1]} de {targetYear}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                  Lançamentos importados serão vinculados a esta fatura
                </div>
              </div>
            </div>
          )}

          {/* Seleção de Conta / Cartão de Destino */}
          <div>
            <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px' }}>
              Conta ou cartão de destino
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={accountId}
                onChange={e => handleAccountChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 36px 11px 14px',
                  borderRadius: '14px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  fontSize: '0.90rem',
                  fontWeight: 600,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} style={{ backgroundColor: '#131915', color: '#FFFFFF' }}>
                    {acc.name} ({acc.type === 'credit_card' ? 'Cartão de Crédito' : 'Conta Bancária'})
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* Inputs de Upload Ocultos */}
          <input
            type="file"
            ref={pdfInputRef}
            accept=".pdf,application/pdf"
            onChange={handlePdfUpload}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Abas e Área de Seleção (quando nenhum arquivo foi selecionado) */}
          {!fileName ? (
            <>
              {/* Segmented Control - 3 opções em uma linha só: PDF | CSV | Manual */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '4px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={() => { setImportMode('pdf'); setParseError(null); }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: importMode === 'pdf' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    backgroundColor: importMode === 'pdf' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                    color: importMode === 'pdf' ? '#FFFFFF' : '#94A3B8',
                    fontWeight: importMode === 'pdf' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: importMode === 'pdf' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                  }}
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setImportMode('csv'); setParseError(null); }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: importMode === 'csv' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    backgroundColor: importMode === 'csv' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                    color: importMode === 'csv' ? '#FFFFFF' : '#94A3B8',
                    fontWeight: importMode === 'csv' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: importMode === 'csv' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                  }}
                >
                  <FileSpreadsheet size={14} />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setImportMode('manual'); setParseError(null); }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: importMode === 'manual' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    backgroundColor: importMode === 'manual' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                    color: importMode === 'manual' ? '#FFFFFF' : '#94A3B8',
                    fontWeight: importMode === 'manual' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: importMode === 'manual' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                  }}
                >
                  <PenTool size={14} />
                  <span>Manual</span>
                </button>
              </div>

              {importMode === 'pdf' ? (
                <div
                  onClick={() => !isParsingPdf && pdfInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '36px 20px',
                    borderRadius: '20px',
                    border: '1.5px dashed rgba(255, 255, 255, 0.14)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    cursor: isParsingPdf ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#CBD5E1',
                    }}
                  >
                    {isParsingPdf ? (
                      <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <UploadCloud size={22} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                      {isParsingPdf ? 'Lendo lançamentos do PDF...' : 'Toque para escolher o PDF da fatura'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '4px', maxWidth: '300px', lineHeight: 1.4 }}>
                      Reconhece compras, parcelamentos e datas automaticamente
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.70rem',
                      color: '#64748B',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    Nubank, Inter, Itaú, Bradesco, Santander, Mercado Pago e outros
                  </div>
                </div>
              ) : importMode === 'csv' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '36px 20px',
                    borderRadius: '20px',
                    border: '1.5px dashed rgba(255, 255, 255, 0.14)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#CBD5E1',
                    }}
                  >
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                      Toque para escolher o arquivo .csv
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '4px', maxWidth: '300px', lineHeight: 1.4 }}>
                      Extratos bancários e faturas em formato de planilha
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.70rem',
                      color: '#64748B',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    Formatos .CSV e .TXT suportados
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder={`Cole o texto da fatura ou digite as compras linha por linha:\n12/09 iFood 45,90\n14/09 Posto Shell 120,00\n18/09 Obramax 3x 85,46\nUber 19,90`}
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#131915',
                      color: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.55,
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleProcessManualText}
                    disabled={!manualText.trim()}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      backgroundColor: manualText.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                      color: manualText.trim() ? '#0A0E0C' : '#64748B',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: manualText.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: manualText.trim() ? '0 2px 10px rgba(0, 0, 0, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FileText size={15} />
                    <span>Identificar lançamentos</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Card Hero de Confirmação Minimalista (Sem tabela desnecessária, sem cara de IA) */
            <div
              style={{
                backgroundColor: '#131915',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Arquivo identificado e botão de troca */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <FileText size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: '0.84rem',
                      color: '#94A3B8',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title="Trocar arquivo"
                >
                  <RotateCcw size={12} />
                  <span>Trocar</span>
                </button>
              </div>

              {/* Valor Monetário Hero (Pierre: Destaque visual principal) */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#94A3B8',
                    fontWeight: 600,
                  }}
                >
                  Total identificado
                </div>
                <div
                  style={{
                    fontSize: '2.3rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF',
                    marginTop: '4px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatBrlCurrency(Math.abs(totalAmount))}
                </div>
                <div style={{ fontSize: '0.86rem', color: '#94A3B8', marginTop: '4px' }}>
                  <strong style={{ color: '#FFFFFF', fontWeight: 700 }}>
                    {effectiveRows.length} {effectiveRows.length === 1 ? 'lançamento pronto' : 'lançamentos prontos'}
                  </strong>{' '}
                  para importação em{' '}
                  <strong style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {selectedAccount?.name || 'sua conta'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de Erro se houver */}
          {parseError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#F87171',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                lineHeight: 1.45,
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <div>{parseError}</div>
            </div>
          )}

          {/* Ações (Cancelar / Confirmar Importação) */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              style={{
                borderRadius: '12px',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '0.88rem',
              }}
            >
              Cancelar
            </Button>
            {parsedRows.length > 0 ? (
              <Button
                type="button"
                variant="primary"
                disabled={effectiveRows.length === 0 || isImporting}
                onClick={handleConfirmImport}
                style={{
                  borderRadius: '12px',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  backgroundColor: '#FFFFFF',
                  color: '#0A0E0C',
                  border: 'none',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                }}
              >
                {isImporting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Importando...</span>
                  </span>
                ) : (
                  `Confirmar Importação (${effectiveRows.length})`
                )}
              </Button>
            ) : importMode === 'pdf' ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => !isParsingPdf && pdfInputRef.current?.click()}
                disabled={isParsingPdf}
                style={{
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.10)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: 'none',
                }}
              >
                {isParsingPdf ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Lendo PDF...</span>
                  </span>
                ) : (
                  'Escolher PDF'
                )}
              </Button>
            ) : importMode === 'csv' ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.10)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: 'none',
                }}
              >
                Escolher CSV
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
};
