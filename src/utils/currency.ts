/**
 * Utility functions for exact currency manipulation and Indian numbering formatting.
 * All monetary amounts are internally represented as integer paise (1 INR = 100 paise)
 * to avoid floating point errors.
 */

/**
 * Format paise into Indian Rupee format, e.g. 12500000 -> ₹1,25,000.00
 */
export function formatINR(paise: number, includeDecimals = true): string {
  const rupees = (paise || 0) / 100;
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);

  const parts = absRupees.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian number grouping: last 3 digits, then groups of 2
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = includeDecimals ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  return `${isNegative ? '-' : ''}₹${result}`;
}

/**
 * Convert rupee string or number to integer paise
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    // Remove currency symbols, commas, spaces
    const clean = rupees.replace(/[₹,\s]/g, '');
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  return Math.round((rupees || 0) * 100);
}

/**
 * Convert integer paise to rupee float
 */
export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

/**
 * Format weights in grams with 3 decimal precision
 */
export function formatWeight(grams: number): string {
  return `${(grams || 0).toFixed(3)} g`;
}

/**
 * Indian Rupee to Words converter for receipts
 */
export function numberToWordsINR(amountPaise: number): string {
  const amountRupees = Math.floor(amountPaise / 100);
  if (amountRupees === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit ? ' ' + units[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += units[hundred] + ' Hundred';
      if (rest > 0) res += ' and ';
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  let num = amountRupees;
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(convertThreeDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertThreeDigits(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertThreeDigits(remainder));

  return parts.join(' ') + ' Rupees Only';
}
