import { Router } from 'express';
export default function createSummaryRouter(repo) {
    const router = Router();
    // GET /api/summary/month?year=&month=
    router.get('/summary/month', async (req, res) => {
        try {
            const now = new Date();
            const year = parseInt(req.query.year, 10) || now.getFullYear();
            const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
            if (month < 1 || month > 12) {
                res.status(400).json({
                    error: { code: 'VALIDATION_ERROR', message: 'month must be 1-12' },
                });
                return;
            }
            const transactions = await repo.list({ year, month });
            const summary = computeMonthSummary(transactions, year, month);
            res.json(summary);
        }
        catch (err) {
            console.error('GET /summary/month error:', err);
            res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
            });
        }
    });
    // GET /api/summary/year?year=
    router.get('/summary/year', async (req, res) => {
        try {
            const year = parseInt(req.query.year, 10) || new Date().getFullYear();
            const allTransactions = await repo.list({ year });
            const summary = computeYearSummary(allTransactions, year);
            res.json(summary);
        }
        catch (err) {
            console.error('GET /summary/year error:', err);
            res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
            });
        }
    });
    return router;
}
function computeMonthSummary(transactions, year, month) {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const tx of transactions) {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        }
        else {
            totalExpenses += tx.amount;
        }
    }
    return {
        year,
        month,
        totalIncome,
        totalExpenses,
        difference: totalIncome - totalExpenses,
    };
}
function computeYearSummary(transactions, year) {
    const months = Array.from({ length: 12 }, () => null);
    // Group by month
    for (let m = 0; m < 12; m++) {
        const monthTxs = transactions.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === m;
        });
        if (monthTxs.length > 0) {
            months[m] = computeMonthSummary(monthTxs, year, m + 1);
        }
    }
    const totalIncome = months.reduce((sum, m) => sum + (m?.totalIncome ?? 0), 0);
    const totalExpenses = months.reduce((sum, m) => sum + (m?.totalExpenses ?? 0), 0);
    return {
        year,
        months,
        totalIncome,
        totalExpenses,
        totalDifference: totalIncome - totalExpenses,
    };
}
//# sourceMappingURL=summary.js.map