const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');
const { generateOrderPDF } = require('../lib/pdfGenerator');

// @route   GET api/reports/budget-pdf/:id
router.get('/budget-pdf/:id', auth, async (req, res) => {
    try {
        const budget = req.db.prepare('SELECT order_id FROM budgets WHERE id = ?').get(req.params.id);
        if (!budget) return res.status(404).send('Budget not found');

        const pdfBuffer = await generateOrderPDF(req.db, budget.order_id);
        if (!pdfBuffer) return res.status(404).send('Error generating PDF');

        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

// @route   GET api/reports/order-pdf/:id
router.get('/order-pdf/:id', auth, async (req, res) => {
    try {
        const pdfBuffer = await generateOrderPDF(req.db, req.params.id);
        if (!pdfBuffer) return res.status(404).send('Order not found');

        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

// @route   GET api/reports/dashboard
router.get('/dashboard', auth, (req, res) => {
    try {
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        const includeParts = config.income_include_parts ?? 1;
        const partsPercentage = (config.parts_profit_percentage ?? 100) / 100.0;

        // 1. Monthly Income - based on actual payment_amount, using updated_at (delivery/payment date)
        const incomeByMonth = req.db.prepare(`
          SELECT 
            strftime('%Y-%m', o.updated_at) as month,
            SUM(o.payment_amount) as total
          FROM orders o
          WHERE o.payment_status IN ('cobrado', 'parcial')
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        // If no income data, provide at least the current month
        if (incomeByMonth.length === 0) {
            const now = new Date();
            const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            incomeByMonth.push({ month: localMonth, total: 0 });
        }

        // 2. Orders by Status
        const ordersByStatus = req.db.prepare(`
          SELECT status, COUNT(*) as count
          FROM orders
          GROUP BY status
        `).all();

        // Extra: Calculate total $ value of "Listo para entrega" (not yet paid - uses items sum)
        const readyToDeliverTotal = req.db.prepare(`
            SELECT SUM(oi.labor_price + (CASE WHEN ? = 1 THEN oi.parts_price * ? ELSE 0 END)) as total
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status = 'Listo para entrega'
        `).get(includeParts, partsPercentage).total || 0;

        // 3. Most Common Services
        const commonServices = req.db.prepare(`
          SELECT description, COUNT(*) as count
          FROM orders
          GROUP BY description
          ORDER BY count DESC
          LIMIT 5
        `).all();

        // 4. Vehicles by Month
        const vehiclesByMonth = req.db.prepare(`
          SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
          FROM vehicles
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        // 5. New Clients this month
        const newClientsThisMonth = req.db.prepare(`
          SELECT COUNT(*) as count 
          FROM clients 
          WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `).get().count;

        res.json({
            incomeByMonth,
            ordersByStatus,
            commonServices,
            vehiclesByMonth,
            newClientsThisMonth,
            readyToDeliverTotal
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/reports/income-daily
router.get('/income-daily', auth, hasPermission('income'), (req, res) => {
    const { month } = req.query; // YYYY-MM

    // Use local date to avoid UTC timezone month shift
    const now = new Date();
    const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonth = month || localMonth;

    try {
        // Use payment_amount directly - no config/items join needed
        const dailyIncome = req.db.prepare(`
            SELECT 
                strftime('%d', o.updated_at) as day,
                SUM(o.payment_amount) as total
            FROM orders o
            WHERE o.payment_status IN ('cobrado', 'parcial')
            AND strftime('%Y-%m', o.updated_at) = ?
            GROUP BY day
            ORDER BY day ASC
        `).all(currentMonth);

        res.json(dailyIncome);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
