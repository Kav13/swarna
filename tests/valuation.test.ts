import { describe, it, expect } from 'vitest';
import { ValuationService } from '../electron/services/valuationService';

describe('ValuationService - Collateral Appraisal & LTV Calculation', () => {
  it('correctly calculates net weight, valuation and max loan for 22K Gold', () => {
    // 50g gross, 2g stone -> 48g net
    // Rate = ₹7,000 / g (700,000 paise)
    // Valuation = 48 * 700,000 = 33,600,000 paise (₹3,36,000)
    // LTV = 75% -> Max Loan = 33,600,000 * 0.75 = 25,200,000 paise (₹2,52,000)
    const result = ValuationService.calculateItemValuation(50.0, 2.0, 700000, 75, 20000000);

    expect(result.net_weight_grams).toBe(48.0);
    expect(result.valuation_paise).toBe(33600000);
    expect(result.max_loan_paise).toBe(25200000);
    expect(result.margin_paise).toBe(13600000); // 33,600,000 - 20,000,000
    expect(result.is_valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('correctly calculates silver valuation for 925 sterling silver', () => {
    // 250g gross, 10g stone -> 240g net
    // Rate = ₹88 / g (8,800 paise)
    // Valuation = 240 * 8,800 = 2,112,000 paise (₹21,120)
    // LTV = 70% -> Max Loan = 2,112,000 * 0.7 = 1,478,400 paise (₹14,784)
    const result = ValuationService.calculateItemValuation(250.0, 10.0, 8800, 70, 1000000);

    expect(result.net_weight_grams).toBe(240.0);
    expect(result.valuation_paise).toBe(2112000);
    expect(result.max_loan_paise).toBe(1478400);
    expect(result.is_valid).toBe(true);
  });

  it('rejects invalid inputs such as stone weight >= gross weight', () => {
    const result = ValuationService.calculateItemValuation(10.0, 12.0, 700000, 75, 5000000);
    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain('Stone weight cannot be greater than or equal to gross weight');
  });

  it('accurately aggregates multiple items in multi-item summary', () => {
    const items = [
      { gross_weight_grams: 10, stone_weight_grams: 0, rate_per_gram_paise: 700000, allocated_loan_paise: 5000000 },
      { gross_weight_grams: 30, stone_weight_grams: 1, rate_per_gram_paise: 700000, allocated_loan_paise: 15000000 },
      { gross_weight_grams: 25, stone_weight_grams: 2, rate_per_gram_paise: 700000, allocated_loan_paise: 11000000 },
    ];

    // Net weights: 10 + 29 + 23 = 62g
    // Valuations: (10 * 7000) + (29 * 7000) + (23 * 7000) = ₹4,34,000 (43,400,000 paise)
    // Max loan at 75% LTV = 43,400,000 * 0.75 = 32,550,000 paise (₹3,25,500)
    // Total requested: 5,000,000 + 15,000,000 + 11,000,000 = 31,000,000 paise (₹3,10,000)
    const summary = ValuationService.calculateMultiItemSummary(items, 75, 31000000);

    expect(summary.total_gross_weight_grams).toBe(65.0);
    expect(summary.total_stone_weight_grams).toBe(3.0);
    expect(summary.total_net_weight_grams).toBe(62.0);
    expect(summary.total_valuation_paise).toBe(43400000);
    expect(summary.total_max_loan_paise).toBe(32550000);
    expect(summary.is_eligible).toBe(true);
    expect(summary.excess_amount_paise).toBe(0);
  });

  it('detects when requested loan exceeds maximum eligible LTV ceiling', () => {
    const items = [
      { gross_weight_grams: 10, stone_weight_grams: 0, rate_per_gram_paise: 700000, allocated_loan_paise: 6000000 },
    ];
    // Net: 10g * 7000 = ₹70,000 (7,000,000 paise)
    // Max loan at 75% LTV = ₹52,500 (5,250,000 paise)
    // Requested: ₹60,000 (6,000,000 paise) -> Exceeds by ₹7,500 (750,000 paise)
    const summary = ValuationService.calculateMultiItemSummary(items, 75, 6000000);

    expect(summary.is_eligible).toBe(false);
    expect(summary.excess_amount_paise).toBe(750000);
  });
});
