import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DumpFile, Transaction } from './types.js';

export interface DumpManagerConfig {
  dataDir: string;
  keepCount: number;
}

export class DumpManager {
  private readonly dataDir: string;
  private readonly keepCount: number;

  constructor(config: DumpManagerConfig) {
    this.dataDir = config.dataDir;
    this.keepCount = config.keepCount;
  }

  get latestPath(): string {
    return join(this.dataDir, 'dump-latest.json');
  }

  private snapshotPath(iso: string): string {
    return join(this.dataDir, `dump-${iso}.json`);
  }

  /** Load the most recent valid dump. Tries latest first, then rotated snapshots. */
  async load(): Promise<Transaction[]> {
    // Try dump-latest.json first
    if (existsSync(this.latestPath)) {
      try {
        const data = await readFile(this.latestPath, 'utf-8');
        const parsed = JSON.parse(data) as DumpFile;
        if (this.isValidDump(parsed)) {
          return parsed.transactions;
        }
        console.warn('dump-latest.json corrupted, trying rotated snapshots...');
      } catch {
        console.warn('dump-latest.json unreadable, trying rotated snapshots...');
      }
    }

    // Fallback: find most recent valid rotated dump
    try {
      const files = await readdir(this.dataDir);
      const dumpFiles = files
        .filter(f => f.startsWith('dump-') && f.endsWith('.json') && f !== 'dump-latest.json')
        .sort()
        .reverse();

      for (const file of dumpFiles) {
        try {
          const data = await readFile(join(this.dataDir, file), 'utf-8');
          const parsed = JSON.parse(data) as DumpFile;
          if (this.isValidDump(parsed)) {
            console.log(`Restored from ${file}`);
            return parsed.transactions;
          }
        } catch {
          continue; // try next file
        }
      }
    } catch {
      // dataDir doesn't exist or can't be read
    }

    console.log('No valid dump found, starting with empty state');
    return [];
  }

  /** Atomic write: temp file + rename */
  async save(transactions: Transaction[]): Promise<void> {
    const dump: DumpFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      transactions,
    };

    const tmpPath = join(this.dataDir, `dump-tmp-${Date.now()}.json`);
    await writeFile(tmpPath, JSON.stringify(dump, null, 2), 'utf-8');
    await rename(tmpPath, this.latestPath);
  }

  /** Rotated snapshot — also triggers cleanup of old snapshots */
  async snapshot(transactions: Transaction[]): Promise<void> {
    await this.save(transactions); // update latest

    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const snapPath = this.snapshotPath(iso);
    const dump: DumpFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      transactions,
    };
    await writeFile(snapPath, JSON.stringify(dump, null, 2), 'utf-8');

    // Cleanup old snapshots
    await this.rotate();
  }

  private async rotate(): Promise<void> {
    try {
      const files = await readdir(this.dataDir);
      const dumpFiles = files
        .filter(f => f.startsWith('dump-') && f.endsWith('.json') && f !== 'dump-latest.json')
        .sort()
        .reverse();

      if (dumpFiles.length > this.keepCount) {
        const toRemove = dumpFiles.slice(this.keepCount);
        for (const file of toRemove) {
          await unlink(join(this.dataDir, file));
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private isValidDump(dump: unknown): dump is DumpFile {
    if (typeof dump !== 'object' || dump === null) return false;
    const d = dump as Record<string, unknown>;
    if (d.schemaVersion !== 1) return false;
    if (!Array.isArray(d.transactions)) return false;
    return true;
  }
}