/**
 * Shared money formatting utilities.
 *
 * The API works in **centesimi** (integer cents).
 * 100 centesimi = 1,00 €.
 *
 * All display formatting and input parsing goes through these functions
 * so there is a single source of truth for the cents ↔ euros conversion.
 */

/**
 * Format centesimi to a EUR currency string for display.
 * Example: `formatCents(100)` → `"1,00 €"`
 */
export function formatCents(c: number): string {
  return (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

/**
 * Format centesimi to an editable string (no thousands separator, comma decimal).
 * Example: `formatInput(100)` → `"1,00"`
 */
export function formatInput(centesimi: number): string {
  return (centesimi / 100).toFixed(2).replace('.', ',');
}

/**
 * Parse a user-typed string (e.g. `"1,00"` or `"1.00"`) to centesimi.
 * Accepts both `,` and `.` as decimal separator.
 * Supports negative values (e.g. `"-1,00"` → `-100`).
 * Example: `parseInput("1,00")` → `100`
 */
export function parseInput(str: string): number {
  const normalized = str.replace(',', '.').trim();
  if (normalized === '' || normalized === '-') return 0;
  const euros = parseFloat(normalized);
  if (isNaN(euros)) return 0;
  return Math.round(euros * 100);
}