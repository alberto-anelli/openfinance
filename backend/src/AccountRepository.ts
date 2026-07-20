import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Account, AccountBalanceLog, AccountDumpFile, AccountType } from './types.js';

export interface AccountRepositoryConfig {
  dataDir: string;
  snapshotIntervalMs?: number;  // default 4h
  keepSnapshots?: number;        // default 10
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AccountRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly balanceLogs = new Map<string, AccountBalanceLog>();
  private readonly dataDir: string;
  private readonly filePath: string;
  private readonly snapshotIntervalMs: number;
  private readonly keepSnapshots: number;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private shuttingDown = false;

  constructor(config: AccountRepositoryConfig) {
    this.dataDir = config.dataDir;
    this.filePath = join(this.dataDir, 'accounts.json');
    this.snapshotIntervalMs = config.snapshotIntervalMs ?? 14400000; // 4h
    this.keepSnapshots = config.keepSnapshots ?? 10;
  }

  get latestPath(): string {
    return this.filePath;
  }

  // ── Persistence ────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Try accounts.json first
    if (existsSync(this.filePath)) {
      try {
        const data = await readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(data) as AccountDumpFile;
        if (this.isValidDump(parsed)) {
          this.loadFromDump(parsed);
          return;
        }
        console.warn('accounts.json corrupted, trying rotated snapshots...');
      } catch {
        console.warn('accounts.json unreadable, trying rotated snapshots...');
      }
    }

    // Fallback: try rotated snapshots
    try {
      const files = await readdir(this.dataDir);
      const snapFiles = files
        .filter(f => f.startsWith('accounts-') && f.endsWith('.json') && f !== 'accounts.json')
        .sort()
        .reverse();

      for (const file of snapFiles) {
        try {
          const data = await readFile(join(this.dataDir, file), 'utf-8');
          const parsed = JSON.parse(data) as AccountDumpFile;
          if (this.isValidDump(parsed)) {
            this.loadFromDump(parsed);
            console.log(`Restored accounts from ${file}`);
            return;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // dataDir can't be read
    }

    console.log('No valid accounts dump found, starting fresh');
    this.setupPeriodicSnapshot();
    this.setupShutdownHook();
  }

  private loadFromDump(dump: AccountDumpFile): void {
    for (const acc of dump.accounts) {
      this.accounts.set(acc.id, acc);
    }
    for (const log of dump.balanceLogs) {
      this.balanceLogs.set(log.id, log);
    }
    console.log(`Loaded ${this.accounts.size} accounts, ${this.balanceLogs.size} balance logs`);
    this.setupPeriodicSnapshot();
    this.setupShutdownHook();
  }

  private async save(): Promise<void> {
    const dump: AccountDumpFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      accounts: Array.from(this.accounts.values()),
      balanceLogs: Array.from(this.balanceLogs.values()),
    };

    const tmpPath = join(this.dataDir, `accounts-tmp-${Date.now()}.json`);
    await writeFile(tmpPath, JSON.stringify(dump, null, 2), 'utf-8');
    await rename(tmpPath, this.filePath);
  }

  /** Snapshot: saves latest + creates a timestamped copy, then rotates old ones */
  private async snapshot(): Promise<void> {
    try {
      await this.save();

      const iso = new Date().toISOString().replace(/[:.]/g, '-');
      const snapPath = join(this.dataDir, `accounts-${iso}.json`);
      const dump: AccountDumpFile = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        accounts: Array.from(this.accounts.values()),
        balanceLogs: Array.from(this.balanceLogs.values()),
      };
      await writeFile(snapPath, JSON.stringify(dump, null, 2), 'utf-8');
      await this.rotate();
    } catch (err) {
      console.error('Account snapshot failed:', err);
    }
  }

