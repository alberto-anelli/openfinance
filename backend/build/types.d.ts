export interface Transaction {
    id: string;
    type: 'expense' | 'income';
    amount: number;
    category: string;
    date: string;
    createdAt: string;
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
    months: (MonthSummary | null)[];
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
//# sourceMappingURL=types.d.ts.map