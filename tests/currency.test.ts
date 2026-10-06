import { describe, it, expect } from 'vitest';
import { formatINR, rupeesToPaise, paiseToRupees, numberToWordsINR } from '../src/utils/currency';

describe('Currency & Indian Number Formatting Utilities', () => {
  it('correctly formats paise into Indian Rupee format with lakhs and crores grouping', () => {
    expect(formatINR(10000)).toBe('₹100.00');
    expect(formatINR(12500000)).toBe('₹1,25,000.00');
    expect(formatINR(1000000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    expect(formatINR(7550, true)).toBe('₹75.50');
  });

  it('converts rupee strings and numbers to integer paise accurately', () => {
    expect(rupeesToPaise('₹1,25,000.50')).toBe(12500050);
    expect(rupeesToPaise(125000.5)).toBe(12500050);
    expect(rupeesToPaise('500')).toBe(50000);
  });

  it('converts amounts to Indian Rupee Words for official receipts', () => {
    expect(numberToWordsINR(10000000)).toBe('One Lakh Rupees Only');
    expect(numberToWordsINR(25000000)).toBe('Two Lakh Fifty Thousand Rupees Only');
    expect(numberToWordsINR(1000000000)).toBe('One Crore Rupees Only');
  });
});
