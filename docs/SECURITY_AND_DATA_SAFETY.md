# Security, Privacy, & Data Safety Architecture — SwarnaRaksha Loan Manager

**Document Version:** 1.0.0  
**Security Model:** Defense-in-Depth for Offline Desktop Deployments  
**Cryptographic Standards:** PBKDF2-SHA512 (Passwords), AES-256-GCM (Aadhaar Data)  
**Regulatory Context:** Indian Aadhaar Act & Financial Moneylending Data Protection Standards  
**Source Evidence Files:** `electron/services/cryptoService.ts`, `electron/services/authService.ts`, `electron/services/customerService.ts`, `electron/services/auditService.ts`, `electron/main.ts`  

---

## 1. Security Threat Model & Defense-in-Depth

Unlike cloud applications that defend against distributed denial-of-service (DDoS) and remote network intrusions, an offline desktop jewellery loan application operating in a physical retail pawn shop faces unique physical, insider, and local system threats:

1. **Staff Privilege Escalation & Unauthorized Access:** Counter executives attempting to perform owner-only operations (unmasking Aadhaar, altering interest rates, reversing transactions, or accessing audit logs).
2. **Physical Host Machine Compromise:** An attacker or unauthorized employee copying the local SQLite database file to steal customer identity data (Aadhaar numbers, residential addresses, pledged jewellery holdings).
3. **Financial Ledger Tampering:** Operators attempting to cover cash discrepancies by deleting past payment vouchers or altering historic loan disbursements.
4. **Data Corruption & Hardware Failure:** Sudden power outages or hardware faults during database writes causing corruption in SQLite journals.

```mermaid
flowchart TD
    subgraph Perimeter ["1. Operating System & Process Boundary"]
        AppLock["Electron Sandbox & Context Isolation"]
        NavLock["Navigation Restrictions (will-navigate lock)"]
        WindowDeny["External Window Deny (setWindowOpenHandler)"]
        InactivityTimer["15-Min Inactivity Auto-Lock Watchdog"]
    end

    subgraph Authentication ["2. Identity & Access Governance"]
        PBKDF2["PBKDF2-SHA512 Password Hashing\n(100,000 iterations, 16-byte random salt)"]
        TimingSafe["Timing-Safe Verification\n(crypto.timingSafeEqual)"]
        RBAC["Granular RBAC Engine\n(OWNER vs EXECUTIVE + user_permissions)"]
    end

    subgraph Cryptography ["3. Field-Level Data Encryption at Rest"]
        MasterKey[".vault_master.key (AES-256 Key, 0o600)"]
        AES_GCM["AES-256-GCM Encryption Engine\n(Unique 12-byte IV + 16-byte Auth Tag)"]
        Masking["Default Masking: XXXX XXXX 1234\n(Owner-Only Unmasking with Audit)"]
    end

    subgraph Accounting ["4. Financial & Audit Immutability"]
        Ledger["Double-Entry Ledger (loan_transactions)\n(Compensating Reversals Only)"]
        AuditLog["Cryptographic Audit Trail (audit_logs)\n(Append-Only, Before/After Snapshots)"]
        AtomicTx["Atomic SQLite Transactions\n(All-or-Nothing ACID Guarantees)"]
    end

    subgraph Resilience ["5. Disaster Recovery & Database Resilience"]
        WAL["SQLite WAL Mode (Write-Ahead Logging)"]
        FK["Mandatory Foreign Keys (PRAGMA foreign_keys = ON)"]
        IntegrityCheck["PRAGMA integrity_check Verification"]
        HotBackup["Hot SQLite Native Backups\n(Pre-Restore & Pre-Import Snapshots)"]
    end

    Perimeter --> Authentication
    Authentication --> Cryptography
    Cryptography --> Accounting
    Accounting --> Resilience
```

---

## 2. Authentication & Credential Security

The authentication system is implemented in `AuthService` (`electron/services/authService.ts`) and `CryptoService` (`electron/services/cryptoService.ts`).

