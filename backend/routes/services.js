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

// @route   POST api/services
router.post('/', auth, hasPermission('settings'), (req, res) => {
    const { name, base_price } = req.body;
    const result = req.db.prepare('INSERT INTO service_catalog (name, base_price) VALUES (?, ?)').run(name, base_price);
    res.json({ id: result.lastInsertRowid, name, base_price });
    logActivity(req.slug, req.user, 'CREATE_SERVICE', 'service', result.lastInsertRowid, { name, base_price }, req);
});

// @route   PUT api/services/:id
router.put('/:id', auth, hasPermission('settings'), (req, res) => {
    const { name, base_price } = req.body;
    req.db.prepare('UPDATE service_catalog SET name = ?, base_price = ? WHERE id = ?').run(name, base_price, req.params.id);
    res.json({ message: 'Service updated' });
    logActivity(req.slug, req.user, 'UPDATE_SERVICE', 'service', req.params.id, { name, base_price }, req);
});

// @route   DELETE api/services/:id
router.delete('/:id', auth, hasPermission('settings'), (req, res) => {
    req.db.prepare('DELETE FROM service_catalog WHERE id = ?').run(req.params.id);
    res.json({ message: 'Service removed' });
    logActivity(req.slug, req.user, 'DELETE_SERVICE', 'service', req.params.id, {}, req);
});

module.exports = router;
