import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBankCsv, ParsedCsvRow } from '../../core/parsers/csvParser';
import { parseSmartInvoiceText, parseInvoicePdf } from '../../core/parsers/smartInvoiceParser';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { categorizationEngine } from '../../core/categorization/categorizationEngine';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Layers, 
  CreditCard,
  FileText,
  FileSpreadsheet,
  PenTool,
  Loader2
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { accounts, categories, categoryRules, importCsvTransactions } = useFinance();
  const { colors } = useTheme();

  type ImportMode = 'pdf' | 'csv' | 'manual';
  const [importMode, setImportMode] = useState<ImportMode>('pdf');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [manualText, setManualText] = useState('');
  const [ignoreInvoicePayments, setIgnoreInvoicePayments] = useState(true);
  const [projectFutureInstallments, setProjectFutureInstallments] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const isCardAccount = selectedAccount?.type === 'credit_card';

  const hasInvoicePayments = useMemo(() => parsedRows.some(r => r.isInvoicePayment), [parsedRows]);
  const hasInstallments = useMemo(() => parsedRows.some(r => r.isInstallment), [parsedRows]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      processCsv(content);
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
      const rows = await parseInvoicePdf(buffer);
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
    const rows = parseSmartInvoiceText(manualText);
    if (rows.length === 0) {
      setParseError('Nenhuma transação identificada no texto. Exemplo: 12/09 iFood 45,90');
    } else {
      setParsedRows(rows);
      setFileName(`${rows.length} transações reconhecidas`);
    }
  };

  const processCsv = (text: string) => {
    setParseError(null);
    const result = parseBankCsv(text);
    if (!result.success) {
      setParseError(result.errors.join('. ') || 'Erro ao interpretar o arquivo.');
      setParsedRows([]);
    } else {
      setParsedRows(result.rows);
    }
  };

  const effectiveRows = useMemo(() => {
    return parsedRows.filter(r => !ignoreInvoicePayments || !r.isInvoicePayment);
  }, [parsedRows, ignoreInvoicePayments]);

  const totalAmount = useMemo(() => {
    return effectiveRows.reduce((acc, row) => acc + (row.type === 'expense' ? row.amount : -row.amount), 0);
  }, [effectiveRows]);

  const handleConfirmImport = async () => {
    if (!accountId) {
      alert('Selecione uma conta.');
      return;
    }
    if (parsedRows.length === 0) {
      alert('Nenhuma linha para importar.');
      return;
    }

    setIsImporting(true);
    try {
      const count = await importCsvTransactions(parsedRows, accountId, {
        ignoreInvoicePayments,
        projectFutureInstallments,
      });
      alert(`${count} transações importadas com sucesso!`);
      setFileName('');
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    } catch (e: any) {
      alert(`Erro ao importar: ${e.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setFileName('');
        setParsedRows([]);
        setParseError(null);
        setManualText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        onClose();
      }}
      title="Importar Fatura ou Extrato"
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Seleção de Conta */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Conta ou Cartão de Destino *
          </label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
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

        {/* Abas de Seleção de Formato de Importação */}
        {!fileName && (
          <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
          }}>
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
        )}

        {/* Conteúdo de acordo com o modo selecionado */}
        {!fileName ? (
          importMode === 'pdf' ? (
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
                {isParsingPdf ? 'Lendo e interpretando fatura em PDF...' : 'Clique para selecionar a fatura em .pdf do seu banco'}
              </span>
              <span style={{ fontSize: '0.76rem', color: colors.textSecondary, textAlign: 'center' }}>
                Lê automaticamente faturas do Nubank, Itaú, Bradesco, Inter, Santander, C6 e outros
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
                Clique para selecionar o arquivo .csv do seu banco
              </span>
              <span style={{ fontSize: '0.76rem', color: colors.textSecondary, textAlign: 'center' }}>
                Compatível com Nubank, Itaú, Bradesco, Inter, BB, C6, faturas e extratos em geral
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
                  backgroundColor: manualText.trim() ? '#9333EA' : 'rgba(255, 255, 255, 0.05)',
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
                <Sparkles size={16} />
                <span>Reconhecer Transações Automaticamente</span>
              </button>
            </div>
          )
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              backgroundColor: 'rgba(74, 222, 128, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={24} color="#4ADE80" />
              <div>
                <div style={{ fontSize: '0.90rem', fontWeight: 700, color: colors.textPrimary }}>
                  {fileName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4ADE80', marginTop: '1px', fontWeight: 600 }}>
                  {parsedRows.length} transações identificadas • Total: {formatBrlCurrency(Math.abs(totalAmount))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFileName('');
                setParsedRows([]);
                setParseError(null);
                setManualText('');
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (pdfInputRef.current) pdfInputRef.current.value = '';
              }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
              }}
              title="Remover e escolher outro"
            >
              <X size={18} />
            </button>
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

        {/* Opções Inteligentes de Importação */}
        {parsedRows.length > 0 && (hasInvoicePayments || hasInstallments) && (
          <div
            style={{
              backgroundColor: colors.surfaceElevated,
              padding: '12px 14px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color={colors.primary} />
              Ajustes Inteligentes Detectados
            </span>

            {hasInvoicePayments && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: colors.textPrimary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ignoreInvoicePayments}
                  onChange={e => setIgnoreInvoicePayments(e.target.checked)}
                  style={{ accentColor: colors.primary }}
                />
                Ignorar lançamentos de quitação da fatura anterior (ex: "Pagamento recebido")
              </label>
            )}

            {hasInstallments && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: colors.textPrimary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={projectFutureInstallments}
                  onChange={e => setProjectFutureInstallments(e.target.checked)}
                  style={{ accentColor: colors.primary }}
                />
                Projetar parcelas futuras automaticamente nos próximos meses
              </label>
            )}
          </div>
        )}

        {/* Pré-visualização rica da tabela */}
        {parsedRows.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.textPrimary }}>
                Pré-visualização ({effectiveRows.length} linhas a importar)
              </span>
              <Badge variant="primary" size="sm" icon={<CheckCircle2 size={12} />}>
                Inteligente
              </Badge>
            </div>

            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.surfaceElevated, textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary, width: '90px' }}>Data</th>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary }}>Descrição / Categoria</th>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary, textAlign: 'right', width: '110px' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => {
                    const isIgnoredPayment = row.isInvoicePayment && ignoreInvoicePayments;
                    const suggested = categorizationEngine.suggestCategory(row.cleanDescription, categories, categoryRules);

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: `1px solid ${colors.border}`,
                          opacity: isIgnoredPayment ? 0.45 : 1,
                          backgroundColor: isIgnoredPayment ? 'rgba(0,0,0,0.03)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                          {row.date}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: colors.textPrimary }}>
                              {row.cleanDescription}
                            </span>

                            {row.isInstallment && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38BDF8',
                                  fontWeight: 700,
                                }}
                              >
                                Parcela {row.installmentNumber}/{row.installmentTotal}
                              </span>
                            )}

                            {row.isInvoicePayment && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  color: '#F59E0B',
                                  fontWeight: 700,
                                }}
                              >
                                {isIgnoredPayment ? 'Pagamento (Ignorado)' : 'Pagamento de Fatura'}
                              </span>
                            )}

                            {suggested && !row.isInvoicePayment && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: `${suggested.color}20`,
                                  color: suggested.color,
                                  fontWeight: 600,
                                }}
                              >
                                {suggested.name}
                              </span>
                            )}
                          </div>

                          {row.cleanDescription !== row.description && (
                            <div style={{ fontSize: '0.70rem', color: colors.textSecondary, marginTop: '2px' }}>
                              Original: {row.description}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            color: isIgnoredPayment
                              ? colors.textSecondary
                              : row.type === 'income'
                              ? colors.income
                              : colors.expense,
                            textDecoration: isIgnoredPayment ? 'line-through' : 'none',
                          }}
                        >
                          {row.type === 'income' ? '+' : '-'} {formatBrlCurrency(row.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={effectiveRows.length === 0 || isImporting}
            onClick={handleConfirmImport}
          >
            {isImporting ? 'Importando...' : `Confirmar Importação (${effectiveRows.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