### 2.1 Password Hashing Specification
- **Algorithm:** PBKDF2 (Password-Based Key Derivation Function 2)
- **Digest Algorithm:** `SHA-512`
- **Work Factor / Iterations:** `100,000` iterations
- **Key Length:** `64 bytes` (128 hex characters)
- **Salt Generation:** `crypto.randomBytes(16)` generating a cryptographically secure 16-byte (32-character hex) unique random salt for every user.
- **Source Evidence (`cryptoService.ts:28-32`):**
  ```typescript
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }
  ```

### 2.2 Side-Channel Timing Attack Defenses
Password verification employs constant-time buffer comparison to eliminate execution-time discrepancies that could reveal password prefixes:
```typescript
static verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  if (!storedHash || hash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}
```

### 2.3 User Enumeration Mitigation
In `authService.ts` (lines 75–84), when a login attempt provides a non-existent username, the system deliberately executes a dummy PBKDF2 hash against a fixed dummy salt before throwing an authentication error. This prevents attackers from measuring server response times to discover valid staff usernames.

### 2.4 Inactivity Session Lock
In `authService.ts` (lines 148–156), an activity watchdog tracks operator interaction:
- The renderer fires `auth:touchActivity` upon user input.
- If no activity is received within `inactivity_timeout_minutes` (default 15 minutes, configurable in `business_settings`), the session terminates automatically, logging out the user and returning to `<LoginView />`.

---

## 3. Customer Privacy & AES-256-GCM Aadhaar Encryption

In compliance with the Indian Aadhaar Act and customer privacy mandates, 12-digit Aadhaar identity numbers are **never stored in plaintext**.

### 3.1 Encryption Architecture (AES-256-GCM)
Aadhaar numbers are encrypted at rest using **AES-256 in Galois/Counter Mode (GCM)**, providing both confidentiality and cryptographic authenticity verification:

| Cryptographic Component | Specification | Purpose | Storage Column |
| :--- | :--- | :--- | :--- |
| **Algorithm** | `aes-256-gcm` | Symmetric Authenticated Encryption | N/A |
| **Master Key** | 256-bit (32 bytes) | Cryptographically generated via `crypto.randomBytes(32)` | `.vault_master.key` |
| **Initialization Vector (IV)** | 96-bit (12 bytes) | Unique random IV per customer (`crypto.randomBytes(12)`) | `customers.aadhaar_iv` |
| **Ciphertext** | Variable Hex String | Encrypted Aadhaar payload | `customers.aadhaar_encrypted` |
| **Authentication Tag** | 128-bit (16 bytes) | GCM integrity tag preventing ciphertext tampering | `customers.aadhaar_tag` |
| **Plaintext Index** | 4 Digits | Last 4 digits of Aadhaar for indexing and search | `customers.aadhaar_last4` |

### 3.2 Master Key Management
The 256-bit AES master key resides in `.vault_master.key` within the local user data folder (`%APPDATA%\jewellery-loan-manager\.vault_master.key`). It is generated upon first run and written to disk with restrictive file permissions `0o600` (readable only by the local OS user account).

### 3.3 Strict Unmasking Controls & Audit
1. **Default Masked Display:** All standard UI screens (Customer Directory, Customer Profile, Loans List, Loan Details, Search results, and printed receipts) display only the masked string: `XXXX XXXX 1234`.
2. **Owner-Only Privilege:** The IPC channel `customers:getUnmaskedAadhaar` checks `userRole === 'OWNER'`. Executives attempting to unmask an Aadhaar receive an immediate `Access Denied` exception.
3. **Mandatory Audit Logging:** Every decryption event logs an immutable entry in `audit_logs` with action `VIEW_SENSITIVE_AADHAAR`, capturing the operator username, customer ID, and timestamp.

---

## 4. Role-Based Access Control (RBAC) Matrix

The system implements two built-in roles (`OWNER` and `EXECUTIVE`) augmented by a granular permission catalog of 19 discrete actions defined in `AuthService.PERMISSIONS` (`electron/services/authService.ts`).

### 4.1 Implemented RBAC Permission Matrix

