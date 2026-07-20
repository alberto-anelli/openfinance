import { v4 as uuidv4 } from 'uuid';
import type { Transaction } from './types.js';
import type { Repository } from './Repository.js';
import { DumpManager } from './dump.js';

export class InMemoryRepository implements Repository {
  private readonly data = new Map<string, Transaction>();
  private readonly dumpManager: DumpManager;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private readonly debounceMs: number;
  private shuttingDown = false;

  constructor(config: {
    dataDir: string;
    dumpIntervalMs: number;
    dumpKeep: number;
    debounceMs?: number;
  }) {
    this.dumpManager = new DumpManager({
      dataDir: config.dataDir,
      keepCount: config.dumpKeep,
    });
    this.debounceMs = config.debounceMs ?? 1000;

    // Periodic snapshot
    this.snapshotInterval = setInterval(() => {
      this.flushSnapshot().catch(err =>
        console.error('Snapshot error:', err)
      );
    }, config.dumpIntervalMs);

    // Graceful shutdown
    const shutdown = async () => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;
      console.log('Shutting down, performing final dump...');
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (this.snapshotInterval) {
        clearInterval(this.snapshotInterval);
      }
      try {
        await this.dumpManager.save(Array.from(this.data.values()));
        console.log('Final dump complete.');
      } catch (err) {
        console.error('Final dump failed:', err);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /** Load data from disk on startup */
  async init(): Promise<void> {
    const transactions = await this.dumpManager.load();
    for (const tx of transactions) {
      this.data.set(tx.id, tx);
    }
    console.log(`Loaded ${this.data.size} transactions from dump`);
  }

  async add(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...tx,
      id: uuidv4(),
      createdAt: now,
    };
    this.data.set(transaction.id, transaction);
    this.scheduleWrite();
    return transaction;
  }

  async update(id: string, patch: Partial<Transaction>): Promise<Transaction> {
    const existing = this.data.get(id);
    if (!existing) {
      throw new NotFoundError(`Transaction ${id} not found`);
    }
    const updated: Transaction = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt };
    this.data.set(id, updated);
    this.scheduleWrite();
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.data.has(id)) {
      throw new NotFoundError(`Transaction ${id} not found`);
    }
    this.data.delete(id);
    this.scheduleWrite();
  }

  async list(filter?: {
    year?: number;
    month?: number;
    type?: Transaction['type'];
    category?: string;
    accountId?: string;
  }): Promise<Transaction[]> {
    let result = Array.from(this.data.values());

    if (filter) {
      if (filter.type) {
        result = result.filter(tx => tx.type === filter.type);
      }
      if (filter.category) {
        result = result.filter(tx => tx.category === filter.category);
      }
      if (filter.year !== undefined) {
        result = result.filter(tx => {
          const d = new Date(tx.date);
          return d.getFullYear() === filter.year;
        });
      }
      if (filter.month !== undefined) {
        result = result.filter(tx => {
          const d = new Date(tx.date);
          return d.getMonth() + 1 === filter.month;
        });
      }
      if (filter.accountId) {
        result = result.filter(tx => tx.accountId === filter.accountId);
      }
    }

    // Sort by date descending, then by createdAt descending
    result.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return result;
  }

  async getById(id: string): Promise<Transaction | null> {
    return this.data.get(id) ?? null;
  }

  private scheduleWrite(): void {
    if (this.shuttingDown) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.dumpManager.save(Array.from(this.data.values())).catch(err =>
        console.error('Debounced write failed:', err)
      );
    }, this.debounceMs);
  }

  private async flushSnapshot(): Promise<void> {
    try {
      await this.dumpManager.snapshot(Array.from(this.data.values()));
    } catch (err) {
      console.error('Periodic snapshot failed:', err);
    }
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}