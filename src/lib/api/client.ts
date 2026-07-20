import { getBasePath } from '$lib/base';

function apiBase(): string {
	return getBasePath() + '/api';
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  amount: number; // centesimi
  category: string;
  description?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface MonthSummary {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  difference: number;
}

export interface YearSummary {
  year: number;
  months: (MonthSummary | null)[];
  totalIncome: number;
  totalExpenses: number;
  totalDifference: number;
}

export interface ApiError {
  error: { code: string; message: string };
}

// ── Account types ────────────────────────────────────────────────────────

export type AccountType = 'bank' | 'credit_card' | 'debit_card' | 'savings' | 'cash' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalanceLog {
  id: string;
  accountId: string;
  balance: number;    // centesimi
  date: string;       // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${apiBase()}${path}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as ApiError | null;
      throw new Error(body?.error?.message || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Transactions
  create(data: { type: 'expense' | 'income'; amount: number; category: string; description?: string; date: string }) {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  list(params?: { year?: number; month?: number; type?: string; category?: string }) {
    const qs = new URLSearchParams();
    if (params?.year) qs.set('year', String(params.year));
    if (params?.month) qs.set('month', String(params.month));
    if (params?.type) qs.set('type', params.type);
    if (params?.category) qs.set('category', params.category);
    const query = qs.toString();
    return this.request<Transaction[]>(`/transactions${query ? `?${query}` : ''}`);
  }

  getById(id: string) {
    return this.request<Transaction>(`/transactions/${id}`);
  }

  update(id: string, patch: Partial<Transaction>) {
    return this.request<Transaction>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  delete(id: string) {
    return this.request<void>(`/transactions/${id}`, { method: 'DELETE' });
  }

  // Summary
  monthSummary(year: number, month: number) {
    return this.request<MonthSummary>(`/summary/month?year=${year}&month=${month}`);
  }

  yearSummary(year: number) {
    return this.request<YearSummary>(`/summary/year?year=${year}`);
  }

  // Categories — extract unique expense categories from the full list
  async expenseCategories(): Promise<string[]> {
    const txs = await this.list({ type: 'expense' });
    const cats = new Set(txs.map(tx => tx.category));
    return Array.from(cats).sort();
  }

  // ── Accounts ───────────────────────────────────────────────────────────
  listAccounts() {
    return this.request<Account[]>('/accounts');
  }

  createAccount(data: { name: string; type: AccountType; currency?: string; color?: string }) {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAccount(id: string) {
    return this.request<Account>(`/accounts/${id}`);
  }

  updateAccount(id: string, patch: Partial<Account>) {
    return this.request<Account>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  deleteAccount(id: string) {
    return this.request<void>(`/accounts/${id}`, { method: 'DELETE' });
  }

  // ── Balance logs ───────────────────────────────────────────────────────
  listBalances(accountId: string) {
    return this.request<AccountBalanceLog[]>(`/accounts/${accountId}/balances`);
  }

  createBalance(accountId: string, data: { balance: number; date: string; note?: string }) {
    return this.request<AccountBalanceLog>(`/accounts/${accountId}/balances`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateBalance(id: string, patch: Partial<AccountBalanceLog>) {
    return this.request<AccountBalanceLog>(`/balances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  deleteBalance(id: string) {
    return this.request<void>(`/balances/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();