import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBankCsv, ParsedCsvRow } from '../../core/parsers/csvParser';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { accounts, importCsvTransactions } = useFinance();
  const { colors } = useTheme();

  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const sampleCsv = `Data;Identificador;Valor
2026-09-02;Supermercado Pão de Açúcar;-145,20
2026-09-04;Posto Shell Combustível;-120,00
2026-09-05;TED Salário Empresa;4500,00
2026-09-07;Farmácia Drogasil;-54,90`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setCsvText(content);
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
      setCsvText('');
      setParsedRows([]);
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
      onClose={onClose}
      title="Importar Extrato em Lote (CSV)"
      subtitle="Importe transações do seu extrato bancário de forma rápida e segura"
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

        {/* Upload de Arquivo ou Área de Texto */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Arquivo CSV do Banco
          </label>

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '24px',
              borderRadius: '12px',
              border: `2px dashed ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <UploadCloud size={32} color={colors.primary} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.textPrimary }}>
              Clique para selecionar um arquivo .csv
            </span>
            <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
              Compatível com Nubank, Itaú, Bradesco, Inter e formato padrão
            </span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Opção Rápida de Colar CSV de Exemplo para Teste */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
              Ou cole o conteúdo CSV abaixo:
            </label>
            <button
              type="button"
              onClick={() => {
                setCsvText(sampleCsv);
                processCsv(sampleCsv);
              }}
              style={{ fontSize: '0.75rem', color: colors.primary, fontWeight: 600 }}
            >
              Usar CSV de Exemplo
            </button>
          </div>
          <textarea
            rows={3}
            value={csvText}
            placeholder="Data,Descrição,Valor..."
            onChange={e => {
              setCsvText(e.target.value);
              processCsv(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
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
