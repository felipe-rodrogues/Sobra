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
  const [ignoreInvoicePayments, setIgnoreInvoicePayments] = useState(true);
  const [projectFutureInstallments, setProjectFutureInstallments] = useState(true);
  
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

  const hasInvoicePayments = useMemo(() => parsedRows.some(r => r.isInvoicePayment), [parsedRows]);
  const hasInstallments = useMemo(() => parsedRows.some(r => r.isInstallment), [parsedRows]);

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
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981',
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
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            Concluir
          </Button>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           ESTADO DE SELEÇÃO E CONFIRMAÇÃO DE IMPORTAÇÃO
           ───────────────────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Contexto do Mês Selecionado */}
          {targetMonth && targetYear && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(192, 132, 252, 0.08)',
                border: '1px solid rgba(192, 132, 252, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(192, 132, 252, 0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#C084FC',
                  }}
                >
                  <Calendar size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Fatura de {MONTH_NAMES[targetMonth - 1]} de {targetYear}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                    Reconhecendo lançamentos para este período
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#C084FC',
                  backgroundColor: 'rgba(192, 132, 252, 0.15)',
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  border: '1px solid rgba(192, 132, 252, 0.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                Mês Ativo
              </span>
            </div>
          )}

          {/* Seleção de Conta / Cartão de Destino */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', color: colors.textSecondary, marginBottom: '6px' }}>
              Conta ou Cartão de Destino *
            </label>
            <select
              value={accountId}
              onChange={e => handleAccountChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.92rem',
              }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'credit_card' ? 'Cartão de Crédito' : 'Conta Bancária'})
                </option>
              ))}
            </select>
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
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '4px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => { setImportMode('pdf'); setParseError(null); }}
                  style={{
                    flex: 1,
                    padding: '9px 6px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: importMode === 'pdf' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                    color: importMode === 'pdf' ? '#C084FC' : colors.textSecondary,
                    fontWeight: importMode === 'pdf' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={15} />
                  <span>Fatura PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setImportMode('csv'); setParseError(null); }}
                  style={{
                    flex: 1,
                    padding: '9px 6px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: importMode === 'csv' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                    color: importMode === 'csv' ? '#C084FC' : colors.textSecondary,
                    fontWeight: importMode === 'csv' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Extrato CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setImportMode('manual'); setParseError(null); }}
                  style={{
                    flex: 1,
                    padding: '9px 6px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: importMode === 'manual' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                    color: importMode === 'manual' ? '#C084FC' : colors.textSecondary,
                    fontWeight: importMode === 'manual' ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PenTool size={15} />
                  <span>Digitar / Colar</span>
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
                    gap: '10px',
                    padding: '32px 20px',
                    borderRadius: '14px',
                    border: `2px dashed ${colors.border}`,
                    backgroundColor: colors.surfaceElevated,
                    cursor: isParsingPdf ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#C084FC';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  {isParsingPdf ? (
                    <Loader2 size={36} color="#C084FC" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <FileText size={36} color="#C084FC" />
                  )}
                  <span style={{ fontSize: '0.94rem', fontWeight: 600, color: colors.textPrimary }}>
                    {isParsingPdf ? 'Lendo e interpretando fatura em PDF...' : 'Selecione a fatura em PDF do seu banco'}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: colors.textSecondary, textAlign: 'center' }}>
                    Compatível com Nubank, Itaú, Bradesco, Inter, Santander, C6, Mercado Pago e outros
                  </span>
                </div>
              ) : importMode === 'csv' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '32px 20px',
                    borderRadius: '14px',
                    border: `2px dashed ${colors.border}`,
                    backgroundColor: colors.surfaceElevated,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = colors.primary;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <UploadCloud size={36} color={colors.primary} />
                  <span style={{ fontSize: '0.94rem', fontWeight: 600, color: colors.textPrimary }}>
                    Selecione o arquivo .csv do seu banco
                  </span>
                  <span style={{ fontSize: '0.76rem', color: colors.textSecondary, textAlign: 'center' }}>
                    Compatível com extratos e faturas em CSV
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder={`Cole o texto da fatura ou digite as compras linha por linha:\n12/09 iFood 45,90\n14/09 Posto Shell 120,00\n18/09 Obramax 3x 85,46\nUber 19,90`}
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceElevated,
                      color: colors.textPrimary,
                      fontSize: '0.86rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.5,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleProcessManualText}
                    disabled={!manualText.trim()}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '10px',
                      backgroundColor: manualText.trim() ? colors.primary : 'rgba(255, 255, 255, 0.05)',
                      color: manualText.trim() ? '#FFFFFF' : colors.textSecondary,
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.86rem',
                      cursor: manualText.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FileText size={16} />
                    <span>Identificar Lançamentos</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Card Hero de Confirmação Minimalista (Sem tabela desnecessária, sem cara de IA) */
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Arquivo identificado e botão de troca */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <FileText size={16} color={colors.textSecondary} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: '0.84rem',
                      color: colors.textSecondary,
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
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                  }}
                  title="Remover e escolher outro arquivo"
                >
                  <X size={14} />
                  <span>Trocar</span>
                </button>
              </div>

              {/* Valor Monetário Hero (Pierre: Destaque visual principal) */}
              <div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: colors.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  Total da fatura identificado
                </div>
                <div
                  style={{
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.textPrimary,
                    marginTop: '4px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatBrlCurrency(Math.abs(totalAmount))}
                </div>
                <div style={{ fontSize: '0.86rem', color: colors.textSecondary, marginTop: '4px' }}>
                  <strong style={{ color: colors.textPrimary, fontWeight: 600 }}>
                    {effectiveRows.length} lançamentos
                  </strong>{' '}
                  prontos para importação em{' '}
                  <strong style={{ color: colors.textPrimary, fontWeight: 600 }}>
                    {selectedAccount?.name || 'sua conta'}
                  </strong>
                </div>
              </div>

              {/* Opções silenciosas e funcionais - sem IA, sem estrelas */}
              {(hasInvoicePayments || hasInstallments) && (
                <div
                  style={{
                    paddingTop: '14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {hasInvoicePayments && (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.82rem',
                        color: colors.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ignoreInvoicePayments}
                        onChange={e => setIgnoreInvoicePayments(e.target.checked)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>Ignorar lançamentos de quitação da fatura anterior</span>
                    </label>
                  )}

                  {hasInstallments && (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.82rem',
                        color: colors.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={projectFutureInstallments}
                        onChange={e => setProjectFutureInstallments(e.target.checked)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>Projetar parcelas futuras automaticamente nos próximos meses</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mensagem de Erro se houver */}
          {parseError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: colors.budgetDangerBg,
                border: `1px solid ${colors.budgetDanger}`,
                color: colors.budgetDanger,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              {parseError}
            </div>
          )}

          {/* Ações (Cancelar / Confirmar Importação) */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={effectiveRows.length === 0 || isImporting}
              onClick={handleConfirmImport}
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
          </div>
        </div>
      )}
    </Modal>
  );
};
