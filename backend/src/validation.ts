import type { Transaction } from './types.js';

const INCOME_CATEGORIES = ['stipendio', 'tredicesima', 'quattordicesima', 'regalo'] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ValidationError = { field: string; message: string };

export function validateTransaction(
  body: Record<string, unknown>,
  partial = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!partial || body.type !== undefined) {
    if (body.type !== 'expense' && body.type !== 'income') {
      errors.push({ field: 'type', message: 'type must be "expense" or "income"' });
    }
  }

  if (!partial || body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !Number.isInteger(body.amount) || body.amount <= 0) {
      errors.push({ field: 'amount', message: 'amount must be a positive integer (centesimi)' });
    }
  }

  if (!partial || body.date !== undefined) {
    if (typeof body.date !== 'string' || !DATE_REGEX.test(body.date)) {
      errors.push({ field: 'date', message: 'date must be in YYYY-MM-DD format' });
    }
  }

  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string') {
      errors.push({ field: 'category', message: 'category must be a string' });
    } else {
      const type = body.type as string;
      if (type === 'income') {
        if (!INCOME_CATEGORIES.includes(body.category as typeof INCOME_CATEGORIES[number])) {
          errors.push({
            field: 'category',
            message: `category must be one of: ${INCOME_CATEGORIES.join(', ')}`,
          });
        }
      } else {
        const trimmed = body.category.trim();
        if (trimmed.length === 0 || trimmed.length > 60) {
          errors.push({ field: 'category', message: 'category must be 1-60 characters' });
        }
      }
    }
  }

  return errors;
}

export function validatePatch(
  body: Record<string, unknown>
): { cleaned: Record<string, unknown>; errors: ValidationError[] } {
  const allowedFields = ['type', 'amount', 'category', 'date'];
  const cleaned: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      cleaned[key] = body[key];
    }
  }

  if (Object.keys(cleaned).length === 0) {
    return { cleaned: {}, errors: [{ field: 'body', message: 'at least one field to update is required' }] };
  }

  const errors = validateTransaction(cleaned as Record<string, unknown>, true);
  return { cleaned, errors };
}

export function parseDateQuery(dateStr: string): { year: number; month: number } | null {
  if (!DATE_REGEX.test(dateStr)) return null;
  const [y, m] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  return { year: y, month: m };
}