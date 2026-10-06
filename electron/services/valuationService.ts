import { JewelleryItem } from '../types';

export interface ValuationResult {
  net_weight_grams: number;
  valuation_paise: number;
  max_loan_paise: number;
  margin_paise: number;
  is_valid: boolean;
  errors: string[];
}

export interface MultiItemValuationSummary {
  total_gross_weight_grams: number;
  total_stone_weight_grams: number;
  total_net_weight_grams: number;
  total_valuation_paise: number;
  total_max_loan_paise: number;
  total_allocated_loan_paise: number;
  available_margin_paise: number;
  is_eligible: boolean;
  excess_amount_paise: number;
  items_count: number;
}

export class ValuationService {
  /**
   * Calculates valuation and eligible loan for a single jewellery item
   */
  static calculateItemValuation(
    grossWeightGrams: number,
    stoneWeightGrams: number,
    ratePerGramPaise: number,
    ltvPercent: number,
    requestedLoanPaise: number = 0
  ): ValuationResult {
    const errors: string[] = [];

    if (grossWeightGrams <= 0) {
      errors.push('Gross weight must be greater than zero');
    }
    if (stoneWeightGrams < 0) {
      errors.push('Stone weight cannot be negative');
    }
    if (stoneWeightGrams >= grossWeightGrams) {
      errors.push('Stone weight cannot be greater than or equal to gross weight');
    }
    if (ratePerGramPaise <= 0) {
      errors.push('Valuation rate must be greater than zero');
    }
    if (ltvPercent <= 0 || ltvPercent > 100) {
      errors.push('LTV percentage must be between 1% and 100%');
    }

    const netWeight = Math.max(0, +(grossWeightGrams - (stoneWeightGrams || 0)).toFixed(3));
    const valuationPaise = Math.round(netWeight * ratePerGramPaise);
    const maxLoanPaise = Math.round(valuationPaise * (ltvPercent / 100));
    const marginPaise = Math.max(0, valuationPaise - requestedLoanPaise);

    return {
      net_weight_grams: netWeight,
      valuation_paise: valuationPaise,
      max_loan_paise: maxLoanPaise,
      margin_paise: marginPaise,
      is_valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculates aggregated totals across multiple jewellery items pledged in a loan
   */
  static calculateMultiItemSummary(
    items: Partial<JewelleryItem>[],
    ltvPercent: number,
    totalRequestedLoanPaise: number
  ): MultiItemValuationSummary {
    let totalGross = 0;
    let totalStone = 0;
    let totalNet = 0;
    let totalValuation = 0;
    let totalMaxLoan = 0;
    let totalAllocatedLoan = 0;

    for (const item of items) {
      const gross = item.gross_weight_grams || 0;
      const stone = item.stone_weight_grams || 0;
      const rate = item.rate_per_gram_paise || 0;
      const allocated = item.allocated_loan_paise || 0;

      const calc = this.calculateItemValuation(gross, stone, rate, ltvPercent, allocated);

      totalGross += gross;
      totalStone += stone;
      totalNet += calc.net_weight_grams;
      totalValuation += calc.valuation_paise;
      totalMaxLoan += calc.max_loan_paise;
      totalAllocatedLoan += allocated;
    }

    // Determine eligibility: requested loan must not exceed total max loan (unless overridden)
    const effectiveLoan = totalRequestedLoanPaise || totalAllocatedLoan;
    const isEligible = effectiveLoan <= totalMaxLoan;
    const excessAmountPaise = Math.max(0, effectiveLoan - totalMaxLoan);
    const availableMargin = Math.max(0, totalValuation - effectiveLoan);

    return {
      total_gross_weight_grams: +totalGross.toFixed(3),
      total_stone_weight_grams: +totalStone.toFixed(3),
      total_net_weight_grams: +totalNet.toFixed(3),
      total_valuation_paise: totalValuation,
      total_max_loan_paise: totalMaxLoan,
      total_allocated_loan_paise: effectiveLoan,
      available_margin_paise: availableMargin,
      is_eligible: isEligible,
      excess_amount_paise: excessAmountPaise,
      items_count: items.length,
    };
  }
}
