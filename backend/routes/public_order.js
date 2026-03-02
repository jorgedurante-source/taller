const express = require('express');
const router = express.Router();

// @route   GET api/:slug/public/order/:token
// @desc    Get order details for the public view
// @route   GET api/:slug/public/order/:token
// @desc    Get order details for the public view
router.get('/:token', (req, res) => {
    try {
        const token = (req.params.token || '').trim();
        console.log(`[PublicOrder] Searching for token: "${token}" in tenant: ${req.slug}`);

        const order = req.db.prepare(`
            SELECT o.id, o.status, o.description, o.created_at, o.updated_at, o.appointment_date,
                   o.budget_approval_status, o.budget_approval_notes, o.budget_approved_at,
                   o.transferred_to_slug, o.transferred_to_order_id,
                   v.brand, v.model, v.version, v.plate,
                   (SELECT workshop_name FROM config LIMIT 1) as workshop_name,
                   (SELECT phone FROM config LIMIT 1) as workshop_phone,
                   (SELECT address FROM config LIMIT 1) as workshop_address,
                   (SELECT logo_path FROM config LIMIT 1) as logo_path,
                   (SELECT enabled_modules FROM config LIMIT 1) as enabled_modules,
                   (SELECT client_portal_language FROM config LIMIT 1) as client_portal_language
            FROM orders o
            LEFT JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.share_token = ?
        `).get(token);

        if (!order) {
            console.log(`[PublicOrder] ❌ Order NOT found for token: "${token}"`);
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Feature 2: Transferred order handling
        if (order.status === 'transferred' && order.transferred_to_slug) {
            const { getDb } = require('../tenantManager');
            try {
                const targetDb = getDb(order.transferred_to_slug);
                const targetOrder = targetDb.prepare('SELECT share_token FROM orders WHERE id = ?').get(order.transferred_to_order_id);
                order.transferred_to_share_token = targetOrder?.share_token;
            } catch (e) {
                console.error('Failed to get target share_token:', e.message);
            }
        }

        console.log(`[PublicOrder] ✅ Order found: #${order.id}`);

        const items = req.db.prepare('SELECT description, subtotal FROM order_items WHERE order_id = ?').all(order.id);
        const history = req.db.prepare(`
            SELECT status, notes, created_at 
            FROM order_history 
            WHERE order_id = ? AND status NOT IN ('response_received', 'response_sent')
            ORDER BY created_at DESC
        `).all(order.id);

        // Feature 1: Latest budget
        const budget = req.db.prepare(`
            SELECT items, subtotal, tax, total 
            FROM budgets 
            WHERE order_id = ? 
            ORDER BY id DESC LIMIT 1
        `).get(order.id);

        if (budget) {
            try { budget.items = JSON.parse(budget.items); } catch (e) { }
        }

        // Include vehicle health data for the client portal (only high-confidence predictions)
        let vehicleHealth = [];
        try {
            vehicleHealth = req.db.prepare(`
                SELECT service_description, predicted_next_date, predicted_next_km,
                       avg_km_interval, avg_day_interval, confidence, last_done_at
                FROM service_intervals
                WHERE vehicle_id = (SELECT vehicle_id FROM orders WHERE share_token = ?)
                  AND confidence >= 50
                ORDER BY predicted_next_date ASC
                LIMIT 5
            `).all(token);
        } catch (e) {
            // Table may not exist on older tenants — fail silently
        }

        res.json({ ...order, items, history, vehicleHealth, budget });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener la orden' });
    }
});

// @route   POST api/:slug/public/order/:token/approve
router.post('/:token/approve', (req, res) => {
    const { notes } = req.body;
    const { token } = req.params;

    const order = req.db.prepare('SELECT id, status FROM orders WHERE share_token = ?').get(token);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    if (order.status !== 'quoted') {
        return res.status(400).json({ message: 'El presupuesto no está pendiente de aprobación' });
    }

    req.db.prepare(`
        UPDATE orders SET 
            status = 'approved',
            budget_approval_status = 'approved',
            budget_approval_notes = ?,
            budget_approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(notes || null, order.id);

    req.db.prepare(`
        INSERT INTO order_history (order_id, status, notes)
        VALUES (?, 'approved', 'Presupuesto aprobado por el cliente')
    `).run(order.id);

    // Trigger templates (same as orders.js logic)
    try {
        const { triggerStatusTemplate } = require('../lib/templates');
        triggerStatusTemplate(req.db, req.slug, order.id);
    } catch (e) {
        console.error('Template trigger error:', e.message);
    }

    res.json({ message: 'Presupuesto aprobado', order_id: order.id });
});

// @route   POST api/:slug/public/order/:token/reject
router.post('/:token/reject', (req, res) => {
    const { notes } = req.body;
    const { token } = req.params;

    const order = req.db.prepare('SELECT id, status FROM orders WHERE share_token = ?').get(token);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    req.db.prepare(`
        UPDATE orders SET 
            status = 'rejected',
            budget_approval_status = 'rejected',
            budget_approval_notes = ?
        WHERE id = ?
    `).run(notes || null, order.id);

    req.db.prepare(`
        INSERT INTO order_history (order_id, status, notes)
        VALUES (?, 'rejected', 'Presupuesto rechazado por el cliente')
    `).run(order.id);

    res.json({ message: 'Presupuesto rechazado', order_id: order.id });
});

module.exports = router;
