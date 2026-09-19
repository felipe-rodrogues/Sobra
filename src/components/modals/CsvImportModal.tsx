import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBankCsv, ParsedCsvRow } from '../../core/parsers/csvParser';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { UploadCloud, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { accounts, importCsvTransactions } = useFinance();
  const { colors } = useTheme();

  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const count = await importCsvTransactions(parsedRows, accountId);
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
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
      }}
      title="Importar Extrato Bancário"
      maxWidth="600px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Seleção de Conta */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Conta Bancária de Destino *
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
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Upload de Arquivo */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Arquivo CSV do Banco
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '28px 20px',
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
              <UploadCloud size={34} color={colors.primary} />
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: colors.textPrimary }}>
                Clique para selecionar o arquivo .csv do seu banco
              </span>
              <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                Compatível com Nubank, Itaú, Bradesco, Inter, BB e outros
              </span>
            </div>
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
                    {parsedRows.length} transações identificadas
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFileName('');
                  setParsedRows([]);
                  setParseError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
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
                title="Remover arquivo"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

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

        {/* Pré-visualização da tabela */}
        {parsedRows.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.textPrimary }}>
                Pré-visualização ({parsedRows.length} linhas detectadas)
              </span>
              <Badge variant="primary" size="sm" icon={<CheckCircle2 size={12} />}>
                Válido
              </Badge>
            </div>

            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.surfaceElevated, textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary }}>Data</th>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary }}>Descrição</th>
                    <th style={{ padding: '8px 12px', color: colors.textSecondary, textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '8px 12px', color: colors.textPrimary }}>{row.date}</td>
                      <td style={{ padding: '8px 12px', color: colors.textPrimary }}>{row.description}</td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: row.type === 'income' ? colors.income : colors.expense,
                        }}
                      >
                        {row.type === 'income' ? '+' : '-'} {formatBrlCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
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
            disabled={parsedRows.length === 0 || isImporting}
            onClick={handleConfirmImport}
          >
            {isImporting ? 'Importando...' : `Confirmar Importação (${parsedRows.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
