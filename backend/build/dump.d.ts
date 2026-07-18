import type { Transaction } from './types.js';
export interface DumpManagerConfig {
    dataDir: string;
    keepCount: number;
}
export declare class DumpManager {
    private readonly dataDir;
    private readonly keepCount;
    constructor(config: DumpManagerConfig);
    get latestPath(): string;
    private snapshotPath;
    /** Load the most recent valid dump. Tries latest first, then rotated snapshots. */
    load(): Promise<Transaction[]>;
    /** Atomic write: temp file + rename */
    save(transactions: Transaction[]): Promise<void>;
    /** Rotated snapshot — also triggers cleanup of old snapshots */
    snapshot(transactions: Transaction[]): Promise<void>;
    private rotate;
    private isValidDump;
}
//# sourceMappingURL=dump.d.ts.map