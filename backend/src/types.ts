export interface Transaction {
  id: string;            // uuid v4
  type: 'expense' | 'income';
  amount: number;        // interi in CENTESIMI (>0) — evitare float
  category: string;      // libera (expense) | enum (income)
  date: string;          // 'YYYY-MM-DD'
  createdAt: string;     // ISO datetime
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