  /** Keep only the N most recent snapshot files */
  private async rotate(): Promise<void> {
    try {
      const files = await readdir(this.dataDir);
      const snapFiles = files
        .filter(f => f.startsWith('accounts-') && f.endsWith('.json') && f !== 'accounts.json')
        .sort()
        .reverse();

      if (snapFiles.length > this.keepSnapshots) {
        const toRemove = snapFiles.slice(this.keepSnapshots);
        for (const file of toRemove) {
          await unlink(join(this.dataDir, file));
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private setupPeriodicSnapshot(): void {
    this.snapshotTimer = setInterval(() => {
      this.snapshot().catch(err => console.error('Periodic account snapshot error:', err));
    }, this.snapshotIntervalMs);
  }

  private setupShutdownHook(): void {
    const shutdown = async () => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;
      console.log('Shutting down, saving accounts...');
      if (this.snapshotTimer) {
        clearInterval(this.snapshotTimer);
        this.snapshotTimer = null;
      }
      try {
        await this.save();
        console.log('Final accounts save complete.');
      } catch (err) {
        console.error('Final accounts save failed:', err);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private isValidDump(dump: unknown): dump is AccountDumpFile {
    if (typeof dump !== 'object' || dump === null) return false;
    const d = dump as Record<string, unknown>;
    if (d.schemaVersion !== 1) return false;
    if (!Array.isArray(d.accounts)) return false;
    if (!Array.isArray(d.balanceLogs)) return false;
    return true;
  }

  // ── Account CRUD ───────────────────────────────────────────────────────

  async listAccounts(): Promise<Account[]> {
    return Array.from(this.accounts.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAccount(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async createAccount(data: {
    name: string;
    type: AccountType;
    currency?: string;
    color?: string;
  }): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      id: uuidv4(),
      name: data.name.trim(),
      type: data.type,
      currency: data.currency || 'EUR',
      color: data.color || '#6366f1',
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    await this.save();
    return account;
  }

  async updateAccount(id: string, patch: Partial<Account>): Promise<Account> {
    const existing = this.accounts.get(id);
    if (!existing) throw new NotFoundError(`Account ${id} not found`);

    const updated: Account = {
      id: existing.id,
      name: patch.name ?? existing.name,
      type: patch.type ?? existing.type,
      currency: patch.currency ?? existing.currency,
      color: patch.color ?? existing.color,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.accounts.set(id, updated);
    await this.save();
    return updated;
  }

  async deleteAccount(id: string): Promise<void> {
    if (!this.accounts.has(id)) throw new NotFoundError(`Account ${id} not found`);
    this.accounts.delete(id);

    // Delete all balance logs for this account
    const logIdsToRemove: string[] = [];
    for (const [logId, log] of this.balanceLogs) {
      if (log.accountId === id) logIdsToRemove.push(logId);
    }
    for (const logId of logIdsToRemove) {
      this.balanceLogs.delete(logId);
    }

    await this.save();
  }

  // ── Balance log CRUD ───────────────────────────────────────────────────

  async listBalances(accountId: string): Promise<AccountBalanceLog[]> {
    const logs: AccountBalanceLog[] = [];
    for (const log of this.balanceLogs.values()) {
      if (log.accountId === accountId) logs.push(log);
    }
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getBalance(id: string): Promise<AccountBalanceLog | null> {
    return this.balanceLogs.get(id) ?? null;
  }

  async createBalance(data: {
    accountId: string;
    balance: number;
    date: string;
    note?: string;
  }): Promise<AccountBalanceLog> {
    if (!this.accounts.has(data.accountId)) {
      throw new NotFoundError(`Account ${data.accountId} not found`);
    }

    const log: AccountBalanceLog = {
      id: uuidv4(),
      accountId: data.accountId,
      balance: data.balance,
      date: data.date,
      note: data.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.balanceLogs.set(log.id, log);
    await this.save();
    return log;
  }

  async updateBalance(id: string, patch: Partial<AccountBalanceLog>): Promise<AccountBalanceLog> {
    const existing = this.balanceLogs.get(id);
    if (!existing) throw new NotFoundError(`Balance log ${id} not found`);

    const updated: AccountBalanceLog = {
      id: existing.id,
      accountId: existing.accountId,
      balance: patch.balance ?? existing.balance,
      date: patch.date ?? existing.date,
      note: patch.note !== undefined ? patch.note : existing.note,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.balanceLogs.set(id, updated);
    await this.save();
    return updated;
  }

  async deleteBalance(id: string): Promise<void> {
    if (!this.balanceLogs.has(id)) throw new NotFoundError(`Balance log ${id} not found`);
    this.balanceLogs.delete(id);
    await this.save();
  }
}