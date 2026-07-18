import type { Transaction } from './types.js';

export interface Repository {
  add(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  update(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
  list(filter?: {
    year?: number;
    month?: number;
    type?: Transaction['type'];
    category?: string;
  }): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
}