| Permission Key | Description | Owner Default | Executive Default | Customizable via `user_permissions`? | Enforced Source Location |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `VIEW_DASHBOARD` | Access real-time shop metrics and stats | **Granted** | **Granted** | Yes | `App.tsx`, `Sidebar.tsx` |
| `MANAGE_CUSTOMERS` | Register, view, and edit customer profiles | **Granted** | **Granted** | Yes | `main.ts:117-124` |
| `VIEW_FULL_AADHAAR` | Decrypt and view unmasked 12-digit Aadhaar | **Granted** | **DENIED** | No *(Hardcoded Owner check)* | `customerService.ts:121` |
| `CREATE_LOAN` | Disburse standard new pledge loans | **Granted** | **Granted** | Yes | `main.ts:190-193` |
| `OVERRIDE_LTV` | Authorize loan exceeding collateral LTV | **Granted** | **DENIED** | No *(Hardcoded Owner check)* | `loanService.ts:141` |
| `CREATE_BACKDATED_LOAN`| Book loan with historical disbursement date | **Granted** | **DENIED** | Yes *(Staff overrideable)* | `loanService.ts:71-76` |
| `RECORD_PAYMENT` | Collect cash/digital funds & issue receipts | **Granted** | **Granted** | Yes | `main.ts:202-205` |
| `CLOSE_LOAN` | Execute full settlement and release gold | **Granted** | **Granted** | Yes | `paymentService.ts:113` |
| `VIEW_LEDGER` | Inspect double-entry loan transactions | **Granted** | **Granted** | Yes | `main.ts:209` |
| `REVERSE_TRANSACTION` | Post compensating financial reversal entry | **Granted** | **DENIED** | No *(Hardcoded Owner check)* | `ledgerService.ts:30` |
| `VIEW_REPORTS` | View and export business report tables | **Granted** | **Granted** | Yes | `main.ts:224` |
| `PERFORM_DAILY_CLOSING`| Finalize and commit day-end cash register | **Granted** | **DENIED** | Yes | `dailyClosingService.ts` |
| `MANAGE_RATES` | Update gold and silver valuation rates | **Granted** | **DENIED** | Yes | `main.ts:137-140` |
| `MANAGE_SETTINGS` | Modify shop settings, terms, and prefixes | **Granted** | **DENIED** | Yes | `main.ts:228-231` |
| `MANAGE_USERS` | Create staff, reset passwords, set permissions | **Granted** | **DENIED** | No *(Owner only)* | `main.ts:94-114` |
| `BACKUP_DATABASE` | Generate manual SQLite hot backup file | **Granted** | **Granted** | Yes | `main.ts:234-237` |
| `RESTORE_DATABASE` | Overwrite live database from backup file | **Granted** | **DENIED** | No *(Owner + Password verify)* | `backupService.ts:88` |
| `VIEW_AUDIT_LOGS` | Inspect security and activity audit logs | **Granted** | **DENIED** | Yes | `main.ts:262` |
| `IMPORT_HISTORICAL_LOANS`| Perform bulk offline CSV data migrations | **Granted** | **DENIED** | Yes *(Staff overrideable)* | `main.ts:303-306` |

---

## 5. Electron Container Security Hardening

The Electron container configuration in `electron/main.ts` enforces modern desktop security guidelines:

```typescript
mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 1024,
  minHeight: 700,
  title: 'SwarnaRaksha - Jewellery Loan Management',
  backgroundColor: '#0f172a',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false, // Sandbox is enabled true in hidden PDF print window
  },
});
```

### 5.1 Context Isolation & Node Integration
- **`contextIsolation: true`:** Guarantees that the preload script and Electron internals run in an isolated execution context separate from the website DOM.
- **`nodeIntegration: false`:** Prevents renderer scripts from accessing `require()`, `process`, or native Node.js filesystem modules. An XSS vulnerability in the renderer cannot directly execute shell commands or access the host filesystem.

### 5.2 Navigation & Pop-Up Interception
- **Deny Child Windows (`main.ts:61-63`):**  
  `mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));`  
  Prevents links or scripts from opening new windows or popups.
