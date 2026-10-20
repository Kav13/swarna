# Known Limitations, Architectural Risks, & Engineering Recommendations — SwarnaRaksha Loan Manager

**Document Version:** 1.0.0  
**Inspection Date:** October 2026  
**Auditor Classification:** Software Architecture, Database Engineering, Application Security, Financial Accounting  
**Source Evidence Base:** Complete Static Codebase Analysis & Runtime Behavior Verification  

---

## 1. Executive Summary

This document identifies architectural trade-offs, security limitations, edge cases, and technical debt discovered during deep inspection of the SwarnaRaksha codebase. 

Importantly, **none of these findings prevent normal single-workstation pawn shop operation**—the application functions reliably as an offline desktop tool. However, addressing these items will harden enterprise deployments, enable multi-counter scalability, and eliminate potential accounting edge cases.

---

## 2. Prioritized Findings & Recommendations Matrix

| ID | Issue Description | Domain Category | Severity | Operational Risk | Recommended Remediation |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **SEC-01** | Master Encryption Key Stored in Plaintext File | Application Security | **HIGH** | Local admin user can read `.vault_master.key` and decrypt all customer Aadhaar numbers. | Bind key to Windows DPAPI / Electron `safeStorage` API. |
| **FIN-01** | Transaction Reversal Does Not Mutate Loan Balances | Financial Ledger | **HIGH** | Reversing a payment inserts an offsetting ledger transaction but leaves `loans.principal_outstanding_paise` unchanged. | Atomically recalculate and update `loans` table balances upon reversal. |
| **DAT-01** | Single-Workstation SQLite Concurrency Boundary | Architecture / Scalability | **MEDIUM** | SQLite cannot safely coordinate concurrent multi-user writes across separate physical computers on a LAN. | Retain SQLite for single-terminal shops; introduce client-server mode (e.g. PostgreSQL) for multi-counter shops. |
| **SEC-02** | Unencrypted Database at Rest (Non-Aadhaar Data) | Data Protection | **MEDIUM** | Customer names, mobile numbers, loan balances, and vault holdings are unencrypted in SQLite file. | Implement SQLCipher for transparent whole-database AES-256 encryption. |
| **OPS-01** | Sole Reliance on Local / USB Manual Backups | Disaster Recovery | **MEDIUM** | Physical theft, hardware failure, or fire destroying the host computer causes total data loss if USB backup is neglected. | Provide automated reminder prompts and optional encrypted off-site cloud sync. |
| **UI-01** | Inconsistent "Total Dues" Formula Across Views | Accounting Precision | **LOW** | `LoanDetailsView` omits `other_charges_paise` while Dashboard and Loans List include it. | Standardize `total_due_paise` calculation across all views via a shared utility function. |
| **PERF-01**| Monolithic Frontend Bundle Size (>500 KB) | Build & Performance | **LOW** | Vite generates a single 591 KB minified chunk triggering rollup size warnings. | Implement `React.lazy()` code-splitting for heavy views (`ImportHistoricalLoansView`, `AuditLogsView`). |

---

## 3. Detailed Technical Analysis of Limitations

### 3.1 SEC-01: Master Encryption Key Storage (`.vault_master.key`)
- **Current Implementation:**  
  In `electron/services/cryptoService.ts` (lines 9–22), `getMasterKey()` generates a 256-bit random key and writes it directly to `%APPDATA%\jewellery-loan-manager\.vault_master.key` using Node.js filesystem permissions (`mode: 0o600`).
- **Limitation & Risk:**  
  On Windows NTFS filesystems, POSIX mode `0o600` is mapped imperfectly to Windows ACLs. Any software running under the same Windows user account—or an operator with administrative rights—can open `.vault_master.key` and decrypt the entire `customers` table.
- **Architectural Recommendation:**  
  Replace direct filesystem storage with Electron's native `safeStorage.encryptString()` / `safeStorage.decryptString()` API, which binds the encryption key to the Windows Cryptographic DPAPI (Data Protection API) tied to the machine's hardware TPM and login credentials.

---

### 3.2 FIN-01: Financial Ledger Reversal State Synchronization
- **Current Implementation:**  
  In `electron/services/ledgerService.ts` (lines 23–94), when an Owner authorizes a transaction reversal:
  1. A new record is inserted into `loan_transactions` with `type = 'REVERSAL'`, swapping the debit and credit figures.
  2. The original transaction is updated with `is_reversal = 1`.
  3. An entry is recorded in `audit_logs`.
