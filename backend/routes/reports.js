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
router.get('/dashboard', auth, hasPermission('dashboard'), (req, res) => {
    try {
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        const includeParts = config.income_include_parts ?? 1;
        const partsPercentageValue = config.parts_profit_percentage ?? 100;
        const partsPercentage = partsPercentageValue / 100.0;

        // 1. Monthly Income Breakdown - based on items for paid/partial orders
        const incomeByMonth = req.db.prepare(`
          SELECT 
            strftime('%Y-%m', o.updated_at) as month,
            SUM(oi.labor_price) as labor_income,
            SUM(oi.parts_price) as parts_price,
            SUM(oi.parts_profit) as parts_profit
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('cobrado', 'parcial')
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        // 1.1 Historical Totals
        const historicalStats = req.db.prepare(`
          SELECT 
            SUM(oi.labor_price) as labor_total,
            SUM(oi.parts_price) as parts_total,
            SUM(oi.parts_profit) as parts_profit_total
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('cobrado', 'parcial')
        `).get();

        // 1.2 Monthly Totals (Current Month)
        const monthlyStats = req.db.prepare(`
          SELECT 
            SUM(oi.labor_price) as labor_total,
            SUM(oi.parts_price) as parts_total,
            SUM(oi.parts_profit) as parts_profit_total
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('cobrado', 'parcial')
          AND strftime('%Y-%m', o.updated_at) = strftime('%Y-%m', 'now')
        `).get();

        // If no income data, provide at least the current month
        if (incomeByMonth.length === 0) {
            const now = new Date();
            const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            incomeByMonth.push({ month: localMonth, labor_income: 0, parts_price: 0 });
        }

        // 2. Orders by Status
        // ... (rest of the code remains similar but we return new fields)
        const ordersByStatus = req.db.prepare(`
          SELECT status, COUNT(*) as count
          FROM orders
          GROUP BY status
        `).all();

        const readyToDeliverTotal = req.db.prepare(`
            SELECT SUM(oi.labor_price + (CASE WHEN ? = 1 THEN oi.parts_profit ELSE 0 END)) as total
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status = 'Listo para entrega'
        `).get(includeParts).total || 0;

        const commonServices = req.db.prepare(`
          SELECT description, COUNT(*) as count
          FROM orders
          GROUP BY description
          ORDER BY count DESC
          LIMIT 5
        `).all();

        const vehiclesByMonth = req.db.prepare(`
          SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
          FROM vehicles
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        const newClientsThisMonth = req.db.prepare(`
          SELECT COUNT(*) as count 
          FROM clients 
          WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `).get().count;

        const assignedAppointmentsCount = req.db.prepare(`
          SELECT COUNT(*) as count FROM orders WHERE status = 'Turno asignado'
        `).get().count;

        res.json({
            incomeByMonth,
            historicalStats,
            monthlyStats,
            parts_profit_percentage: partsPercentageValue,
            ordersByStatus,
            commonServices,
            vehiclesByMonth,
            newClientsThisMonth,
            readyToDeliverTotal,
            assignedAppointmentsCount
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
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        const partsPercentage = (config.parts_profit_percentage ?? 100) / 100.0;

        // Separate income into labor and parts profit
        const dailyIncome = req.db.prepare(`
            SELECT 
                strftime('%d', o.updated_at) as day,
                SUM(oi.labor_price) as labor_income,
                SUM(oi.parts_profit) as parts_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
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

// @route   GET api/reports/orders-status
router.get('/orders-status', auth, (req, res) => {
    try {
        const ordersByStatus = req.db.prepare(`
            SELECT status, COUNT(*) as count
            FROM orders
            GROUP BY status
        `).all();
        res.json(ordersByStatus);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/reports/top-customers
router.get('/top-customers', auth, (req, res) => {
    try {
        const topCustomers = req.db.prepare(`
            SELECT c.first_name || ' ' || c.last_name AS name, SUM(o.payment_amount) as total
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            GROUP BY c.id
            ORDER BY total DESC
            LIMIT 5
        `).all();
        res.json(topCustomers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// @route   GET api/reports/reminders
router.get('/reminders', auth, hasPermission('reminders'), (req, res) => {
    const tab = req.query.tab || 'today';
    try {
        let whereClause = "WHERE o.reminder_at IS NOT NULL AND o.status = 'Entregado'";
        const todayStr = "date('now', 'localtime')";
        const tomorrowStr = "date('now', '+1 day', 'localtime')";
        const lastWeekStr = "date('now', '-7 days', 'localtime')";

        const dayOfWeek = new Date().getDay(); // 0 = Sun

        switch (tab) {
            case 'today':
                // Today + Sunday if it's Monday
                if (dayOfWeek === 1) { // Monday
                    whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) <= ${todayStr}`;
                } else {
                    whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) = ${todayStr}`;
                }
                break;
            case 'upcoming':
                whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) > ${todayStr}`;
                break;
            case 'skipped':
                whereClause += " AND o.reminder_status = 'skipped'";
                break;
            case 'sent':
                whereClause += ` AND o.reminder_status = 'sent' AND date(o.reminder_sent_at) >= ${lastWeekStr}`;
                break;
            case 'history': // Backward compatibility
                whereClause += ` AND (o.reminder_status = 'sent' OR o.reminder_at < ${todayStr})`;
                break;
        }

        const reminders = req.db.prepare(`
            SELECT o.id as order_id, o.reminder_at, o.status, o.reminder_status, o.reminder_sent_at,
                   c.first_name || ' ' || c.last_name as client_name, c.phone as client_phone,
                   v.plate, v.brand, v.model, v.km as vehicle_km,
                   (SELECT GROUP_CONCAT(description, ', ') FROM order_items WHERE order_id = o.id) as services_done
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            JOIN vehicles v ON o.vehicle_id = v.id
            ${whereClause}
            ORDER BY o.reminder_at ASC
        `).all();
        res.json(reminders);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PATCH api/reports/reminders/:orderId/date
router.patch('/reminders/:orderId/date', auth, hasPermission('reminders'), (req, res) => {
    const { date } = req.body;
    try {
        req.db.prepare('UPDATE orders SET reminder_at = ? WHERE id = ?').run(
            date,
            req.params.orderId
        );
        res.json({ message: 'Fecha de recordatorio actualizada' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating date');
    }
});

// @route   POST api/reports/reminders/send-bulk
router.post('/reminders/send-bulk', auth, hasPermission('reminders'), async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'No order IDs provided' });
    }

    const { sendOrderReminder } = require('../lib/reminderUtils');
    const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

    let sentCount = 0;
    let errors = [];

    for (const id of orderIds) {
        try {
            await sendOrderReminder(req.db, id, req.slug, config);
            sentCount++;
        } catch (err) {
            console.error(`Error sending bulk reminder for #${id}:`, err.message);
            errors.push({ id, message: err.message });
        }
    }

    res.json({
        message: `Se enviaron ${sentCount} recordatorios correctamente`,
        sentCount,
        errors
    });
});

module.exports = router;
