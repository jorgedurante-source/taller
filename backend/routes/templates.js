const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');

// @route   GET api/templates
router.get('/', auth, (req, res) => {
    try {
        const templates = req.db.prepare('SELECT * FROM templates').all();
        res.json(templates);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/templates
router.post('/', auth, hasPermission('configuracion'), (req, res) => {
    const { name, content, trigger_status, include_pdf, send_whatsapp, send_email } = req.body;
    try {
        if (trigger_status) {
            const existing = req.db.prepare('SELECT id FROM templates WHERE trigger_status = ?').get(trigger_status);
            if (existing) {
                return res.status(400).json({ message: 'Ya existe una plantilla con este disparador automático' });
            }
        }

        req.db.prepare(`
            INSERT INTO templates (name, content, trigger_status, include_pdf, send_whatsapp, send_email) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, content, trigger_status || null, include_pdf ? 1 : 0, send_whatsapp ? 1 : 0, send_email ?? 1);
        res.json({ message: 'Template created' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Ya existe una plantilla con ese nombre' });
        }
        res.status(500).send('Server error');
    }
});

// @route   PUT api/templates/:id
router.put('/:id', auth, hasPermission('configuracion'), (req, res) => {
    const { name, content, trigger_status, include_pdf, send_whatsapp, send_email } = req.body;
    try {
        if (trigger_status) {
            const existing = req.db.prepare('SELECT id FROM templates WHERE trigger_status = ? AND id != ?').get(trigger_status, req.params.id);
            if (existing) {
                return res.status(400).json({ message: 'Ya existe una plantilla con este disparador automático' });
            }
        }

        req.db.prepare(`
            UPDATE templates 
            SET name = ?, content = ?, trigger_status = ?, include_pdf = ?, send_whatsapp = ?, send_email = ? 
            WHERE id = ?
        `).run(name, content, trigger_status || null, include_pdf ? 1 : 0, send_whatsapp ? 1 : 0, send_email ? 1 : 0, req.params.id);
        res.json({ message: 'Template updated' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/templates/:id
router.delete('/:id', auth, hasPermission('configuracion'), (req, res) => {
    try {
        req.db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
