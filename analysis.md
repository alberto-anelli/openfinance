# Analysis: In-Memory + File-Based Persistence

> Codebase: OpenFinance — personal finance tracker (SvelteKit SPA + Express backend)
> Analyzed: 2026-07-18

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pros](#2-pros)
3. [Cons](#3-cons)
4. [Concurrency Analysis](#4-concurrency-analysis)
5. [Bottlenecks & Potential Problems](#5-bottlenecks--potential-problems)
6. [Scenarios: What Happens When...](#6-scenarios-what-happens-when)
7. [Recommendations](#7-recommendations)

---

## 1. Architecture Overview

The backend uses a two-tier data model:

```
Express Route Handler
       │
       ▼
  InMemoryRepository (Map<string, Transaction>)
       │
       ▼
  DumpManager (file-based persistence)
       │
       ▼
  /var/lib/finance/dump-latest.json
```

- **Live data**: `Map<string, Transaction>` in memory — all reads/writes hit this Map.
- **Persistence**: JSON file on disk, written with a 1-second debounce after every mutation.
- **Atomic writes**: Each write goes to a temp file, then `rename()` atomically replaces the main file.
- **Periodic snapshots**: Every 4 hours, a full dump is written to a rotated timestamped file.
- **Restore on startup**: Reads `dump-latest.json`; if corrupt, falls back to the most recent rotated snapshot; if none, starts empty.

---

## 2. Pros

### 2.1 Blazing-fast reads
All reads (`list`, `getById`, `summary`) hit the in-memory `Map`. No disk I/O, no query planning, no connection pool overhead. For a single-user app with thousands of transactions, summary calculations complete in microseconds.

### 2.2 Simple, zero-dependency deployment
No PostgreSQL, SQLite, or any database to install, configure, back up, or tune. The only runtime dependencies are `express` and `uuid`. The systemd unit file is trivial.

### 2.3 Atomic writes prevent torn dumps
The `writeFile` + `rename` pattern (line 80-82 in `dump.ts`) is the gold standard for crash-safe single-file writes on Linux. A reader (or a crash during write) can never see a half-written file — the file is either the old content or the complete new content.

### 2.4 Graceful shutdown preserves data
On `SIGINT`/`SIGTERM`, the shutdown handler cancels the debounce timer and performs an immediate synchronous-style dump before exiting (lines 34-52 in `InMemoryRepository.ts`). Under normal operation (service restart, OS shutdown), data is safe.

### 2.5 Debounce prevents write storms
The 1-second debounce collapses rapid mutations (e.g., bulk import, rapid form submissions) into a single file write. This prevents unnecessary disk wear and avoids serializing hundreds of individual dumps.

### 2.6 Rotated snapshots provide recovery points
The 4-hourly rotated snapshots (`dump-<ISO>.json`) give time-based recovery points. If `dump-latest.json` is corrupted by a filesystem issue, the loader falls back to the most recent valid snapshot.

### 2.7 Portable / easy to back up
The entire data set is a single JSON file. Backing up means copying one file. Restoring means copying one file back and restarting the service.

### 2.8 Repository interface is database-ready
The `Repository` interface (`Repository.ts`) cleanly abstracts the storage layer. Migrating to SQLite, PostgreSQL, or any other database requires only a new implementation of 5 methods — no routes, validation, or frontend code needs to change.

---

## 3. Cons

### 3.1 Data loss window during debounce
**This is the single biggest risk.** If the process crashes (segfault, `OOM killer`, `kill -9`, hardware failure) within the 1-second debounce window after a mutation, that mutation is **permanently lost**. The data was only in the `Map` — it was never written to disk.

The crash window is:
- **Worst case**: 1 full second (if the mutation just reset the debounce timer)
- **Average case**: ~500ms
- **Best case**: 0ms (if the timer fires and the write completes before the crash)

For a personal finance app entering ~1-5 transactions per day, the practical risk is low. But it's a design trade-off worth naming.

### 3.2 No write-ahead log (WAL)
There is no WAL or transaction log. The sequence is:

```
Mutation → Acknowledge HTTP 200/201 → [later] → Persist to disk
```

The HTTP response is sent **before** the data is on disk. This means:
- A crash between the response and the write = **silent data loss** (the user sees `200 OK` but the data never persists).
- Compare with a proper database, where the write-ahead log ensures the data is on disk before the transaction is acknowledged.

### 3.3 No concurrency protection between overlapping `save()` calls
The `DumpManager.save()` method has no mutex, queue, or locking. Two concurrent `save()` calls can race:

1. `save()` A starts → captures state S1 → writes `dump-tmp-1.json` → `rename(tmp1, dump-latest.json)` → latest = S1
2. `save()` B starts → captures state S2 (S1 + mutations) → writes `dump-tmp-2.json` → `rename(tmp2, dump-latest.json)` → latest = S2
3. **`rename` from step 1 finally completes** → latest = S1 (**overwrites S2!**)

The last `rename` wins, and it could be the one with the **older** state. This is a classic TOCTOU race.

**In practice**, this is unlikely because:
- The debounce timer serializes mutations: `save()` only fires after 1 second of inactivity.
- The periodic snapshot (every 4h) is the only other source of concurrent `save()` calls.
- The `rename` syscall is near-instantaneous (microseconds).

But it's not impossible — if a debounced write and a scheduled snapshot overlap, the race is real.

### 3.4 No cross-process safety
If two instances of the server run simultaneously (e.g., during a rolling deploy, or a misconfigured systemd restart), they would:
- Each have their own in-memory `Map` (inconsistent states)
- Both write to the same `dump-latest.json` (last writer wins, the other loses its data)
- Both read from the same file on startup (but then diverge)

The systemd `Restart=always` policy and the single-file design make this unlikely, but it's a hard constraint: **this architecture is single-process only**.

### 3.5 Full-state serialization for every write
Every `save()` serializes the **entire** transaction list to JSON (lines 73-82 in `dump.ts`). For a few thousand transactions, this is a ~1MB JSON string — trivial. But it's O(n) per write, and it grows linearly with data. With 100K+ transactions, this could become a ~10MB write every 1 second of activity.

### 3.6 No query layer — all filtering is O(n)
The `list()` method (lines 98-135 in `InMemoryRepository.ts`) copies the entire Map and filters in JavaScript:
```typescript
let result = Array.from(this.data.values());
if (filter.type) result = result.filter(tx => tx.type === filter.type);
if (filter.year) result = result.filter(tx => new Date(tx.date).getFullYear() === filter.year);
// ...
```
Every filter is O(n). Every `new Date(tx.date)` allocation creates garbage. With a database, indexed queries would be O(log n) or O(1).

### 3.7 No built-in data integrity
The JSON file has no checksums, no referential integrity, and no constraint enforcement beyond what the application code validates. A stray `sed` or `echo` into the file, a partial filesystem write (if the atomic rename fails), or a manual edit gone wrong can corrupt the data. The fallback-to-snapshot logic mitigates this, but there's no `CHECKSUM` or `FOREIGN KEY` equivalent.

### 3.8 Memory-bound data set
All data must fit in the Node.js process's memory. For a personal finance app, this is a non-issue (even 50 years of daily transactions is < 5MB). But it's an architectural ceiling worth documenting.

### 3.9 No concurrent-read consistency guarantee
Since the `Map` is mutated in-place and reads (`list`, `getById`) snapshot `Array.from(this.data.values())`, a read that runs concurrently with a write will see a **point-in-time snapshot** — it won't see a half-applied mutation. This is actually fine for this use case, but it's worth noting that the "snapshot" is not atomic across the entire read path: a summary request that calls `list()`, then computes totals, sees a consistent snapshot because `Array.from()` creates a snapshot at the call time.

---

## 4. Concurrency Analysis

### 4.1 Node.js event loop model

The foundation of correctness: **JavaScript is single-threaded with run-to-completion semantics**.

```
Request A ─► add() ─► this.data.set() ─► scheduleWrite() ─► return
                                                                    │
Request B ──────────────────────────────────────────────────────────► delete() ─► ...
```

All Map operations (`get`, `set`, `delete`, `has`) are synchronous and non-interleaving. **No two handler functions ever run at the same time on the same Node.js event loop.** This means:
- You will never have a `delete` and `add` interleaving on the Map.
- You will never read a Map that is in a half-mutated state.
- `this.data.set(tx.id, tx)` followed by `this.data.has(tx.id)` will always return `true`.

### 4.2 The debounce mechanism

```typescript
private scheduleWrite(): void {
    if (this.shuttingDown) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);  // reset timer
    this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.dumpManager.save(Array.from(this.data.values()));
    }, this.debounceMs);  // default 1000ms
}
```

Each mutation resets the timer. This means:
- **10 rapid mutations** → 1 write (after 1s of inactivity)
- **1 mutation** → 1 write (after 1s)
- **Continuous mutations** (e.g., bulk import) → 1 write (after the last mutation + 1s)

### 4.3 The `save()` race condition (detailed)

Two code paths can call `save()` concurrently:

| Path | Trigger | Cadence |
|------|---------|---------|
| `scheduleWrite()` | Any mutation | ~1s after last mutation |
| `flushSnapshot()` | Periodic timer | Every 4 hours |

The race window opens when both fire within microseconds of each other. The final state of `dump-latest.json` depends on which `rename()` completes last:

```
Time  │ Thread A (debounced write)          │ Thread B (snapshot)
──────┼──────────────────────────────────────┼──────────────────────────────
T0    │ save(Array.from(data)) → captures S1│
T1    │ writeFile(dump-tmp-1.json, S1)       │
T2    │ (I/O in progress)                    │ snapshot(Array.from(data)) → captures S2
T3    │                                      │ save(S2) → writeFile(dump-tmp-2.json, S2)
T4    │ writeFile completes                  │
T5    │ rename(dump-tmp-1, dump-latest)      │
T6    │ latest = S1                          │
T7    │                                      │ writeFile completes
T8    │                                      │ rename(dump-tmp-2, dump-latest)
T9    │                                      │ latest = S2
```

**Result**: `dump-latest.json` = S2 (correct — latest state wins).

But if the order is reversed:

```
T0    │ save(Array.from(data)) → captures S1│
T1    │ writeFile(dump-tmp-1.json, S1)       │
T2    │ (I/O in progress)                    │ snapshot(Array.from(data)) → captures S2
T3    │                                      │ save(S2) → writeFile(dump-tmp-2.json, S2)
T4    │                                      │ writeFile completes
T5    │                                      │ rename(dump-tmp-2, dump-latest)
T6    │                                      │ latest = S2
T7    │ writeFile completes                  │
T8    │ rename(dump-tmp-1, dump-latest)      │
T9    │ latest = S1                          │  ◄── S1 overwrites S2!
```

**Result**: `dump-latest.json` = S1 (**stale** — S2 is lost from the main file!).

However, S2 is still in the rotated snapshot file (written by `snapshot()` after the `save()` call). So recovery is possible by restoring from the rotated snapshot. But in a crash scenario with no rotated snapshot yet, S2 is lost.

**Mitigating factor**: The debounced write fires again after the next mutation, correcting the file. The window for this race is extremely narrow (`writeFile` → `rename` is a fast I/O operation, and the debounce timer only fires after 1s of inactivity).

### 4.4 Process crash window

```
Time  │ Event
──────┼────────────────────────────────────────────────────
T0    │ User submits expense → POST /api/transactions
T1    │ repo.add() → data.set(tx) → scheduleWrite() → timer(1000ms)
T2    │ Response 201 sent to user "Spesa aggiunta!"
T3    │ ─ 500ms of normal operation ─
T4    │ ─ PROCESS CRASHES (OOM, kill -9, power loss) ─
──────┼────────────────────────────────────────────────────
      │ Data LOST: tx was never flushed to disk
```

The user sees `"Spesa aggiunta!"` (success toast), but the data is gone. The 1-second debounce window is the window of vulnerability. For a personal finance app, this is arguably acceptable — the user might lose the last expense they entered, but the rest of the month's data is intact.

### 4.5 Graceful shutdown: the SIGINT/SIGTERM path

```
SIGINT/SIGTERM
    │
    ▼
shuttingDown = true
clearTimeout(debounceTimer)
clearInterval(snapshotInterval)
    │
    ▼
await dumpManager.save(Array.from(this.data.values()))
    │
    ▼
process.exit(0)
```

This is correct and safe. The `await` ensures the final write completes before exit. The `shuttingDown` flag prevents re-entry and suppresses any further `scheduleWrite()` calls.

---

## 5. Bottlenecks & Potential Problems

### 5.1 Scalability ceilings

| Aspect | Current | Limit | Notes |
|--------|---------|-------|-------|
| Data size | ~1-5 MB (years of transactions) | 100 MB+ before memory matters | Serialization O(n) becomes slow at 100K+ tx |
| Read throughput | ~100K req/s | Node.js event loop | Single-threaded, but rarely a bottleneck |
| Write throughput | ~10-50 writes/s | Debounce + single file | Sequential writes only |
| Concurrent users | 1 (single-user app) | 1 (single-user app) | Designed for one user, no locking needed |

### 5.2 File system issues

- **Full disk**: If `FINANCE_DATA_DIR` is on a full filesystem, `writeFile` will fail, and the error is caught and logged but the mutation is already acknowledged. The `save()` error in `scheduleWrite()` is silently caught (`console.error` only).
- **Permission issues**: If the `www-data` user loses write access to `FINANCE_DATA_DIR`, the app continues running (in-memory data is fine) but no persistence happens. On restart, all data since the permission change is lost.
- **NFS / network filesystem**: `rename()` is only atomic on the **same filesystem**. On NFS, `rename()` is not atomic, and the temp-file pattern doesn't guarantee consistency.

### 5.3 Large data handling

The `list()` method creates a new `Date` object for every transaction during filtering (lines 115-121):
```typescript
result = result.filter(tx => {
    const d = new Date(tx.date);  // allocation per transaction
    return d.getFullYear() === filter.year;
});
```
With 10,000 transactions and a summary request, this creates 10,000+ temporary `Date` objects and triggers garbage collection. For a personal finance app, this is negligible. But it's a pattern that doesn't scale.

### 5.4 No backup while running

Dumping the file while the app is running is safe (atomic writes mean you get a consistent snapshot). But:
- **Backup granularity**: The most recent data is in the 1-second debounce window. A backup taken at the wrong moment could miss the last few seconds of data.
- **No point-in-time recovery**: The rotated snapshots are 4 hours apart. You can't recover to "just before I deleted that transaction by mistake."

### 5.5 Debugging / observability

- No query log, no slow query log, no audit trail of data changes.
- No way to see "what was the state of the data 5 minutes ago" without restoring from a snapshot.
- No built-in metrics (read/write counts, latency, data size).

---

## 6. Scenarios: What Happens When...

### 6.1 Two write requests arrive 50ms apart

```
POST /api/transactions (tx1) ─────► add(tx1) ──► scheduleWrite() ──► timer(1000ms)
                                              │
POST /api/transactions (tx2) ──50ms─► add(tx2) ──► scheduleWrite() ──► clearTimeout ──► timer(1000ms)
                                                                                            │
                                                                                    1000ms later
                                                                                            │
                                                                                      save([tx1, tx2])
                                                                                            │
                                                                                      writeFile + rename
```

**Result**: Both transactions are persisted in a single write. The Map has both entries. Correct.

### 6.2 A delete and a write arrive 30ms apart

```
DELETE /api/transactions/:id ──► delete(id) ──► scheduleWrite() ──► timer(1000ms)
                                              │
POST /api/transactions (tx2) ──30ms─► add(tx2) ──► scheduleWrite() ──► clearTimeout ──► timer(1000ms)
                                                                                            │
                                                                                    1000ms later
                                                                                            │
                                                                                      save(Map state after both ops)
                                                                                            │
                                                                                      writeFile + rename
```

**Result**: Both operations are applied to the Map in sequence (correct, thanks to Node's event loop). The debounce timer is reset so one write captures both changes. Correct.

### 6.3 Process crashes during the debounce window

```
add(tx) ──► 200 OK ──► [500ms pass] ──► CRASH
                                           │
                                     tx is LOST
```

**Result**: The user's transaction is acknowledged but never persisted. On restart, the data is as it was before the last successful write. **Data loss.**

### 6.4 The snapshot fires while a debounced write is in progress

(Detailed in section 4.3 above — the `save()` race condition.)

**Result**: In the worst case, the rotated snapshot has the latest data but `dump-latest.json` is slightly stale. The next mutation (and debounced write) corrects the main file. The window is narrow and the impact is temporary.

### 6.5 Two instances start simultaneously

```
Instance A starts ──► load() reads dump-latest.json ──► Map_A = {tx1, tx2}
Instance B starts ──► load() reads dump-latest.json ──► Map_B = {tx1, tx2}

User adds tx3 ──► hits Instance A ──► Map_A = {tx1, tx2, tx3} ──► save() ──► dump-latest.json = {tx1, tx2, tx3}
User adds tx4 ──► hits Instance B ──► Map_B = {tx1, tx2, tx4} ──► save() ──► dump-latest.json = {tx1, tx2, tx4}
                                                                           ──► tx3 is OVERWRITTEN and LOST
```

**Result**: Data loss. Two instances must never run simultaneously. The architecture is single-process only.

### 6.6 The disk fills up

```
add(tx) ──► 200 OK ──► scheduleWrite() ──► timer fires ──► save() ──► writeFile() ──► DISK FULL
                                                                                         │
                                                                                   writeFile throws
                                                                                         │
                                                                                   catch → console.error
                                                                                         │
                                                                              User thinks data is saved
                                                                              Data is only in memory
```

**Result**: Silent data loss if the process restarts before the disk is cleaned up. A disk-full alert or monitoring would catch this, but the app itself doesn't report it.

---

## 7. Recommendations

### Priority: Low (single-user app, low risk)

For a **personal, single-user finance app**, the current architecture is **good enough**. The risks are:

- **Acceptable**: Data loss within a 1-second crash window (you lose the last expense you entered — annoying, not catastrophic).
- **Acceptable**: The `save()` race condition (window is narrow, and the debounced write fires again).
- **Acceptable**: No WAL (you're not running a bank).
- **Low probability**: The overlapping snapshot/write scenario (4-hourly timer vs 1-second debounce).

### If you want to harden it (low effort, high impact)

1. **Add a simple mutex around `save()`** (prevents the `save()` race condition entirely):

   ```typescript
   private saving = false;
   private saveQueue: (() => void)[] = [];

   async save(transactions: Transaction[]): Promise<void> {
       if (this.saving) {
           return new Promise(resolve => this.saveQueue.push(resolve));
       }
       this.saving = true;
       try {
           const dump = { ... };
           const tmpPath = join(this.dataDir, `dump-tmp-${Date.now()}.json`);
           await writeFile(tmpPath, JSON.stringify(dump, null, 2), 'utf-8');
           await rename(tmpPath, this.latestPath);
       } finally {
           this.saving = false;
           if (this.saveQueue.length > 0) {
               const next = this.saveQueue.shift()!;
               next(); // unblock the next waiter
           }
       }
   }
   ```

2. **Reduce the debounce window** (or make it configurable via env):
   - Current: 1000ms
   - Recommended: 500ms or let the user set `FINANCE_DEBOUNCE_MS`
   - This halves the worst-case data loss window.

3. **Add a metadata marker** that tracks the last `savedAt` timestamp in memory and compares it on startup. If the last write was more than `DEBOUNCE_MS + 1s` ago, you know all data was persisted. If not, log a warning.

4. **Add basic health/monitoring**: Report whether the last `save()` succeeded, the data directory has free space, and the dump file is valid. Expose at `/api/health` (already exists) or a `/api/status` endpoint.

### If you want to migrate to a database (when you need more)

The `Repository` interface already supports this. SQLite (`better-sqlite3`) would be the natural upgrade path:

- **Pros**: WAL mode (crash-safe), ACID transactions, indexed queries, concurrent read support, no server process (embedded), single file backup.
- **Cons**: Adds a native dependency, slightly more complex deployment, overkill for a personal finance app today.

---

## Summary

| Aspect | Verdict |
|--------|---------|
| **Read performance** | ✅ Excellent — all in-memory |
| **Write performance** | ✅ Good — debounced, atomic, single-file |
| **Crash safety** | ⚠️ Adequate — up to 1s data loss window |
| **Concurrency safety** | ⚠️ Adequate — event loop protects Map; `save()` race is possible but narrow |
| **Data integrity** | ⚠️ Adequate — atomic writes + fallback snapshots |
| **Scalability** | ✅ Good for single-user — hits memory/CPU limits only at 100K+ transactions |
| **Operational simplicity** | ✅ Excellent — zero dependencies beyond Node.js |
| **Backup/restore** | ✅ Excellent — copy one file |
| **Cross-process safety** | ❌ Not supported — single-process only |

**Bottom line**: The architecture is well-suited for its purpose (personal, single-user finance tracking). The concurrency model relies on Node.js's single-threaded event loop for correctness, which is appropriate for this use case. The main risk — data loss within the 1-second debounce window — is an acceptable trade-off for the simplicity gained. The `save()` race condition is a real bug, but its probability is low and its impact is temporary (corrected by the next mutation and debounced write).