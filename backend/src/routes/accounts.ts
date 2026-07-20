import { Router } from 'express';
import { AccountRepository, NotFoundError } from '../AccountRepository.js';
import type { AccountType } from '../types.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function createAccountRouter(repo: AccountRepository): Router {
  const router = Router();

  // ── Accounts ───────────────────────────────────────────────────────────

  // GET /api/accounts
  router.get('/accounts', async (_req, res) => {
    try {
      const accounts = await repo.listAccounts();
      res.json(accounts);
    } catch (err) {
      console.error('GET /accounts error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /api/accounts/types — unique account types used
  router.get('/accounts/types', async (_req, res) => {
    try {
      const accounts = await repo.listAccounts();
      const types = new Set(accounts.map(a => a.type));
      res.json(Array.from(types).sort());
    } catch (err) {
      console.error('GET /accounts/types error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /api/accounts/wealth — all accounts with latest balance
  router.get('/accounts/wealth', async (_req, res) => {
    try {
      const accounts = await repo.listAccounts();
      const result = await Promise.all(accounts.map(async (acc) => {
        const balances = await repo.listBalances(acc.id);
        const latestBalance = balances.length > 0
          ? balances.reduce((a, b) => a.date > b.date ? a : b).balance
          : null;
        return { ...acc, latestBalance };
      }));
      res.json(result);
    } catch (err) {
      console.error('GET /accounts/wealth error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /api/accounts/wealth/history — net wealth over time (one point per unique date)
  router.get('/accounts/wealth/history', async (_req, res) => {
    try {
      const accounts = await repo.listAccounts();
      const allBalances: { accountId: string; balance: number; date: string }[] = [];
      for (const acc of accounts) {
        const balances = await repo.listBalances(acc.id);
        for (const b of balances) {
          allBalances.push({ accountId: acc.id, balance: b.balance, date: b.date });
        }
      }

      if (allBalances.length === 0) {
        res.json([]);
        return;
      }

      // Collect all unique dates sorted
      const dateSet = new Set(allBalances.map(b => b.date));
      const sortedDates = Array.from(dateSet).sort();

      // For each date, compute net wealth: for each account, use the latest balance at or before that date
      const history: { date: string; netWealth: number; accountCount: number }[] = [];

      for (const targetDate of sortedDates) {
        let netWealth = 0;
        let accountCount = 0;
        for (const acc of accounts) {
          const accBalances = allBalances
            .filter(b => b.accountId === acc.id && b.date <= targetDate)
            .sort((a, b) => b.date.localeCompare(a.date));
          if (accBalances.length > 0) {
            netWealth += accBalances[0].balance;
            accountCount++;
          }
        }
        history.push({ date: targetDate, netWealth, accountCount });
      }

      res.json(history);
    } catch (err) {
      console.error('GET /accounts/wealth/history error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /api/accounts/reconciliation/:id — compare transaction-based balance vs balance logs
  router.get('/accounts/reconciliation/:id', async (req, res) => {
    try {
      const account = await repo.getAccount(req.params.id);
      if (!account) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        return;
      }

      const balances = await repo.listBalances(req.params.id);
      // The repo already returns sorted desc by date; reverse for asc
      const sortedBalances = [...balances].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

      // We need transactions linked to this account — access via the transaction repo
      // This requires the transaction Repository. We'll pass it via router.
      // For now, return just the balance logs with computed deltas
      const deltas: { fromDate: string; fromBalance: number; toDate: string; toBalance: number; delta: number; daysBetween: number }[] = [];
      for (let i = 1; i < sortedBalances.length; i++) {
        const prev = sortedBalances[i - 1];
        const curr = sortedBalances[i];
        const fromDate = new Date(prev.date + 'T00:00:00');
        const toDate = new Date(curr.date + 'T00:00:00');
        const daysBetween = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
        deltas.push({
          fromDate: prev.date,
          fromBalance: prev.balance,
          toDate: curr.date,
          toBalance: curr.balance,
          delta: curr.balance - prev.balance,
          daysBetween,
        });
      }

      res.json({
        account,
        balanceLogs: sortedBalances,
        deltas,
        balanceLogCount: sortedBalances.length,
        latestBalance: sortedBalances.length > 0 ? sortedBalances[sortedBalances.length - 1].balance : null,
        firstBalance: sortedBalances.length > 0 ? sortedBalances[0].balance : null,
        totalChange: sortedBalances.length >= 2
          ? sortedBalances[sortedBalances.length - 1].balance - sortedBalances[0].balance
          : null,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('GET /accounts/reconciliation/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // POST /api/accounts
  router.post('/accounts', async (req, res) => {
    try {
      const { name, type, currency, color } = req.body as Record<string, unknown>;
      const errors: string[] = [];

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required');
      }
      if (!type || typeof type !== 'string' || type.trim().length === 0) {
        errors.push('type is required');
      }
      if (currency !== undefined && (typeof currency !== 'string' || currency.length < 1)) {
        errors.push('currency must be a non-empty string');
      }
      if (color !== undefined && (typeof color !== 'string' || !color.match(/^#[0-9a-fA-F]{6}$/))) {
        errors.push('color must be a hex color (e.g. #2563eb)');
      }

      if (errors.length > 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } });
        return;
      }

      const account = await repo.createAccount({
        name: name as string,
        type: type as AccountType,
        currency: (currency as string) || 'EUR',
        color: (color as string) || '#6366f1',
      });
      res.status(201).json(account);
    } catch (err) {
      console.error('POST /accounts error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /api/accounts/:id
  router.get('/accounts/:id', async (req, res) => {
    try {
      const account = await repo.getAccount(req.params.id);
      if (!account) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        return;
      }
      res.json(account);
    } catch (err) {
      console.error('GET /accounts/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // PATCH /api/accounts/:id
  router.patch('/accounts/:id', async (req, res) => {
    try {
      const allowedFields = ['name', 'type', 'currency', 'color'];
      const patch: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      }

      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one field to update is required' } });
        return;
      }

      const account = await repo.updateAccount(req.params.id, patch);
      res.json(account);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('PATCH /accounts/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // DELETE /api/accounts/:id
  router.delete('/accounts/:id', async (req, res) => {
    try {
      await repo.deleteAccount(req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('DELETE /accounts/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // ── Balance logs ───────────────────────────────────────────────────────

  // GET /api/accounts/:id/balances
  router.get('/accounts/:id/balances', async (req, res) => {
    try {
      const account = await repo.getAccount(req.params.id);
      if (!account) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        return;
      }
      const balances = await repo.listBalances(req.params.id);
      res.json(balances);
    } catch (err) {
      console.error('GET /accounts/:id/balances error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // POST /api/accounts/:id/balances
  router.post('/accounts/:id/balances', async (req, res) => {
    try {
      const { balance, date, note } = req.body as Record<string, unknown>;
      const errors: string[] = [];

      if (typeof balance !== 'number' || !Number.isInteger(balance)) {
        errors.push('balance must be an integer (centesimi)');
      }
      if (typeof date !== 'string' || !DATE_REGEX.test(date)) {
        errors.push('date must be in YYYY-MM-DD format');
      }
      if (note !== undefined && note !== null && typeof note !== 'string') {
        errors.push('note must be a string');
      }
      if (note !== undefined && typeof note === 'string' && note.length > 200) {
        errors.push('note must be at most 200 characters');
      }

      if (errors.length > 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } });
        return;
      }

      const log = await repo.createBalance({
        accountId: req.params.id,
        balance: balance as number,
        date: date as string,
        note: (note as string) || undefined,
      });
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('POST /accounts/:id/balances error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // PATCH /api/balances/:id
  router.patch('/balances/:id', async (req, res) => {
    try {
      const allowedFields = ['balance', 'date', 'note'];
      const patch: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      }

      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one field to update is required' } });
        return;
      }

      const log = await repo.updateBalance(req.params.id, patch);
      res.json(log);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('PATCH /balances/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  // DELETE /api/balances/:id
  router.delete('/balances/:id', async (req, res) => {
    try {
      await repo.deleteBalance(req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      console.error('DELETE /balances/:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}