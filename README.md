# Jewellery Loan Management System (Offline Desktop Application)

A production-grade, desktop-first, **100% offline Jewellery Loan Management Application** designed for pawn shops, jewellery stores, and moneylenders providing loans against gold and silver jewellery collateral.

Built with **Electron 34**, **React 19**, **TypeScript**, **Tailwind CSS**, and an embedded **SQLite 3** engine (`better-sqlite3` in WAL mode).

---

## 🌟 Key Features

### 1. 100% Offline & Zero Network Exposure
- Operates entirely locally with zero cloud, CDN, telemetry, or API dependencies.
- Local SQLite database in WAL (Write-Ahead Logging) mode with foreign key integrity.
- WebContents navigation strictly isolated and external requests blocked.

### 2. Strict Financial Precision & Accounting Correctness
- **Integer Paise Representation**: All currency amounts are stored and calculated in integer paise (`₹1.00 = 100 paise`), eliminating IEEE 754 floating-point rounding errors.
- **Milligram Weight Precision**: Gross, stone, and net weights are measured and stored to 3 decimal places (`0.001g`).
- **Valuation & LTV Engine**: Multi-item valuation based on current gold/silver purity rates with configurable LTV ceilings (e.g. 75%) and owner override controls.
- **Prioritized Repayment Waterfall**: Incoming payments are strictly allocated to:
  1. Accrued Unpaid Interest
  2. Outstanding Fees / Charges
  3. Principal Reduction
- **Double-Entry Running Ledger**: Every financial event writes an immutable Debit/Credit entry. Erroneous postings are handled via compensating reversal entries (`is_reversal = 1`).

### 3. Enterprise Security & Privacy
- **Salted PBKDF2 Password Hashing**: SHA-512, 100,000 iterations, with unique 32-byte cryptographically secure salts.
- **Timing-Safe Verification**: Constant-time comparison guards against timing attacks.
- **Customer Aadhaar Encryption at Rest**: Encrypted using **AES-256-GCM** with unique initialization vectors (IV). Masked by default (`XXXX XXXX 1234`) with Owner-only unmasking that logs to an immutable audit trail.
- **Granular Role-Based Access Control**:
  - `OWNER` (Master administrator, rates manager, user manager, backup controller).
  - `EXECUTIVE` (Counter cashier, loan creator, payment collector, receipt printer).
- **Inactivity Lock**: Automatically locks the screen after 15 minutes of inactivity.

### 4. Comprehensive Operations & Workflow Tools
- **Guided 10-Step Loan Wizard**: Intuitive step-by-step workflow for loan creation with real-time valuation, net weight calculation, and LTV enforcement.
- **Spreadsheet Bulk Entry**: High-speed, keyboard-driven data grid for entering loan backlogs.
- **Instant Valuation Calculator**: Fast appraisal tool for walking-in customers.
- **Daily Register Closing (EOD)**: End-of-day tally reconciling capital disbursements, receipts by mode (Cash, UPI, Bank, Cheque), and cash drawer balance.
- **Print Isolation System**: Formatted A4 printable templates for:
  - Pawn Ticket / Pledge Voucher
  - 3-Part Payment Receipt (Customer Copy, Shop Copy, Vault Copy)
  - Loan Closure & Collateral Release Certificate
  - Customer Account Statement
  - Daily Register Closing Summary
- **Online Backup & Disaster Recovery**: SQLite native hot backups (`db.backup()`) with `PRAGMA integrity_check` verification and automatic pre-restore checkpoints.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Runtime** | Electron 34.2.0 |
| **Frontend Framework** | React 19.0.0 + TypeScript 5.7.3 |
| **Styling & Icons** | Tailwind CSS 3.4.17 + Lucide React 1.16.0 |
| **Bundler & Build Tool**| Vite 6.1.0 |
| **Local Database Engine**| SQLite 3 via `better-sqlite3` 13.0.3 (WAL mode) |
| **Cryptography** | Node.js native `crypto` (PBKDF2-SHA512, AES-256-GCM) |
| **Testing** | Vitest 3.0.5 |
| **Packaging** | Electron Builder 25.1.8 |

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v20.x or v24.x (Tested with Node v24.21.0 on Windows x64)
- npm v10+

### 1. Clone & Install
```bash
git clone https://github.com/your-repo/jewellery-loan-manager.git
cd jewellery-loan-manager
npm install
```

### 2. Run in Development Mode
In separate terminal windows:
```bash
# Terminal 1: Launch Vite React dev server
npm run dev

# Terminal 2: Compile TypeScript and start Electron
npm run dev:electron
```

### 3. Run Automated Tests
```bash
npm test
```
Runs 18 unit and integration tests verifying valuation math, currency formatting, interest accrual, repayment waterfall, ledger immutability, role-based access, and SQLite backup/restore integrity.

### 4. Build for Production
```bash
npm run build
```
Compiles both the React renderer (`tsc -b && vite build`) into `dist/` and the Electron main process (`tsc -p tsconfig.electron.json`) into `dist-electron/`.

### 5. Package Windows Executable
```bash
# Create portable unpacked directory
npm run dist:dir

# Build Windows installer (.exe)
npm run dist
```

---

## 📚 Documentation Index

Detailed reference documentation is provided in the repository:

- 📖 **[USER_MANUAL.md](file:///c:/Users/KAVYA/Desktop/Jewelery/USER_MANUAL.md)**: Operator guide for shop owners, counter executives, and cashier staff.
- 🏗️ **[DEVELOPER_GUIDE.md](file:///c:/Users/KAVYA/Desktop/Jewelery/DEVELOPER_GUIDE.md)**: Architectural documentation, IPC contracts, security model, and financial algorithms.
- 🗄️ **[DATABASE_SCHEMA.md](file:///c:/Users/KAVYA/Desktop/Jewelery/DATABASE_SCHEMA.md)**: Entity-relationship diagram, table definitions, constraints, indexes, and precision rules.

---

## 🔒 Security Best Practices for Production Deployment

1. **Hardware Storage**:
   - The SQLite database file resides in the application's local AppData directory (`%APPDATA%/jewellery-loan-manager/data/jewellery.sqlite`).
2. **External Backups**:
   - Keep daily automated backups copied onto an external USB flash drive or offline secondary drive to safeguard against hardware failure, fire, or theft.
3. **Master Password**:
   - Store the initial Owner password in a secure physical location or enterprise password vault.
