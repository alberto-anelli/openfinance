export interface Transaction {
  id: string;            // uuid v4
  type: 'expense' | 'income';
  amount: number;        // interi in CENTESIMI (>0) — evitare float
  category: string;      // libera (expense) | enum (income)
  description?: string;  // opzionale, solo expense
  date: string;          // 'YYYY-MM-DD'
  createdAt: string;     // ISO datetime
  accountId?: string;    // riferimento a un conto (opzionale)
}

export interface DumpFile {
  schemaVersion: number;
  savedAt: string;
  transactions: Transaction[];
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
  months: (MonthSummary | null)[];  // index 0=gen, 11=dic; null = no data
  totalIncome: number;
  totalExpenses: number;
  totalDifference: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// ── Account types ────────────────────────────────────────────────────────

export type AccountType = string;

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
  createdAt: string;  // ISO datetime — audit only
  updatedAt?: string; // ISO datetime — audit only, set on update
}

export interface AccountDumpFile {
  schemaVersion: number;
  savedAt: string;
  accounts: Account[];
  balanceLogs: AccountBalanceLog[];
}