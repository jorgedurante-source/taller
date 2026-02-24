const express = require('express');
const router = express.Router();

// @route   GET api/:slug/public/order/:token
// @desc    Get order details for the public view
router.get('/:token', (req, res) => {
    try {
        const token = (req.params.token || '').trim();
        console.log(`[PublicOrder] Searching for token: "${token}" in tenant: ${req.slug}`);

        const order = req.db.prepare(`
            SELECT o.id, o.status, o.description, o.created_at, o.updated_at, o.appointment_date,
                   v.brand, v.model, v.plate,
                   (SELECT workshop_name FROM config LIMIT 1) as workshop_name,
                   (SELECT phone FROM config LIMIT 1) as workshop_phone,
                   (SELECT address FROM config LIMIT 1) as workshop_address,
                   (SELECT logo_path FROM config LIMIT 1) as logo_path,
                   (SELECT enabled_modules FROM config LIMIT 1) as enabled_modules
            FROM orders o
            LEFT JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.share_token = ?
        `).get(token);

        if (!order) {
            console.log(`[PublicOrder] ❌ Order NOT found for token: "${token}"`);
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        console.log(`[PublicOrder] ✅ Order found: #${order.id}`);

        const items = req.db.prepare('SELECT description, subtotal FROM order_items WHERE order_id = ?').all(order.id);
        const history = req.db.prepare(`
            SELECT status, notes, created_at 
            FROM order_history 
            WHERE order_id = ? 
            ORDER BY created_at DESC
        `).all(order.id);

        res.json({ ...order, items, history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener la orden' });
    }
});

module.exports = router;
