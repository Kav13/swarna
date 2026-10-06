"use strict";
/**
 * SQLite Database Schema Definition
 * Uses WAL mode, foreign keys, and indexes for fast queries on large datasets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_SQL = void 0;
exports.SCHEMA_SQL = `
-- Enforce foreign keys and WAL mode
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER', 'EXECUTIVE')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login TEXT
);

-- Granular User Permissions Table
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  is_granted INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Business Settings Table
CREATE TABLE IF NOT EXISTS business_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Metal Rates Table (Gold/Silver rates by purity with history)
CREATE TABLE IF NOT EXISTS metal_rates (
  id TEXT PRIMARY KEY,
  material TEXT NOT NULL CHECK(material IN ('GOLD', 'SILVER', 'OTHER')),
  purity TEXT NOT NULL,
  rate_per_gram_paise INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metal_rates_mat_purity ON metal_rates(material, purity, effective_date);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  aadhaar_encrypted TEXT,
  aadhaar_iv TEXT,
  aadhaar_tag TEXT,
  aadhaar_last4 TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  remarks TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_aadhaar4 ON customers(aadhaar_last4);

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  loan_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  principal_paise INTEGER NOT NULL,
  interest_rate_percent REAL NOT NULL,
  interest_period TEXT NOT NULL CHECK(interest_period IN ('MONTHLY', 'YEARLY', 'DAILY')),
  interest_method TEXT NOT NULL CHECK(interest_method IN ('MONTHLY_SIMPLE', 'DAILY_SIMPLE', 'FLAT')),
  min_interest_days INTEGER NOT NULL DEFAULT 15,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  processing_fee_paise INTEGER NOT NULL DEFAULT 0,
  other_charges_paise INTEGER NOT NULL DEFAULT 0,
  principal_outstanding_paise INTEGER NOT NULL,
  interest_outstanding_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'ACTIVE', 'PARTIALLY_PAID', 'OVERDUE', 'CLOSED', 'CANCELLED')),
  ltv_percent REAL NOT NULL,
  total_valuation_paise INTEGER NOT NULL,
  is_override INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  backdate_reason TEXT,
  import_batch_id TEXT,
  remarks TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans(created_at);

-- Custom Article Categories Table (Reusable across loans)
CREATE TABLE IF NOT EXISTS custom_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE COLLATE NOCASE NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_categories_name ON custom_categories(name);

-- Material Types & Purity Definitions Table
CREATE TABLE IF NOT EXISTS material_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_material TEXT NOT NULL CHECK(base_material IN ('GOLD', 'SILVER', 'OTHER')),
  purity_percent REAL NOT NULL,
  karat_or_fineness TEXT,
  rate_per_gram_paise INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_types_base ON material_types(base_material, is_active);

-- Loan Collateral Items Table
CREATE TABLE IF NOT EXISTS loan_items (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  category TEXT NOT NULL,
  custom_category TEXT,
  description TEXT NOT NULL,
  material TEXT NOT NULL CHECK(material IN ('GOLD', 'SILVER', 'OTHER')),
  material_type TEXT,
  purity TEXT NOT NULL,
  purity_percent REAL,
  gross_weight_grams REAL NOT NULL,
  stone_weight_grams REAL NOT NULL DEFAULT 0,
  net_weight_grams REAL NOT NULL,
  rate_per_gram_paise INTEGER NOT NULL,
  valuation_paise INTEGER NOT NULL,
  max_loan_paise INTEGER NOT NULL,
  allocated_loan_paise INTEGER NOT NULL,
  condition TEXT NOT NULL DEFAULT 'GOOD',
  status TEXT NOT NULL CHECK(status IN ('PLEDGED', 'RELEASED', 'UNDER_DISPUTE', 'SEIZED')),
  remarks TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loan_items_loan ON loan_items(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_items_status ON loan_items(status);
CREATE INDEX IF NOT EXISTS idx_loan_items_material ON loan_items(material);

-- Loan Ledger / Transactions Table (Strictly Immutable)
CREATE TABLE IF NOT EXISTS loan_transactions (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('DISBURSEMENT', 'INTEREST_ACCRUAL', 'REPAYMENT', 'FEE_CHARGE', 'PENALTY', 'REVERSAL', 'ADJUSTMENT', 'CLOSURE')),
  debit_paise INTEGER NOT NULL DEFAULT 0,
  credit_paise INTEGER NOT NULL DEFAULT 0,
  principal_balance_paise INTEGER NOT NULL,
  interest_balance_paise INTEGER NOT NULL,
  payment_mode TEXT CHECK(payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')),
  reference_no TEXT,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL,
  is_reversal INTEGER NOT NULL DEFAULT 0,
  reversed_transaction_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE INDEX IF NOT EXISTS idx_loan_tx_loan ON loan_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_tx_date ON loan_transactions(transaction_date);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  receipt_no TEXT UNIQUE NOT NULL,
  payment_date TEXT NOT NULL,
  total_amount_paise INTEGER NOT NULL,
  interest_paid_paise INTEGER NOT NULL,
  fees_paid_paise INTEGER NOT NULL,
  principal_paid_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')),
  reference_no TEXT,
  remarks TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_no);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Daily Closings Table
CREATE TABLE IF NOT EXISTS daily_closings (
  id TEXT PRIMARY KEY,
  closing_date TEXT UNIQUE NOT NULL,
  total_disbursed_paise INTEGER NOT NULL DEFAULT 0,
  total_collected_paise INTEGER NOT NULL DEFAULT 0,
  cash_collected_paise INTEGER NOT NULL DEFAULT 0,
  upi_collected_paise INTEGER NOT NULL DEFAULT 0,
  bank_collected_paise INTEGER NOT NULL DEFAULT 0,
  cheque_collected_paise INTEGER NOT NULL DEFAULT 0,
  total_loans_opened INTEGER NOT NULL DEFAULT 0,
  total_loans_closed INTEGER NOT NULL DEFAULT 0,
  net_cash_flow_paise INTEGER NOT NULL DEFAULT 0,
  closed_by TEXT NOT NULL,
  closed_at TEXT NOT NULL
);

-- Immutable Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);

-- Backups Metadata Table
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  backup_path TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK(backup_type IN ('MANUAL', 'AUTOMATIC', 'PRE_RESTORE')),
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Historical Loans Import Batches
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_loans INTEGER NOT NULL,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  pre_backup_path TEXT,
  imported_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'ROLLED_BACK'))
);

CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at);
`;