- **Limitation & Risk:**  
  The function does **not** update the target row in the `loans` table! For instance, if an erroneous payment of ₹20,000 that reduced `loans.principal_outstanding_paise` from ₹1,00,000 to ₹80,000 is reversed, the ledger accurately shows the offsetting reversal credit, but `loans.principal_outstanding_paise` remains at ₹80,000!
- **Architectural Recommendation:**  
  Wrap `reverseTransaction` in a comprehensive state-recalculation transaction that re-aggregates active payments and interest accruals, atomically restoring `principal_outstanding_paise`, `interest_outstanding_paise`, and `status` in the `loans` table.

---

### 3.3 DAT-01: Concurrency Limits of Single-File SQLite
- **Current Implementation:**  
  The application utilizes `better-sqlite3` embedded locally in the Electron main process.
- **Limitation & Risk:**  
  In a shop with multiple cashier terminals (e.g. Terminal 1 for loan disbursements, Terminal 2 for repayment collections, Terminal 3 for vault auditing), sharing a single `.sqlite` file over a Windows network share (SMB) risks database locking timeouts and potential journal corruption.
- **Architectural Recommendation:**  
  For multi-terminal jewellery stores, introduce a dual-mode persistence architecture:
  - **Single-User Mode (Current):** Embedded SQLite for standalone counter laptops.
  - **Multi-Counter Network Mode:** Configurable PostgreSQL / Headless REST server backend allowing multiple cashiers to read and write concurrently over a secure local area network.

---

### 3.4 UI-01: Inconsistency in "Total Outstanding Dues" Formula
- **Current Implementation:**  
  - In `LoanService.getLoans()` (lines 427–430) and `ReportService.getDashboardStats()` (line 41):  
    $$\text{Total Dues} = \text{Principal Outstanding} + \text{Accrued Interest} + \text{Other Charges}$$
  - In `LoanDetailsView.tsx` (line 124):  
    $$\text{Total Dues} = \text{Principal Outstanding} + \text{Accrued Interest}$$
- **Limitation & Impact:**  
  If a loan has documentation or processing charges stored in `loans.other_charges_paise`, the Loan Details screen displays a total dues figure that is slightly lower than the figure displayed in the Loan Directory and Dashboard.
- **Architectural Recommendation:**  
  Export a unified `calculateTotalLoanDues(loan, accruedInterest)` function from `src/utils/currency.ts` and bind all views to the identical calculation.

---

### 3.5 PERF-01: Monolithic Frontend Bundle Size
- **Current Implementation:**  
  Vite compiles all 18 views and components into a single JavaScript asset: `dist/assets/index-*.js` (591.11 KB uncompressed, 143.81 KB gzip).
- **Limitation & Impact:**  
  Vite issues a warning during build: *"Some chunks are larger than 500 kB after minification"*. While 591 KB loads in under 50ms on modern desktop CPUs, bundling infrequently used administrative screens (like Historical CSV Import and Audit Trail) with daily counter views increases initial memory footprint.
- **Architectural Recommendation:**  
  Use React dynamic imports (`React.lazy()`) in `src/App.tsx` for heavy views:
  ```typescript
  const ImportHistoricalLoansView = React.lazy(() => import('./views/ImportHistoricalLoansView'));
  const AuditLogsView = React.lazy(() => import('./views/AuditLogsView'));
  const BackupRestoreView = React.lazy(() => import('./views/BackupRestoreView'));
  ```

---

## 4. Operational Risk Mitigation Strategies

For shop owners operating SwarnaRaksha today, the following procedural safeguards are recommended:

1. **Daily USB Flash Drive Rotation:**  
   Maintain three separate USB flash drives labeled *Monday/Thursday*, *Tuesday/Friday*, and *Wednesday/Saturday*. Use SwarnaRaksha's **Choose Destination Folder** feature in the Backup screen to save daily backups onto the rotating flash drive, and store the drive off-premises.
2. **Dedicated Store Workstation Account:**  
   Run SwarnaRaksha on a dedicated Windows standard user account rather than a full Administrator account, preventing unauthorized software installation or file tampering.
3. **Restricted Owner Password Sharing:**  
   Never share the master Owner password with counter staff. Cashiers should be issued `EXECUTIVE` accounts with only the permissions required for counter operations (Pledge creation, Repayments, Customer registration).
