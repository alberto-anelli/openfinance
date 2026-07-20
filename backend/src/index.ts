import express from 'express';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { InMemoryRepository } from './InMemoryRepository.js';
import { AccountRepository } from './AccountRepository.js';
import createTransactionRouter from './routes/transactions.js';
import createSummaryRouter from './routes/summary.js';
import createAccountRouter from './routes/accounts.js';
import healthRouter from './routes/health.js';

const PORT = parseInt(process.env.FINANCE_PORT || '3900', 10);
const DATA_DIR = process.env.FINANCE_DATA_DIR || '/var/lib/finance';
const DUMP_INTERVAL_MS = parseInt(process.env.FINANCE_DUMP_INTERVAL_MS || '14400000', 10); // 4h
const DUMP_KEEP = parseInt(process.env.FINANCE_DUMP_KEEP || '10', 10);

async function main() {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }

  // Initialize repositories
  const repo = new InMemoryRepository({
    dataDir: DATA_DIR,
    dumpIntervalMs: DUMP_INTERVAL_MS,
    dumpKeep: DUMP_KEEP,
  });
  await repo.init();

  const accountRepo = new AccountRepository({ dataDir: DATA_DIR });
  await accountRepo.init();

  // Create Express app
  const app = express();

  // Middleware
  app.use(express.json());

  // API routes
  app.use('/api', createTransactionRouter(repo));
  app.use('/api', createSummaryRouter(repo));
  app.use('/api', createAccountRouter(accountRepo));
  app.use('/api', healthRouter);

  // Start server
  app.listen(PORT, () => {
    console.log(`Finance API listening on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Dump interval: ${DUMP_INTERVAL_MS}ms`);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});