// Core domain types for Jewellery Loan Management System

export type Role = 'OWNER' | 'EXECUTIVE';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  permissions?: Record<string, boolean>;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  alternate_phone?: string;
  aadhaar_last4: string;
  aadhaar_full?: string; // Only populated when authorized unmask is requested
  address: string;
  city: string;
  state: string;
  pincode: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  active_loans_count?: number;
  total_outstanding_paise?: number;
}

export type MaterialType = 'GOLD' | 'SILVER' | 'OTHER';

export type JewelleryCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'SCRAP';

export type CollateralStatus = 'PLEDGED' | 'RELEASED' | 'UNDER_DISPUTE' | 'SEIZED';

export interface CustomCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialTypeConfig {
  id: string;
  name: string;
  base_material: MaterialType;
  purity_percent: number;
  karat_or_fineness?: string;
  rate_per_gram_paise?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface JewelleryItem {
  id: string;
  loan_id?: string;
  category: string;
  custom_category?: string;
  description: string;
  material: MaterialType;
  material_type?: string;
  purity: string; // e.g. "22K", "24K", "925", "999"
  purity_percent?: number;
  gross_weight_grams: number;
  stone_weight_grams: number;
  net_weight_grams: number;
  rate_per_gram_paise: number;
  valuation_paise: number;
  max_loan_paise: number;
  allocated_loan_paise: number;
  photo_path?: string;
  condition: JewelleryCondition;
  status: CollateralStatus;
  remarks?: string;
}

export type LoanStatus = 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CLOSED' | 'CANCELLED';

export type InterestMethod = 'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'FLAT';

export interface Loan {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  loan_date: string;
  start_date: string;
  due_date: string;
  principal_paise: number;
  interest_rate_percent: number; // e.g., 2.0% per month or 24% per year
  interest_period: 'MONTHLY' | 'YEARLY' | 'DAILY';
  interest_method: InterestMethod;
  min_interest_days: number;
  grace_period_days: number;
  processing_fee_paise: number;
  other_charges_paise: number;
  principal_outstanding_paise: number;
  interest_outstanding_paise: number;
  accrued_interest_paise?: number;
  total_due_paise?: number;
  status: LoanStatus;
  ltv_percent: number;
  total_valuation_paise: number;
  is_override: boolean;
  override_reason?: string;
  backdate_reason?: string;
  import_batch_id?: string;
  remarks?: string;
  created_by: string;
  created_at: string;
  items?: JewelleryItem[];
  closed_at?: string;
  closed_by?: string;
}

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

export interface PaymentAllocation {
  interest_paid_paise: number;
  fees_paid_paise: number;
  principal_paid_paise: number;
  total_paid_paise: number;
  remaining_interest_paise: number;
  remaining_principal_paise: number;
}

export interface Payment {
  id: string;
  loan_id: string;
  payment_date: string;
  total_amount_paise: number;
  interest_paid_paise: number;
  fees_paid_paise: number;
  principal_paid_paise: number;
  payment_mode: PaymentMode;
  reference_no?: string;
  remarks?: string;
  created_by: string;
  receipt_no: string;
}

export type TransactionType =
  | 'DISBURSEMENT'
  | 'INTEREST_ACCRUAL'
  | 'REPAYMENT'
  | 'FEE_CHARGE'
  | 'PENALTY'
  | 'REVERSAL'
  | 'ADJUSTMENT'
  | 'CLOSURE';

export interface LoanTransaction {
  id: string;
  loan_id: string;
  transaction_date: string;
  type: TransactionType;
  debit_paise: number;
  credit_paise: number;
  principal_balance_paise: number;
  interest_balance_paise: number;
  payment_mode?: PaymentMode;
  reference_no?: string;
  description: string;
  created_by: string;
  is_reversal: boolean;
  reversed_transaction_id?: string;
}

export interface CustomerProfileData {
  customer: Customer;
  active_loans: Loan[];
  closed_loans: Loan[];
  total_principal_outstanding_paise: number;
  total_interest_outstanding_paise: number;
  total_other_charges_paise?: number;
  total_dues_paise?: number;
  total_repayments_paise: number;
  pledged_items: JewelleryItem[];
  recent_transactions: LoanTransaction[];
}

export interface MetalRate {
  id: string;
  material: MaterialType;
  purity: string;
  material_type?: string;
  purity_percent?: number;
  rate_per_gram_paise: number;
  effective_date: string;
  updated_by: string;
}

export interface BusinessSettings {
  business_name: string;
  tagline?: string;
  logo_url?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string;
  gst_number?: string;
  registration_number?: string;
  receipt_header?: string;
  receipt_footer?: string;
  terms_conditions?: string;
  default_interest_rate_percent: number;
  default_interest_method: InterestMethod;
  default_interest_period: 'MONTHLY' | 'YEARLY' | 'DAILY';
  default_ltv_percent: number;
  default_min_interest_days: number;
  default_grace_period_days: number;
  loan_prefix: string;
  customer_prefix: string;
  receipt_prefix: string;
  auto_backup_enabled: boolean;
  backup_folder_path?: string;
  inactivity_timeout_minutes: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  username: string;
  action: string;
  module: string;
  record_id?: string;
  previous_value?: string;
  new_value?: string;
  reason?: string;
}

export interface DailyClosingSummary {
  id: string;
  closing_date: string;
  total_disbursed_paise: number;
  total_collected_paise: number;
  cash_collected_paise: number;
  upi_collected_paise: number;
  bank_collected_paise: number;
  cheque_collected_paise: number;
  total_loans_opened: number;
  total_loans_closed: number;
  net_cash_flow_paise: number;
  closed_by: string;
  closed_at: string;
}

export interface DashboardStats {
  active_loans_count: number;
  principal_outstanding_paise: number;
  interest_outstanding_paise: number;
  other_charges_outstanding_paise?: number;
  total_dues_paise?: number;
  total_disbursed_paise: number;
  total_collected_paise: number;
  closed_loans_count: number;
  overdue_loans_count: number;
  loans_due_today: number;
  loans_due_7days: number;
  loans_due_30days: number;
  total_gold_weight_grams: number;
  total_silver_weight_grams: number;
  active_customers_count: number;
  recent_activity: AuditLog[];
}

export interface ImportBatch {
  id: string;
  file_name: string;
  total_rows: number;
  successful_loans: number;
  skipped_records: number;
  error_count: number;
  pre_backup_path?: string;
  imported_by: string;
  created_at: string;
  status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'ROLLED_BACK';
}

export interface CSVValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface CSVValidationResult {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  errors: CSVValidationError[];
  uniqueLoansCount: number;
  uniqueCustomersCount: number;
  duplicateLoansCount: number;
}

export interface CSVImportResult {
  success: boolean;
  batchId: string;
  totalRows: number;
  importedLoansCount: number;
  importedCustomersCount: number;
  skippedDuplicatesCount: number;
  errorCount: number;
  preBackupPath?: string;
  errors?: CSVValidationError[];
}
