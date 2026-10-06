import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileDown,
  ShieldCheck,
  History,
  Coins,
  RefreshCw,
  Clock,
  Eye,
  AlertCircle,
} from 'lucide-react';
import {
  ImportBatch,
  CSVValidationError,
  CSVValidationResult,
  CSVImportResult,
} from '../types';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/dates';

interface ImportHistoricalLoansViewProps {
  onNavigateToLoans: () => void;
}

type Step = 'SELECT_FILE' | 'MAP_COLUMNS' | 'PREVIEW_VALIDATE' | 'RESULTS';

export const ImportHistoricalLoansView: React.FC<ImportHistoricalLoansViewProps> = ({
  onNavigateToLoans,
}) => {
  const [activeTab, setActiveTab] = useState<'WIZARD' | 'HISTORY'>('WIZARD');
  const [currentStep, setCurrentStep] = useState<Step>('SELECT_FILE');

  // File state
  const [fileData, setFileData] = useState<{
    fileName: string;
    filePath: string;
    content: string;
  } | null>(null);

  // Parsed CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Validation & Import options
  const [duplicateAction, setDuplicateAction] = useState<'SKIP' | 'IMPORT_AS_NEW'>('SKIP');
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // History state
  const [historyList, setHistoryList] = useState<ImportBatch[]>([]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    try {
      if (window.api) {
        const hist = await window.api.csv.getHistory();
        setHistoryList(hist || []);
      }
    } catch (err) {
      console.error('Failed to load import history:', err);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      if (!window.api) return;
      const templateContent = await window.api.csv.getTemplate();
      const savedPath = await window.api.system.saveFile(
        templateContent,
        'jewellery_historical_loans_template.csv',
        [{ name: 'CSV File', extensions: ['csv'] }]
      );
      if (savedPath) {
        alert(`Template saved to: ${savedPath}`);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to download template');
    }
  };

  const handleSelectFile = async () => {
    setError('');
    try {
      if (!window.api) return;
      const file = await window.api.csv.selectFile();
      if (!file) return;

      setLoading(true);
      const parsed = await window.api.csv.parseCSV(file.content);

      if (!parsed.rows || parsed.rows.length === 0) {
        setError('Selected CSV file is empty or contains no data rows.');
        setLoading(false);
        return;
      }

      setFileData(file);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setPreviewRows(parsed.previewRows);
      setMapping(parsed.suggestedMapping);
      setCurrentStep('MAP_COLUMNS');
    } catch (err: any) {
      setError(err?.message || 'Failed to read selected CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleRunValidation = async () => {
    setError('');
    setLoading(true);
    try {
      if (!window.api) return;
      const res = await window.api.csv.validate(csvRows, mapping, { duplicateAction });
      setValidationResult(res);
      setCurrentStep('PREVIEW_VALIDATE');
    } catch (err: any) {
      setError(err?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!fileData) return;
    setError('');
    setLoading(true);
    try {
      if (!window.api) return;
      const res = await window.api.csv.executeImport(csvRows, mapping, {
        fileName: fileData.fileName,
        duplicateAction,
      });
      setImportResult(res);
      setCurrentStep('RESULTS');
    } catch (err: any) {
      setError(err?.message || 'Import execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!validationResult || validationResult.errors.length === 0) return;
    try {
      if (!window.api) return;
      const errCsv = await window.api.csv.generateErrorCSV(validationResult.errors);
      const savedPath = await window.api.system.saveFile(
        errCsv,
        `import_errors_${Date.now()}.csv`,
        [{ name: 'CSV File', extensions: ['csv'] }]
      );
      if (savedPath) {
        alert(`Error report saved to: ${savedPath}`);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to download error report');
    }
  };

  const systemFields: { key: string; label: string; required: boolean; desc: string }[] = [
    { key: 'loan_id', label: 'Loan Reference ID', required: false, desc: 'Historical ID (multi-row grouping key)' },
    { key: 'loan_date', label: 'Loan Date (Business Date)', required: true, desc: 'DD-MM-YYYY or YYYY-MM-DD' },
    { key: 'customer_name', label: 'Customer Full Name', required: true, desc: 'Borrower legal name' },
    { key: 'customer_phone', label: 'Customer Mobile', required: true, desc: '10-digit primary mobile' },
    { key: 'customer_address', label: 'Customer Address', required: false, desc: 'Street / locality' },
    { key: 'customer_city', label: 'Customer City', required: false, desc: 'City / town' },
    { key: 'aadhaar', label: 'Aadhaar Number', required: false, desc: '12-digit number (encrypted AES-256)' },
    { key: 'material', label: 'Metal Material', required: true, desc: 'GOLD or SILVER' },
    { key: 'purity', label: 'Purity', required: true, desc: 'e.g. 22K, 24K, 18K, 925' },
    { key: 'gross_weight_grams', label: 'Gross Weight (g)', required: true, desc: 'Total ornament weight' },
    { key: 'stone_weight_grams', label: 'Stone Deductions (g)', required: false, desc: 'Stone weight (default 0)' },
    { key: 'rate_per_gram', label: 'Rate Per Gram (₹)', required: true, desc: 'Appraisal valuation rate' },
    { key: 'loan_amount', label: 'Loan Amount (₹)', required: true, desc: 'Principal disbursed for this item' },
    { key: 'interest_rate_percent', label: 'Interest Rate % / Month', required: false, desc: 'Default 2.0%' },
    { key: 'tenure_months', label: 'Tenure (Months)', required: false, desc: 'Default 6 months' },
    { key: 'disbursement_mode', label: 'Disbursement Mode', required: false, desc: 'CASH, UPI, BANK_TRANSFER, CHEQUE' },
    { key: 'remarks', label: 'Item Remarks / Description', required: false, desc: 'e.g. 2 bangles, 1 necklace' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Historical Records Import
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Import Historical Loans (CSV)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch-import historical loan registers offline into SQLite with multi-material consolidation and pre-import backup
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('WIZARD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'WIZARD'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Import Wizard
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Previous Batches
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* TAB 1: IMPORT WIZARD */}
      {activeTab === 'WIZARD' && (
        <div className="space-y-6">
          {/* Wizard Step Progress Tracker */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
            <div
              className={`p-2.5 rounded-lg border ${
                currentStep === 'SELECT_FILE'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              1. File & Template
            </div>
            <div
              className={`p-2.5 rounded-lg border ${
                currentStep === 'MAP_COLUMNS'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              2. Column Mapping
            </div>
            <div
              className={`p-2.5 rounded-lg border ${
                currentStep === 'PREVIEW_VALIDATE'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              3. Preview & Validate
            </div>
            <div
              className={`p-2.5 rounded-lg border ${
                currentStep === 'RESULTS'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              4. Batch Results
            </div>
          </div>

          {/* STEP 1: SELECT FILE & DOWNLOAD TEMPLATE */}
          {currentStep === 'SELECT_FILE' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Historical Loans CSV</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Select a local comma-separated values (.csv) file containing past jewellery loan registers
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="gold"
                    size="lg"
                    isLoading={loading}
                    icon={<UploadCloud className="w-4 h-4" />}
                    onClick={handleSelectFile}
                  >
                    Select CSV File from Computer
                  </Button>
                </div>

                {fileData && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Selected: <strong>{fileData.fileName}</strong> ({csvRows.length} rows loaded)</span>
                  </div>
                )}
              </div>

              {/* Template & Guidelines Card */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <FileSpreadsheet className="w-4 h-4" /> CSV Template & Rules
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Use our standardized template matching the aggregated material model. Multiple rows with the same <strong>loan_id</strong> will automatically merge into a single loan with multiple pledged items.
                </p>

                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Material: GOLD or SILVER</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Date formats: DD-MM-YYYY or YYYY-MM-DD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Aadhaar encrypted with AES-256-GCM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Pre-import backup generated automatically</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <Button
                    variant="outline"
                    className="w-full text-slate-200 border-slate-700 hover:bg-slate-800"
                    size="sm"
                    icon={<FileDown className="w-4 h-4 text-amber-400" />}
                    onClick={handleDownloadTemplate}
                  >
                    Download CSV Template (.csv)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAP COLUMNS */}
          {currentStep === 'MAP_COLUMNS' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Map CSV Columns</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Match fields from your uploaded file ({fileData?.fileName}) to application database fields
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  {csvHeaders.length} headers detected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {systemFields.map((field) => (
                  <div
                    key={field.key}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 max-w-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-600 font-bold">*</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">{field.desc}</div>
                    </div>

                    <select
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 shrink-0 min-w-[180px]"
                      value={mapping[field.key] || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field.key]: e.target.value })
                      }
                    >
                      <option value="">-- Do Not Map --</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setCurrentStep('SELECT_FILE')}
                >
                  Back to File
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  icon={<ArrowRight className="w-4 h-4" />}
                  onClick={handleRunValidation}
                >
                  Proceed to Preview & Validation
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {currentStep === 'PREVIEW_VALIDATE' && (
            <div className="space-y-6">
              {/* Validation Summary Metrics */}
              {validationResult && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-semibold">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-slate-400 text-[11px]">Total CSV Rows</span>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {validationResult.totalRows}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-emerald-600 text-[11px]">Valid Rows</span>
                    <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                      {validationResult.validRows}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-rose-600 text-[11px]">Invalid Rows (Errors)</span>
                    <div className="text-lg font-bold font-mono text-rose-600 mt-1">
                      {validationResult.errorRows}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-amber-600 text-[11px]">Unique Loans to Book</span>
                    <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                      {validationResult.uniqueLoansCount}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-slate-500 text-[11px]">Duplicates Detected</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                      {validationResult.duplicateLoansCount}
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate Handling Option */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Duplicate Handling Strategy
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                      duplicateAction === 'SKIP'
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dupAction"
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      checked={duplicateAction === 'SKIP'}
                      onChange={() => setDuplicateAction('SKIP')}
                    />
                    <div>
                      <div>Skip Existing Duplicates (Recommended)</div>
                      <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                        Avoids double booking if a loan ID or customer matching loan date and amount already exists
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                      duplicateAction === 'IMPORT_AS_NEW'
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dupAction"
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      checked={duplicateAction === 'IMPORT_AS_NEW'}
                      onChange={() => setDuplicateAction('IMPORT_AS_NEW')}
                    />
                    <div>
                      <div>Import as New Records (Generate New Loan IDs)</div>
                      <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                        Creates fresh loan records even if matching historical IDs are found
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error Warning Banner if Errors Found */}
              {validationResult && validationResult.errorRows > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>{validationResult.errors.length} validation errors found in CSV</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-700 border-rose-300 hover:bg-rose-100"
                      icon={<FileDown className="w-3.5 h-3.5" />}
                      onClick={handleDownloadErrors}
                    >
                      Download Error Report (.csv)
                    </Button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-rose-900 bg-white/60 p-2 rounded-lg">
                    {validationResult.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx}>
                        Row {err.row} [{err.field}]: {err.message} (Given: "{err.value}")
                      </div>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <div className="font-sans font-bold text-rose-700 pt-1">
                        + {validationResult.errors.length - 10} more errors. Download the CSV report to view all.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Preview Table (First 10 rows) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-500" /> Preview First {previewRows.length} Rows (Masked Aadhaar)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Aadhaar numbers masked with XXXX XXXX 1234 for privacy
                  </span>
                </div>

                <div className="overflow-x-auto text-xs border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Loan ID</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Customer</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Aadhaar (Masked)</th>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5">Gross (g)</th>
                        <th className="p-2.5">Rate (₹)</th>
                        <th className="p-2.5">Loan (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {row[mapping.loan_id] || '-'}
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">{row[mapping.loan_date] || '-'}</td>
                          <td className="p-2.5 font-medium text-slate-900">{row[mapping.customer_name] || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-600">{row[mapping.customer_phone] || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row[mapping.aadhaar] || '-'}</td>
                          <td className="p-2.5 font-bold text-amber-600">
                            {row[mapping.material]} {row[mapping.purity]}
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">{row[mapping.gross_weight_grams]}g</td>
                          <td className="p-2.5 font-mono text-slate-700">₹{row[mapping.rate_per_gram]}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">₹{row[mapping.loan_amount]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Safety Pre-Backup Notice */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong>Transactional Safety Guarantee:</strong> An automatic pre-import SQLite database backup will be generated immediately before writing records. All loans, customers, and ledger entries are executed in an atomic transaction.
                </div>
              </div>

              {/* Step 3 Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setCurrentStep('MAP_COLUMNS')}
                >
                  Back to Mapping
                </Button>

                <Button
                  variant="gold"
                  size="lg"
                  disabled={Boolean(validationResult && validationResult.errorRows > 0)}
                  isLoading={loading}
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  onClick={handleExecuteImport}
                >
                  Start Batch Import ({validationResult?.uniqueLoansCount || 0} Loans)
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {currentStep === 'RESULTS' && importResult && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                  Batch Reference: {importResult.batchId}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">Historical Import Completed</h2>
                <p className="text-xs text-slate-500 mt-1">
                  All loans and customers have been successfully committed to the database
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4 text-xs font-semibold">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 text-[11px]">Loans Booked</span>
                  <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                    {importResult.importedLoansCount}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <span className="text-blue-700 text-[11px]">Customers Created</span>
                  <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                    {importResult.importedCustomersCount}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px]">Duplicates Skipped</span>
                  <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
                    {importResult.skippedDuplicatesCount}
                  </div>
                </div>
              </div>

              {importResult.preBackupPath && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-600 overflow-x-auto">
                  <div className="font-sans font-bold text-slate-800 text-[11px]">Pre-Import Backup Created:</div>
                  <div className="truncate mt-0.5">{importResult.preBackupPath}</div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFileData(null);
                    setValidationResult(null);
                    setImportResult(null);
                    setCurrentStep('SELECT_FILE');
                  }}
                >
                  Import Another Batch
                </Button>
                <Button variant="gold" icon={<ArrowRight className="w-4 h-4" />} onClick={onNavigateToLoans}>
                  Go to Active Loan Register
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PREVIOUS BATCHES HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" /> Historical Import Batches Log
            </h3>
            <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadHistory}>
              Refresh
            </Button>
          </div>

          {historyList.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No historical batch imports have been executed yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Loans Imported</th>
                  <th className="py-3 px-4">Skipped</th>
                  <th className="py-3 px-4">Imported By</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.id}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{b.file_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                      {b.successful_loans}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{b.skipped_records}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{b.imported_by}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{formatDate(b.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
