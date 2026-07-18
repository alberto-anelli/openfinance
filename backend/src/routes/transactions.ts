import { Router } from 'express';
import type { Repository } from '../Repository.js';
import { NotFoundError } from '../InMemoryRepository.js';
import { validateTransaction, validatePatch } from '../validation.js';

export default function createTransactionRouter(repo: Repository): Router {
  const router = Router();

  // POST /api/transactions — create
  router.post('/transactions', async (req, res) => {
    try {
      const errors = validateTransaction(req.body as Record<string, unknown>);
      if (errors.length > 0) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: errors.map(e => e.message).join('; ') },
        });
        return;
      }

      const { type, amount, category, date } = req.body as {
        type: 'expense' | 'income';
        amount: number;
        category: string;
        date: string;
      };

      const cleaned = {
        type,
        amount,
        category: type === 'expense' ? category.trim() : category,
        date,
      };

      const tx = await repo.add(cleaned);
      res.status(201).json(tx);
    } catch (err) {
      console.error('POST /transactions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // GET /api/transactions — list with filters
  router.get('/transactions', async (req, res) => {
    try {
      const filter: Record<string, unknown> = {};

      if (req.query.year) {
        const year = parseInt(req.query.year as string, 10);
        if (!isNaN(year)) filter.year = year;
      }
      if (req.query.month) {
        const month = parseInt(req.query.month as string, 10);
        if (!isNaN(month)) filter.month = month;
      }
      if (req.query.type === 'expense' || req.query.type === 'income') {
        filter.type = req.query.type;
      }
      if (req.query.category && typeof req.query.category === 'string') {
        filter.category = req.query.category;
      }

      const transactions = await repo.list(filter as Parameters<Repository['list']>[0]);
      res.json(transactions);
    } catch (err) {
      console.error('GET /transactions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // GET /api/transactions/:id — get by ID
  router.get('/transactions/:id', async (req, res) => {
    try {
      const tx = await repo.getById(req.params.id);
      if (!tx) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Transaction ${req.params.id} not found` },
        });
        return;
      }
      res.json(tx);
    } catch (err) {
      console.error('GET /transactions/:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // PATCH /api/transactions/:id — update
  router.patch('/transactions/:id', async (req, res) => {
    try {
      const { cleaned, errors } = validatePatch(req.body as Record<string, unknown>);
      if (errors.length > 0) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: errors.map(e => e.message).join('; ') },
        });
        return;
      }

      const tx = await repo.update(req.params.id, cleaned as Parameters<Repository['update']>[1]);
      res.json(tx);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: err.message },
        });
        return;
      }
      console.error('PATCH /transactions/:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // DELETE /api/transactions/:id — delete
  router.delete('/transactions/:id', async (req, res) => {
    try {
      await repo.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: err.message },
        });
        return;
      }
      console.error('DELETE /transactions/:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  return router;
}