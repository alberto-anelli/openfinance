import type { Transaction } from './types.js';
import type { Repository } from './Repository.js';
export declare class InMemoryRepository implements Repository {
    private readonly data;
    private readonly dumpManager;
    private debounceTimer;
    private readonly snapshotInterval;
    private readonly debounceMs;
    private shuttingDown;
    constructor(config: {
        dataDir: string;
        dumpIntervalMs: number;
        dumpKeep: number;
        debounceMs?: number;
    });
    /** Load data from disk on startup */
    init(): Promise<void>;
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
    private scheduleWrite;
    private flushSnapshot;
}
export declare class NotFoundError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=InMemoryRepository.d.ts.map