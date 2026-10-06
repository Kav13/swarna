/**
 * Utility functions for Gold Karat calculations, Silver Fineness calculations,
 * and standard display formatting for jewellery items and categories.
 */

/**
 * Calculates purity percentage for gold given karat value.
 * Purity % = (Karat / 24) * 100
 * Rounded to 2 decimal places.
 * Examples:
 * 24K -> 100.00%
 * 22K -> 91.67%
 * 20K -> 83.33%
 * 18K -> 75.00%
 * 16K -> 66.67%
 * 14K -> 58.33%
 */
export function calculateGoldPurityPercent(karat: number): number {
  if (karat <= 0 || isNaN(karat)) return 0;
  if (karat >= 24) return 100.0;
  return Math.round((karat / 24) * 10000) / 100;
}

/**
 * Calculates purity percentage for silver given fineness value (per 1000).
 * Purity % = (Fineness / 1000) * 100 = Fineness / 10
 * Examples:
 * 999 -> 99.90%
 * 925 -> 92.50%
 * 900 -> 90.00%
 * 800 -> 80.00%
 * 700 -> 70.00%
 * 600 -> 60.00%
 */
export function calculateSilverPurityPercent(fineness: number): number {
  if (fineness <= 0 || isNaN(fineness)) return 0;
  if (fineness > 1000) return 100.0;
  return Math.round((fineness / 10) * 100) / 100;
}

/**
 * Formats jewellery category display string.
 * When "Other Article" (or "Other") has a custom category, displays:
 * "Other Article — [Custom Category]"
 */
export function formatItemCategory(category: string, customCategory?: string): string {
  const isOther = category === 'Other Article' || category === 'Other';
  const custom = customCategory?.trim();
  if (isOther && custom) {
    return `Other Article — ${custom}`;
  }
  return category || 'Other Article';
}

/**
 * Formats material and purity display string.
 * Standard format:
 * "16K Gold (66.67%)"
 * "Silver 700 (70.00%)"
 */
export function formatItemMaterial(
  material: string,
  materialType?: string,
  purity?: string,
  purityPercent?: number
): string {
  const pctStr =
    purityPercent != null && purityPercent > 0
      ? `${Number(purityPercent).toFixed(2)}%`
      : undefined;

  if (materialType && pctStr) {
    // If materialType already includes percentage, don't duplicate
    if (materialType.includes('%')) return materialType;
    return `${materialType} (${pctStr})`;
  }

  if (materialType) return materialType;

  if (purity && pctStr) {
    return `${purity} ${material} (${pctStr})`;
  }

  if (purity) {
    return `${material} (${purity})`;
  }

  return material;
}
