export type ValidationError = {
    field: string;
    message: string;
};
export declare function validateTransaction(body: Record<string, unknown>, partial?: boolean): ValidationError[];
export declare function validatePatch(body: Record<string, unknown>): {
    cleaned: Record<string, unknown>;
    errors: ValidationError[];
};
export declare function parseDateQuery(dateStr: string): {
    year: number;
    month: number;
} | null;
//# sourceMappingURL=validation.d.ts.map