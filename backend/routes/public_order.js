const express = require('express');
const router = express.Router();

// @route   GET api/:slug/public/order/:token
// @desc    Get order details for the public view
router.get('/:token', (req, res) => {
    try {
        const order = req.db.prepare(`
            SELECT o.id, o.status, o.description, o.created_at, o.updated_at,
                   v.brand, v.model, v.plate,
                   c.workshop_name, c.phone as workshop_phone, c.address as workshop_address, c.logo_path
            FROM orders o
            JOIN vehicles v ON o.vehicle_id = v.id
            CROSS JOIN config c
            WHERE o.share_token = ?
        `).get(req.params.token);

        if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

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
