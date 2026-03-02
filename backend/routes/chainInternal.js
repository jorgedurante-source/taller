const express = require('express');
const router = express.Router();
const { auth, hasPermission } = require('../middleware/auth');
const superDb = require('../superDb');

// @route   GET api/chain-internal/messages
router.get('/messages', auth, (req, res) => {
    const { other_slug } = req.query;
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'No chain membership' });

        let messages;
        if (other_slug) {
            // Private chat between two workshops
            messages = superDb.prepare(`
                SELECT * FROM chain_messages 
                WHERE chain_id = ? 
                AND (
                    (from_slug = ? AND to_slug = ?) OR 
                    (from_slug = ? AND to_slug = ?)
                )
                ORDER BY created_at DESC 
                LIMIT 50
            `).all(workshop.chain_id, req.slug, other_slug, other_slug, req.slug);
        } else {
            // Global chat
            messages = superDb.prepare(`
                SELECT * FROM chain_messages 
                WHERE chain_id = ? AND to_slug IS NULL
                ORDER BY created_at DESC 
                LIMIT 50
            `).all(workshop.chain_id);
        }

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// @route   POST api/chain-internal/messages
router.post('/messages', auth, (req, res) => {
    const { to_slug, message, linked_request_id } = req.body;
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'No chain membership' });

        const userName = req.user.username || 'Sistema';

        superDb.prepare(`
            INSERT INTO chain_messages (chain_id, from_slug, from_user_name, to_slug, message, linked_request_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(workshop.chain_id, req.slug, userName, to_slug || null, message, linked_request_id || null);

        res.json({ message: 'Message sent' });
    } catch (err) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

// @route   GET api/chain-internal/requests
router.get('/requests', auth, (req, res) => {
    const { type } = req.query; // 'incoming' or 'outgoing'
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'No chain membership' });

        let sql = 'SELECT r.*, w_req.name as requesting_name, w_target.name as target_name FROM stock_requests r JOIN workshops w_req ON r.requesting_slug = w_req.slug JOIN workshops w_target ON r.target_slug = w_target.slug WHERE r.chain_id = ?';
        let params = [workshop.chain_id];

        if (type === 'incoming') {
            sql += ' AND r.target_slug = ?';
            params.push(req.slug);
        } else if (type === 'outgoing') {
            sql += ' AND r.requesting_slug = ?';
            params.push(req.slug);
        }

        sql += ' ORDER BY r.created_at DESC LIMIT 50';
        const requests = superDb.prepare(sql).all(...params);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching requests' });
    }
});

// @route   POST api/chain-internal/requests
router.post('/requests', auth, hasPermission('stock'), (req, res) => {
    const { target_slug, item_name, sku, quantity, notes } = req.body;
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'No chain membership' });

        const result = superDb.prepare(`
            INSERT INTO stock_requests (chain_id, requesting_slug, requesting_user_name, target_slug, item_name, sku, quantity, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(workshop.chain_id, req.slug, req.user.username || 'Staff', target_slug, item_name, sku || null, quantity, notes);

        const requestId = result.lastInsertRowid;

        // Auto-message target
        superDb.prepare(`
            INSERT INTO chain_messages (chain_id, from_slug, from_user_name, to_slug, message, linked_request_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(workshop.chain_id, req.slug, req.user.username || 'Staff', target_slug, `Nuevo pedido de repuesto: ${item_name} (Cant: ${quantity})`, requestId);

        res.json({ id: requestId, message: 'Request created' });
    } catch (err) {
        res.status(500).json({ message: 'Error creating request' });
    }
});

// @route   PUT api/chain-internal/requests/:id/respond
router.put('/requests/:id/respond', auth, hasPermission('stock.edit'), (req, res) => {
    const { status, response_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    try {
        const request = superDb.prepare('SELECT * FROM stock_requests WHERE id = ? AND target_slug = ?').get(req.params.id, req.slug);
        if (!request) return res.status(404).json({ message: 'Request not found or not authorized' });

        superDb.prepare(`
            UPDATE stock_requests 
            SET status = ?, response_notes = ?, responded_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, response_notes || null, req.params.id);

        // Notify requester
        superDb.prepare(`
            INSERT INTO chain_messages (chain_id, from_slug, from_user_name, to_slug, message, linked_request_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(request.chain_id, req.slug, req.user.username || 'Staff', request.requesting_slug, `Pedido de ${request.item_name} fue ${status === 'approved' ? 'APROBADO' : 'RECHAZADO'}: ${response_notes || ''}`, req.params.id);

        res.json({ message: 'Response saved' });
    } catch (err) {
        res.status(500).json({ message: 'Error responding to request' });
    }
});

// @route   PUT api/chain-internal/requests/:id/deliver
router.put('/requests/:id/deliver', auth, hasPermission('stock.edit'), (req, res) => {
    try {
        const request = superDb.prepare('SELECT * FROM stock_requests WHERE id = ? AND target_slug = ?').get(req.params.id, req.slug);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        superDb.prepare(`
            UPDATE stock_requests 
            SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(req.params.id);

        // Notify requester
        superDb.prepare(`
            INSERT INTO chain_messages (chain_id, from_slug, from_user_name, to_slug, message, linked_request_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(request.chain_id, req.slug, req.user.username || 'Staff', request.requesting_slug, `Repuestos para el pedido de ${request.item_name} han sido ENVIADOS/ENTREGADOS.`, req.params.id);

        res.json({ message: 'Marked as delivered' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating delivery status' });
    }
});

// @route   GET api/chain-internal/unread-counts
router.get('/unread-counts', auth, (req, res) => {
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.json({ direct: [], global: 0 });

        // Direct messages to this workshop not yet read by anyone in this workshop
        // (For direct messages, is_read = 1 is enough since there is only one recipient workshop)
        const unreadDirect = superDb.prepare(`
            SELECT from_slug, COUNT(*) as count 
            FROM chain_messages 
            WHERE chain_id = ? AND to_slug = ? AND is_read = 0
            GROUP BY from_slug
        `).all(workshop.chain_id, req.slug);

        // Global messages not sent by this workshop and not in our read tracking table
        const unreadGlobal = superDb.prepare(`
            SELECT COUNT(*) FROM chain_messages m
            WHERE m.chain_id = ? 
            AND m.to_slug IS NULL 
            AND m.from_slug != ?
            AND m.id NOT IN (
                SELECT message_id FROM chain_message_reads WHERE workshop_slug = ?
            )
        `).get(workshop.chain_id, req.slug, req.slug);

        res.json({
            direct: unreadDirect,
            global: unreadGlobal?.['COUNT(*)'] || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching unread counts' });
    }
});

// @route   POST api/chain-internal/read
router.post('/read', auth, (req, res) => {
    const { from_slug } = req.body; // if null, marks all global as read
    try {
        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'No chain membership' });

        if (from_slug) {
            // Mark direct messages from this sender as read
            superDb.prepare(`
                UPDATE chain_messages 
                SET is_read = 1 
                WHERE chain_id = ? AND to_slug = ? AND from_slug = ? AND is_read = 0
            `).run(workshop.chain_id, req.slug, from_slug);
        } else {
            // Mark all current global messages as read for this workshop
            const globalMessages = superDb.prepare(`
                SELECT id FROM chain_messages WHERE chain_id = ? AND to_slug IS NULL AND from_slug != ?
            `).all(workshop.chain_id, req.slug);

            const insertRead = superDb.prepare('INSERT OR IGNORE INTO chain_message_reads (message_id, workshop_slug) VALUES (?, ?)');
            const transaction = superDb.transaction((msgs) => {
                for (const m of msgs) insertRead.run(m.id, req.slug);
            });
            transaction(globalMessages);
        }

        res.json({ message: 'Read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error marking read' });
    }
});

module.exports = router;
