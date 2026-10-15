/**
 * Configuration and state management for customizable receipt content.
 */

export interface ReceiptCustomization {
  // Business Details
  show_business_logo: boolean;
  show_business_tagline: boolean;
  show_business_address: boolean;
  show_business_phone: boolean;

  // Customer Details
  show_customer_name_id: boolean;
  show_customer_phone: boolean;
  show_customer_address: boolean;
  show_customer_aadhaar: boolean;

  // Loan Details
  show_loan_id: boolean;
  show_loan_date: boolean;
  show_due_date: boolean;
  show_interest_terms: boolean;

  // Jewellery Details
  show_item_description: boolean;
  show_custom_category: boolean;
  show_material_purity: boolean;
  show_gross_weight: boolean;
  show_stone_weight: boolean;
  show_net_weight: boolean;
  show_rate_per_gram: boolean;
  show_valuation: boolean;

  // Financial Summary
  show_principal_disbursed: boolean;
  show_amount_in_words: boolean;
  show_fees_charges: boolean;

  // Additional Information
  show_terms_conditions: boolean;
  show_customer_signature: boolean;
  show_authorized_signature: boolean;
  show_remarks: boolean;
}

export const DEFAULT_RECEIPT_CUSTOMIZATION: ReceiptCustomization = {
  // Business Details
  show_business_logo: true,
  show_business_tagline: true,
  show_business_address: true,
  show_business_phone: true,

  // Customer Details
  show_customer_name_id: true,
  show_customer_phone: true,
  show_customer_address: true,
  show_customer_aadhaar: true,

  // Loan Details
  show_loan_id: true,
  show_loan_date: true,
  show_due_date: true,
  show_interest_terms: true,

  // Jewellery Details
  show_item_description: true,
  show_custom_category: true,
  show_material_purity: true,
  show_gross_weight: true,
  show_stone_weight: true,
  show_net_weight: true,
  show_rate_per_gram: false, // Standard pledge memorandum shows appraised value; rate/gram can be toggled on
  show_valuation: true,

  // Financial Summary
  show_principal_disbursed: true,
  show_amount_in_words: true,
  show_fees_charges: true,

  // Additional Information
  show_terms_conditions: true,
  show_customer_signature: true,
  show_authorized_signature: true,
  show_remarks: true,
};

const STORAGE_KEY = 'swarna_receipt_customization_prefs_v1';

export function loadReceiptCustomization(): ReceiptCustomization {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_RECEIPT_CUSTOMIZATION };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECEIPT_CUSTOMIZATION };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_RECEIPT_CUSTOMIZATION,
      ...parsed,
    };
  } catch (err) {
    return { ...DEFAULT_RECEIPT_CUSTOMIZATION };
  }
}

export function saveReceiptCustomization(config: ReceiptCustomization): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {}
}

export function resetReceiptCustomization(): ReceiptCustomization {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {}
  return { ...DEFAULT_RECEIPT_CUSTOMIZATION };
}
