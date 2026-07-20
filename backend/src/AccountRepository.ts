import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Account, AccountBalanceLog, AccountDumpFile, AccountType } from './types.js';

export interface AccountRepositoryConfig {
  dataDir: string;
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
  private initialized = false;

  constructor(config: AccountRepositoryConfig) {
    this.dataDir = config.dataDir;
    this.filePath = join(this.dataDir, 'accounts.json');
  }

  get latestPath(): string {
    return this.filePath;
  }

  // ── Persistence ────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (existsSync(this.filePath)) {
      try {
        const data = await readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(data) as AccountDumpFile;
        if (this.isValidDump(parsed)) {
          for (const acc of parsed.accounts) {
            this.accounts.set(acc.id, acc);
          }
          for (const log of parsed.balanceLogs) {
            this.balanceLogs.set(log.id, log);
          }
          console.log(`Loaded ${this.accounts.size} accounts, ${this.balanceLogs.size} balance logs`);
          return;
        }
        console.warn('accounts.json corrupted, starting fresh');
      } catch {
        console.warn('accounts.json unreadable, starting fresh');
      }
    } else {
      console.log('No accounts.json found, starting fresh');
    }
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

    // Clone only mutable fields
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
    return logs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
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