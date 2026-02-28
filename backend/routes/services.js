const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');
const { logActivity } = require('../lib/auditLogger');

// @route   GET api/services
router.get('/', auth, (req, res) => {
    const services = req.db.prepare('SELECT * FROM service_catalog ORDER BY name ASC').all();
    res.json(services);
});

// @route   GET api/services/price-history
router.get('/price-history', auth, hasPermission('settings'), (req, res) => {
    try {
        const history = req.db.prepare(`
            SELECT h.id, h.service_id, h.service_name, h.old_price, h.new_price, h.changed_at,
                   u.first_name || ' ' || u.last_name as changed_by,
                   CASE WHEN h.old_price IS NULL OR h.old_price = 0 THEN NULL
                        ELSE ROUND(((h.new_price - h.old_price) / h.old_price) * 100, 1)
                   END as pct_change
            FROM service_price_history h
            LEFT JOIN users u ON h.changed_by_id = u.id
            ORDER BY h.changed_at DESC LIMIT 200
        `).all();

        const summary = req.db.prepare(`
            SELECT sc.id, sc.name, sc.base_price as current_price,
                   (SELECT new_price FROM service_price_history WHERE service_id = sc.id ORDER BY changed_at ASC LIMIT 1) as initial_price,
                   (SELECT COUNT(*) FROM service_price_history WHERE service_id = sc.id) as change_count,
                   (SELECT changed_at FROM service_price_history WHERE service_id = sc.id ORDER BY changed_at DESC LIMIT 1) as last_change
            FROM service_catalog sc ORDER BY sc.name ASC
        `).all();

        res.json({ history, summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching price history' });
    }
});

// @route   POST api/services
router.post('/', auth, hasPermission('settings'), (req, res) => {
    const { name, base_price } = req.body;
    const result = req.db.prepare('INSERT INTO service_catalog (name, base_price) VALUES (?, ?)').run(name, base_price);
    res.json({ id: result.lastInsertRowid, name, base_price });
    try {
        req.db.prepare(`
            INSERT INTO service_price_history (service_id, service_name, old_price, new_price, changed_by_id)
            VALUES (?, ?, NULL, ?, ?)
        `).run(result.lastInsertRowid, name, parseFloat(base_price) || 0, req.user?.id || null);
    } catch (e) { /* fail silently for old DBs */ }
});

// @route   PUT api/services/:id
router.put('/:id', auth, hasPermission('settings'), (req, res) => {
    const { name, base_price } = req.body;
    const current = req.db.prepare('SELECT name, base_price FROM service_catalog WHERE id = ?').get(req.params.id);
    req.db.prepare('UPDATE service_catalog SET name = ?, base_price = ? WHERE id = ?').run(name, base_price, req.params.id);
    if (current && parseFloat(current.base_price) !== parseFloat(base_price)) {
        try {
            req.db.prepare(`
                INSERT INTO service_price_history (service_id, service_name, old_price, new_price, changed_by_id)
                VALUES (?, ?, ?, ?, ?)
            `).run(req.params.id, name || current.name, current.base_price, parseFloat(base_price), req.user?.id || null);
        } catch (e) { /* fail silently */ }
    }
    res.json({ message: 'Service updated' });
});

// @route   DELETE api/services/:id
router.delete('/:id', auth, hasPermission('settings'), (req, res) => {
    req.db.prepare('DELETE FROM service_catalog WHERE id = ?').run(req.params.id);
    res.json({ message: 'Service removed' });
    logActivity(req.slug, req.user, 'DELETE_SERVICE', 'service', req.params.id, {}, req);
});

module.exports = router;
