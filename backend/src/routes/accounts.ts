import { Router } from 'express';
import { AccountRepository, NotFoundError } from '../AccountRepository.js';
import type { AccountType } from '../types.js';

const VALID_TYPES: AccountType[] = ['bank', 'credit_card', 'debit_card', 'savings', 'cash', 'other'];
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

  // POST /api/accounts
  router.post('/accounts', async (req, res) => {
    try {
      const { name, type, currency, color } = req.body as Record<string, unknown>;
      const errors: string[] = [];

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required');
      }
      if (!type || !VALID_TYPES.includes(type as AccountType)) {
        errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
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