import React, { useRef, useState } from 'react';
import { Printer, Download, X, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { formatINR, formatWeight, numberToWordsINR } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/dates';
import { formatPhone } from '../../utils/formatters';
import { formatItemCategory, formatItemMaterial } from '../../utils/purity';
import { BusinessSettings } from '../../types';

export type PrintDocType =
  | 'PLEDGE_RECEIPT'
  | 'PAYMENT_RECEIPT'
  | 'CLOSURE_RECEIPT'
  | 'CUSTOMER_STATEMENT'
  | 'DAILY_SUMMARY';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: PrintDocType;
  data: any;
  settings: BusinessSettings;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  settings,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printAreaRef.current) return;
    setDownloading(true);
    setDownloadSuccess(null);

    try {
      const printableContent = printAreaRef.current.innerHTML;

      // Extract existing stylesheets & style tags from head
      const stylesheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n');

      const docTitle = `${settings.business_name || 'Jewellery'} - ${type.replace(/_/g, ' ')}`;
      const safeId = data.id || data.receipt_no || (data.customer && data.customer.id) || Date.now();
      const defaultFilename = `${type.toLowerCase()}_${safeId}.pdf`;

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  ${stylesheets}
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }
    body {
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      margin: 0 !important;
      padding: 16px !important;
      font-size: 12px;
      line-height: 1.4;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    th, td {
      border: 1px solid #cbd5e1 !important;
      padding: 6px 8px !important;
    }
    th {
      background-color: #f1f5f9 !important;
      font-weight: 700 !important;
    }
  </style>
</head>
<body class="p-4 bg-white text-slate-900 font-sans">
  ${printableContent}
</body>
</html>`;

      if (window.api && window.api.system && window.api.system.downloadPDF) {
        const res = await window.api.system.downloadPDF(
          fullHtml,
          defaultFilename,
          `Save ${type.replace(/_/g, ' ')} as PDF`
        );
        if (res) {
          const pathStr = typeof res === 'string' ? res : res.filePath;
          const sizeStr = res.fileSizeBytes ? ` (${(res.fileSizeBytes / 1024).toFixed(1)} KB)` : '';
          setDownloadSuccess(`Saved: ${pathStr}${sizeStr}`);
          setTimeout(() => setDownloadSuccess(null), 5000);
        }
      } else {
        // Browser fallback: open print window
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(fullHtml);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
            printWin.close();
          }, 500);
        }
      }
    } catch (err: any) {
      alert(`Error generating PDF: ${err?.message || err}`);
    } finally {
      setDownloading(false);
    }
  };

  const isPartialPayment = type === 'PAYMENT_RECEIPT' && (data.remaining_principal_paise || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Document Preview &bull; {type.replace(/_/g, ' ')}
              </h3>
              {downloadSuccess && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {downloadSuccess}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              icon={<Download className="w-4 h-4" />}
              isLoading={downloading}
              onClick={handleDownloadPDF}
            >
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="gold"
              icon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print Document
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area (Styled for A4 / Clean Black-and-White Printing) */}
        <div
          ref={printAreaRef}
          id="printable-document"
          className="p-8 overflow-y-auto text-slate-900 font-sans print:p-0 print:m-0"
        >
          {/* Shop Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-wide text-slate-950">
              {settings.business_name}
            </h1>
            {settings.tagline && <p className="text-xs text-slate-600 italic">{settings.tagline}</p>}
            <p className="text-xs text-slate-700">
              {settings.address}, {settings.city}, {settings.state} - {settings.pincode}
            </p>
            <p className="text-xs text-slate-700 font-mono">
              Phone: {formatPhone(settings.phone)}
              {settings.gst_number && ` | GSTIN: ${settings.gst_number}`}
            </p>
          </div>

          {/* 1. Pledge Receipt / Loan Agreement */}
          {type === 'PLEDGE_RECEIPT' && (
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded border border-slate-300 font-bold">
                <span className="uppercase text-slate-800">GOLD / SILVER PLEDGE MEMORANDUM & RECEIPT</span>
                <span className="font-mono text-sm">Loan #{data.id}</span>
              </div>

              {/* Customer & Loan Date Info */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
                <div className="space-y-1">
                  <div className="text-slate-500 font-semibold uppercase text-[10px]">Borrower Details:</div>
                  <div className="font-bold text-sm text-slate-950">{data.customer_name}</div>
                  <div>Phone: {formatPhone(data.customer_phone)}</div>
                  <div>Customer ID: <span className="font-mono">{data.customer_id}</span></div>
                </div>

                <div className="space-y-1 text-right">
                  <div>
                    <span className="text-slate-500">Loan Date:</span>{' '}
                    <span className="font-mono font-bold">{formatDate(data.loan_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Maturity Date:</span>{' '}
                    <span className="font-mono font-bold">{formatDate(data.due_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Interest Rate:</span>{' '}
                    <span className="font-bold">
                      {data.interest_rate_percent}% / {data.interest_period?.toLowerCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Calculation Method:</span>{' '}
                    <span>{data.interest_method?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Collateral Table */}
              <div>
                <div className="font-bold uppercase text-slate-800 mb-1.5 text-[11px]">
                  Collateral Ornaments Pledged:
                </div>
                <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                      <th className="p-2 border-r border-slate-300">#</th>
                      <th className="p-2 border-r border-slate-300">Description</th>
                      <th className="p-2 border-r border-slate-300">Material & Karat</th>
                      <th className="p-2 border-r border-slate-300 text-right">Gross Wt</th>
                      <th className="p-2 border-r border-slate-300 text-right">Stone Wt</th>
                      <th className="p-2 border-r border-slate-300 text-right">Net Wt</th>
                      <th className="p-2 text-right">Appraised Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((itm: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-300 font-mono text-center">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-medium">
                          {formatItemCategory(itm.category, itm.custom_category)} - {itm.description}
                        </td>
                        <td className="p-2 border-r border-slate-300">
                          {formatItemMaterial(itm.material, itm.material_type, itm.purity, itm.purity_percent)}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono">
                          {formatWeight(itm.gross_weight_grams)}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-500">
                          {formatWeight(itm.stone_weight_grams)}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono font-bold">
                          {formatWeight(itm.net_weight_grams)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatINR(itm.valuation_paise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Box */}
              <div className="border border-slate-300 p-4 rounded bg-slate-50 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold">Total Principal Disbursed:</span>
                  <span className="font-mono font-black text-base text-slate-950">
                    {formatINR(data.principal_paise)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 italic">
                  Amount in words: {numberToWordsINR(data.principal_paise)}
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">TERMS & CONDITIONS:</div>
                <p className="whitespace-pre-line">{settings.terms_conditions}</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-center">
                <div className="border-t border-slate-400 pt-2 font-medium">
                  Borrower Signature / Thumbprint
                </div>
                <div className="border-t border-slate-400 pt-2 font-medium">
                  For {settings.business_name} (Authorized Signatory)
                </div>
              </div>
            </div>
          )}

          {/* 2. Payment Receipt (Full or Partial Repayment) */}
          {type === 'PAYMENT_RECEIPT' && (
            <div className="space-y-6 text-xs">
              <div
                className={`flex justify-between items-center p-2.5 rounded border font-bold ${
                  isPartialPayment
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                <span className="uppercase">
                  {isPartialPayment
                    ? 'OFFICIAL REPAYMENT RECEIPT (PARTIAL REPAYMENT)'
                    : 'OFFICIAL REPAYMENT RECEIPT (FULL SETTLEMENT)'}
                </span>
                <span className="font-mono text-sm">Receipt #{data.receipt_no}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">Loan ID:</span>{' '}
                    <span className="font-mono font-bold">{data.loan_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Customer:</span>{' '}
                    <span className="font-bold">{data.customer_name}</span>
                  </div>
                  <div>Payment Mode: <span className="font-medium">{data.payment_mode}</span></div>
                  {data.reference_no && <div>Ref / Txn ID: <span className="font-mono">{data.reference_no}</span></div>}
                </div>

                <div className="space-y-1 text-right">
                  <div>
                    <span className="text-slate-500">Payment Date:</span>{' '}
                    <span className="font-mono font-bold">{formatDate(data.payment_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Issued By:</span> {data.created_by}
                  </div>
                  <div>
                    <span className="text-slate-500">Receipt Type:</span>{' '}
                    <span className="font-bold">
                      {isPartialPayment ? 'Partial Repayment' : 'Full Settlement'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Waterfall Split Breakdown */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Allocation Head</th>
                      <th className="p-2.5 text-right">Amount Credited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5">Accrued Interest Settled (Interest First Policy)</td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-800">
                        {formatINR(data.interest_paid_paise)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Principal Balance Reduction</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatINR(data.principal_paid_paise)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-sm">
                      <td className="p-2.5">Total Amount Received</td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-950">
                        {formatINR(data.total_amount_paise)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="italic text-[11px] text-slate-600">
                Amount in words: {numberToWordsINR(data.total_amount_paise)}
              </div>

              <div
                className={`p-3 border rounded flex justify-between font-bold ${
                  isPartialPayment
                    ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                }`}
              >
                <span>Remaining Principal Balance:</span>
                <span className="font-mono text-sm">
                  {formatINR(data.remaining_principal_paise || 0)}
                  {!isPartialPayment && ' (NIL - FULLY REPAID)'}
                </span>
              </div>

              {settings.receipt_footer && (
                <p className="text-center text-[11px] text-slate-500 mt-4">{settings.receipt_footer}</p>
              )}

              <div className="grid grid-cols-2 gap-8 pt-10 text-center">
                <div className="border-t border-slate-400 pt-2 font-medium">Customer Signature</div>
                <div className="border-t border-slate-400 pt-2 font-medium">
                  Authorized Cashier / Signatory
                </div>
              </div>
            </div>
          )}

          {/* 3. Loan Closure Receipt */}
          {type === 'CLOSURE_RECEIPT' && (
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-center bg-emerald-100 p-2.5 rounded border border-emerald-300 font-bold text-emerald-950">
                <span className="uppercase">CERTIFICATE OF FULL SETTLEMENT & COLLATERAL RELEASE</span>
                <span className="font-mono text-sm">Loan #{data.id}</span>
              </div>

              <p className="text-justify text-slate-700 leading-relaxed">
                This is to certify that Loan <strong>#{data.id}</strong> availed by{' '}
                <strong>{data.customer_name}</strong> has been fully settled and closed on{' '}
                <strong>{formatDate(data.closed_at || new Date())}</strong>. All outstanding principal,
                interest, and applicable fees have been completely satisfied.
              </p>

              <div>
                <div className="font-bold uppercase text-slate-800 mb-1.5 text-[11px]">
                  Collateral Ornaments Handed Over & Released:
                </div>
                <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                      <th className="p-2 border-r border-slate-300">#</th>
                      <th className="p-2 border-r border-slate-300">Description</th>
                      <th className="p-2 border-r border-slate-300 text-right">Gross Wt</th>
                      <th className="p-2 border-r border-slate-300 text-right">Net Wt</th>
                      <th className="p-2 text-center">Release Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((itm: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-medium">
                          {formatItemCategory(itm.category, itm.custom_category)} ({itm.description})
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono">
                          {formatWeight(itm.gross_weight_grams)}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono font-bold">
                          {formatWeight(itm.net_weight_grams)}
                        </td>
                        <td className="p-2 text-center font-bold text-emerald-700">RELEASED</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs italic">
                Borrower confirmation: I acknowledge the receipt and safe return of all the above-mentioned jewellery items in satisfactory condition with no claims pending.
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 text-center">
                <div className="border-t border-slate-400 pt-2 font-medium">
                  Borrower Receipt Acknowledgment
                </div>
                <div className="border-t border-slate-400 pt-2 font-medium">
                  For {settings.business_name} (Vault Officer)
                </div>
              </div>
            </div>
          )}

          {/* 4. Customer Account Statement */}
          {type === 'CUSTOMER_STATEMENT' && (
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded border border-slate-300 font-bold">
                <span className="uppercase text-slate-800">CUSTOMER ACCOUNT STATEMENT & COLLATERAL SUMMARY</span>
                <span className="font-mono text-xs text-slate-600">Generated: {formatDate(new Date())}</span>
              </div>

              {/* Customer Profile Banner */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
                <div className="space-y-1">
                  <div className="text-slate-500 font-semibold uppercase text-[10px]">Customer Information:</div>
                  <div className="font-bold text-sm text-slate-950">{data.customer?.full_name || 'N/A'}</div>
                  <div>Phone: {formatPhone(data.customer?.phone || '')}</div>
                  <div>Customer ID: <span className="font-mono font-medium">{data.customer?.id}</span></div>
                  <div>Aadhaar: <span className="font-mono">XXXX-XXXX-{data.customer?.aadhaar_last4}</span></div>
                  <div>Address: {data.customer?.address}, {data.customer?.city}, {data.customer?.state} - {data.customer?.pincode}</div>
                </div>

                <div className="space-y-2 text-right">
                  <div className="text-slate-500 font-semibold uppercase text-[10px]">Financial Standing:</div>
                  <div className="text-xs">
                    <span className="text-slate-500">Active Loans:</span>{' '}
                    <span className="font-bold font-mono">{(data.active_loans || []).length}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Closed Loans:</span>{' '}
                    <span className="font-bold font-mono">{(data.closed_loans || []).length}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Principal Outstanding:</span>{' '}
                    <span className="font-bold font-mono">{formatINR(data.total_principal_outstanding_paise || 0)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Accrued Interest:</span>{' '}
                    <span className="font-bold font-mono text-amber-700">{formatINR(data.total_interest_outstanding_paise || 0)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-1 text-sm font-bold">
                    <span>Total Outstanding Dues:</span>{' '}
                    <span className="font-mono font-black text-rose-700">
                      {formatINR((data.total_principal_outstanding_paise || 0) + (data.total_interest_outstanding_paise || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Loans Section */}
              <div>
                <div className="font-bold uppercase text-slate-800 mb-1.5 text-[11px] flex justify-between items-center">
                  <span>Active Loan Accounts:</span>
                  <span className="text-slate-500 font-normal">{(data.active_loans || []).length} active</span>
                </div>
                <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                      <th className="p-2 border-r border-slate-300">Loan ID</th>
                      <th className="p-2 border-r border-slate-300">Disbursed</th>
                      <th className="p-2 border-r border-slate-300">Due Date</th>
                      <th className="p-2 border-r border-slate-300 text-right">Original Principal</th>
                      <th className="p-2 border-r border-slate-300 text-right">Principal Bal.</th>
                      <th className="p-2 border-r border-slate-300 text-right">Interest Bal.</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.active_loans || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-slate-500 italic">No active loans on record.</td>
                      </tr>
                    ) : (
                      (data.active_loans || []).map((l: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-300 font-mono font-semibold">{l.id}</td>
                          <td className="p-2 border-r border-slate-300 font-mono">{formatDate(l.loan_date)}</td>
                          <td className="p-2 border-r border-slate-300 font-mono">{formatDate(l.due_date)}</td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono">{formatINR(l.principal_paise)}</td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono font-bold">{formatINR(l.principal_outstanding_paise)}</td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono text-amber-700">{formatINR(l.interest_outstanding_paise)}</td>
                          <td className="p-2 text-center font-bold font-mono text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300">{l.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Collateral Ornaments in Safe Vault */}
              <div>
                <div className="font-bold uppercase text-slate-800 mb-1.5 text-[11px] flex justify-between items-center">
                  <span>Collateral Pledged in Safe Custody (Vault):</span>
                  <span className="text-slate-500 font-normal">{(data.pledged_items || []).length} items in vault</span>
                </div>
                <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                      <th className="p-2 border-r border-slate-300">#</th>
                      <th className="p-2 border-r border-slate-300">Loan ID</th>
                      <th className="p-2 border-r border-slate-300">Description</th>
                      <th className="p-2 border-r border-slate-300">Material & Karat</th>
                      <th className="p-2 border-r border-slate-300 text-right">Gross Wt</th>
                      <th className="p-2 border-r border-slate-300 text-right">Net Wt</th>
                      <th className="p-2 text-right">Appraised Valuation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pledged_items || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-slate-500 italic">No pledged items currently in custody.</td>
                      </tr>
                    ) : (
                      (data.pledged_items || []).map((itm: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-300 font-mono">{itm.loan_id}</td>
                          <td className="p-2 border-r border-slate-300 font-medium">
                            {formatItemCategory(itm.category, itm.custom_category)} - {itm.description}
                          </td>
                          <td className="p-2 border-r border-slate-300">
                            {formatItemMaterial(itm.material, itm.material_type, itm.purity, itm.purity_percent)}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono">{formatWeight(itm.gross_weight_grams)}</td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono font-bold">{formatWeight(itm.net_weight_grams)}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatINR(itm.valuation_paise)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Recent Transactions Ledger */}
              {data.recent_transactions && data.recent_transactions.length > 0 && (
                <div>
                  <div className="font-bold uppercase text-slate-800 mb-1.5 text-[11px]">
                    Recent Ledger Entries:
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Loan ID</th>
                        <th className="p-2 border-r border-slate-300">Type</th>
                        <th className="p-2 border-r border-slate-300">Description</th>
                        <th className="p-2 border-r border-slate-300 text-right">Debit</th>
                        <th className="p-2 border-r border-slate-300 text-right">Credit</th>
                        <th className="p-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_transactions.slice(0, 10).map((tx: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-300 font-mono">{formatDate(tx.transaction_date)}</td>
                          <td className="p-2 border-r border-slate-300 font-mono">{tx.loan_id}</td>
                          <td className="p-2 border-r border-slate-300 font-mono text-[10px]">{tx.transaction_type}</td>
                          <td className="p-2 border-r border-slate-300">{tx.description}</td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono text-rose-700">
                            {tx.debit_paise > 0 ? formatINR(tx.debit_paise) : '-'}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-right font-mono text-emerald-700">
                            {tx.credit_paise > 0 ? formatINR(tx.credit_paise) : '-'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            {formatINR(tx.balance_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] italic">
                Notice: This statement is an official summary of active loans and ornaments held in safe vault custody by {settings.business_name}. For any discrepancy, please contact the branch immediately.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center">
                <div className="border-t border-slate-400 pt-2 font-medium">Customer Signature / Acknowledgment</div>
                <div className="border-t border-slate-400 pt-2 font-medium">
                  For {settings.business_name} (Branch Manager)
                </div>
              </div>
            </div>
          )}

          {/* 5. Daily Summary Printout */}
          {type === 'DAILY_SUMMARY' && (
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded border border-slate-300 font-bold">
                <span className="uppercase text-slate-800">DAILY BUSINESS REGISTER SUMMARY</span>
                <span className="font-mono text-sm">Date: {formatDate(data.closing_date)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
                <div>
                  <span className="text-slate-500">Total Loans Opened Today:</span>{' '}
                  <span className="font-bold">{data.total_loans_opened}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Total Loans Closed Today:</span>{' '}
                  <span className="font-bold">{data.total_loans_closed}</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-medium">Total Capital Disbursed Today</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {formatINR(data.total_disbursed_paise)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Total Repayments Collected Today</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                        {formatINR(data.total_collected_paise)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2.5">Net Cash Flow Movement</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatINR(data.net_cash_flow_paise)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-slate-500">&bull; Cash in Hand Collected</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatINR(data.cash_collected_paise)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-slate-500">&bull; UPI Digital Collected</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatINR(data.upi_collected_paise)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-slate-500">&bull; Bank NEFT/RTGS Collected</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatINR(data.bank_collected_paise)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 text-center">
                <div className="border-t border-slate-400 pt-2 font-medium">Cashier Signature</div>
                <div className="border-t border-slate-400 pt-2 font-medium">Shop Owner Verification</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