- **Navigation Lock (`main.ts:65-69`):**  
  `mainWindow.webContents.on('will-navigate', (event, url) => { ... });`  
  Terminates any navigation directed outside `file://` or the local development server (`http://localhost:5173`).

---

## 6. Financial Ledger Immutability & Audit Trail

### 6.1 Compensating Reversal Architecture
The financial ledger in `loan_transactions` is **append-only**. Historical entries are never updated or deleted in place:
- Erroneous disbursements, fee postings, or repayments are rectified exclusively via compensating reversal entries (`type = 'REVERSAL'`).
- The reversal transaction swaps the original debit and credit amounts (`offsettingDebit = origTx.credit_paise`, `offsettingCredit = origTx.debit_paise`).
- Links to the original transaction ID via `reversed_transaction_id`.
- Requires role `OWNER` and a non-empty `reason` string.

### 6.2 Immutable Audit Trail (`audit_logs`)
Every state-altering event writes a structured log in `audit_logs`:
- **Columns:** `id`, `timestamp`, `user_id`, `username`, `action`, `module`, `record_id`, `previous_value`, `new_value`, `reason`.
- Captures before-and-after JSON snapshots for customer updates, loan creation, repayment allocations, and system settings.
- The `audit_logs` table has no delete or update routes anywhere in the application.

---

## 7. Comprehensive Security Control Verification Status

| Security Control | Implementation Mechanism | Verified Status | Evidence Location |
| :--- | :--- | :--- | :--- |
| **Password Hashing** | PBKDF2-SHA512, 100k iterations, 16B salt | **Implemented & Verified** | `cryptoService.ts`, `auth_rbac.test.ts` |
| **Timing-Safe Comparison** | `crypto.timingSafeEqual` | **Implemented & Verified** | `cryptoService.ts:40`, `auth_rbac.test.ts` |
| **Aadhaar Encryption** | AES-256-GCM authenticated cipher | **Implemented & Verified** | `cryptoService.ts:46-75`, `customerService.ts` |
| **Aadhaar UI Masking** | `XXXX XXXX 1234` default masking | **Implemented & Verified** | `cryptoService.ts:80-84`, UI views |
| **Aadhaar Unmask Control**| Restricted to Owner + Audit Log | **Implemented & Verified** | `customerService.ts:121-148` |
| **Context Isolation** | Electron `contextIsolation: true` | **Implemented & Verified** | `main.ts:39` |
| **Node Integration Disabled**| Electron `nodeIntegration: false` | **Implemented & Verified** | `main.ts:40` |
| **Navigation Restrictions** | `will-navigate` + `setWindowOpenHandler` | **Implemented & Verified** | `main.ts:61-69` |
| **LTV Ceiling Enforcement** | Owner-only override + mandatory reason | **Implemented & Verified** | `loanService.ts:133-147` |
| **Backdate Governance** | Owner or `CREATE_BACKDATED_LOAN` + reason | **Implemented & Verified** | `loanService.ts:70-80`, `backdated_and_csv.test.ts` |
| **Ledger Immutability** | Reversal transactions only (`is_reversal=1`) | **Implemented & Verified** | `ledgerService.ts`, `ledger_immutability.test.ts` |
| **Database Transactions** | `db.transaction()` for multi-table writes | **Implemented & Verified** | `loanService.ts:156`, `paymentService.ts:120` |
| **Backup Integrity Verification**| `PRAGMA integrity_check` before backup/restore| **Implemented & Verified** | `backupService.ts:23, 102`, `backup_restore.test.ts` |
| **Pre-Restore Safety Check** | Automatic `PRE_RESTORE` hot backup | **Implemented & Verified** | `backupService.ts:111`, `backup_restore.test.ts` |
| **Inactivity Auto-Lock** | 15-minute watchdog timer | **Implemented & Verified** | `authService.ts:148-156`, `AuthContext.tsx` |
| **Zero External Network** | Zero outbound HTTP calls | **Implemented & Verified** | Full codebase static audit |
| **Database Encryption at Rest** | Whole-file SQLCipher | **Not Implemented** | SQLite file is unencrypted; Aadhaar is encrypted at field level. |
