/**
 * Data masking and formatting utilities
 */

/**
 * Mask Aadhaar number as "XXXX XXXX 1234"
 */
export function maskAadhaar(aadhaar: string | undefined | null): string {
  if (!aadhaar) return 'XXXX XXXX XXXX';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX XXXX XXXX';
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Format 12-digit Aadhaar input into "1234 5678 9012"
 */
export function formatAadhaarDisplay(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Validate 12-digit Indian Aadhaar number
 */
export function validateAadhaar(aadhaar: string): boolean {
  const clean = aadhaar.replace(/\D/g, '');
  return clean.length === 12;
}

/**
 * Validate 10-digit Indian Mobile number
 */
export function validateIndianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Format 10-digit Indian phone as "+91 98765 43210"
 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}
