const express = require('express');
const router = express.Router({ mergeParams: true });
const { auth, isAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../lib/logger');

// @route   GET api/:slug/logs
// @desc    Get system logs from DB
router.get('/', auth, isAdmin, (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = req.db.prepare(`
            SELECT sl.*, u.username as user_name
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            ORDER BY sl.created_at DESC
            LIMIT ?
        `).all(limit);
        res.json(logs);
    } catch (err) {
        next(err);
    }
});

// @route   GET api/:slug/logs/audit
// @desc    Get audit logs from DB
router.get('/audit', auth, isAdmin, (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const logs = req.db.prepare(`
            SELECT a.*, COALESCE(u.username, a.user_name, 'Sistema') as user_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
        res.json(logs);
    } catch (err) {
        next(err);
    }
});

// @route   GET api/:slug/logs/file
// @desc    Get fallback error logs from file
router.get('/file', auth, isAdmin, (req, res, next) => {
    try {
        const slug = req.params.slug;
        const logPath = path.join(LOGS_DIR, `error_${slug}.log`);

        if (!fs.existsSync(logPath)) {
            return res.json([]);
        }

        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { message: line };
            }
        }).reverse();

        res.json(lines);
    } catch (err) {
        next(err);
    }
});

// @route   DELETE api/:slug/logs
// @desc    Purge logs
router.delete('/', auth, isAdmin, (req, res, next) => {
    const { mode } = req.query; // 'all', 'old'
    try {
        if (mode === 'all') {
            req.db.prepare('DELETE FROM system_logs').run();

            // Also try to clear the file
            const slug = req.params.slug;
            const logPath = path.join(LOGS_DIR, `error_${slug}.log`);
            if (fs.existsSync(logPath)) {
                fs.writeFileSync(logPath, '');
            }
        } else {
            // Delete older than 30 days
            req.db.prepare("DELETE FROM system_logs WHERE created_at < date('now', '-30 days')").run();
        }
        res.json({ message: 'Logs purgados correctamente' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
