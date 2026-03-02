const express = require('express');
const router = express.Router();
const { auth, hasPermission } = require('../middleware/auth');
const { logActivity } = require('../lib/auditLogger');

// @route   GET api/stock
router.get('/', auth, hasPermission('stock'), (req, res) => {
    const { search, category, low_stock } = req.query;
    let where = [];
    let params = [];

    if (search) {
        where.push('(name LIKE ? OR sku LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
        where.push('category = ?');
        params.push(category);
    }
    if (low_stock === 'true') {
        where.push('quantity <= min_quantity');
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    try {
        const items = req.db.prepare(`
            SELECT s.*, sup.name as supplier_name 
            FROM stock_items s
            LEFT JOIN suppliers sup ON s.supplier_id = sup.id
            ${whereClause}
            ORDER BY s.name ASC
        `).all(...params);
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stock' });
    }
});

// @route   POST api/stock
router.post('/', auth, hasPermission('stock.edit'), (req, res) => {
    const { sku, name, category, quantity, min_quantity, cost_price, sale_price, supplier_id, location, notes } = req.body;
    try {
        const result = req.db.prepare(`
            INSERT INTO stock_items (sku, name, category, quantity, min_quantity, cost_price, sale_price, supplier_id, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sku, name, category, quantity || 0, min_quantity || 0, cost_price || 0, sale_price || 0, supplier_id || null, location, notes);

        const itemId = result.lastInsertRowid;

        // Initial movement if quantity > 0
        if (quantity > 0) {
            req.db.prepare(`
                INSERT INTO stock_movements (item_id, type, quantity, notes, user_id)
                VALUES (?, 'adjustment', ?, 'Stock inicial', ?)
            `).run(itemId, quantity, req.user.id === 0 ? null : req.user.id);
        }

        res.json({ id: itemId, message: 'Item created' });
        logActivity(req.slug, req.user, 'CREATE_STOCK_ITEM', 'stock', itemId, { name, sku }, req);
    } catch (err) {
        res.status(500).json({ message: 'Error creating stock item' });
    }
});

// @route   PUT api/stock/:id
router.put('/:id', auth, hasPermission('stock.edit'), (req, res) => {
    const { sku, name, category, min_quantity, cost_price, sale_price, supplier_id, location, notes } = req.body;
    try {
        req.db.prepare(`
            UPDATE stock_items SET 
                sku = ?, name = ?, category = ?, min_quantity = ?, 
                cost_price = ?, sale_price = ?, supplier_id = ?, 
                location = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(sku, name, category, min_quantity, cost_price, sale_price, supplier_id, location, notes, req.params.id);
        res.json({ message: 'Item updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating stock item' });
    }
});

// @route   POST api/stock/movement
router.post('/movement', auth, hasPermission('stock.edit'), (req, res) => {
    const { item_id, type, quantity, notes, order_id } = req.body;
    try {
        const item = req.db.prepare('SELECT quantity FROM stock_items WHERE id = ?').get(item_id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const qty = parseFloat(quantity);
        let newQty = item.quantity;

        if (type === 'in' || type === 'adjustment' || type === 'transfer_in') {
            newQty += qty;
        } else {
            newQty -= qty;
        }

        const transaction = req.db.transaction(() => {
            req.db.prepare('UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, item_id);
            req.db.prepare(`
                INSERT INTO stock_movements (item_id, type, quantity, notes, order_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(item_id, type, qty, notes, order_id || null, req.user.id === 0 ? null : req.user.id);
        });

        transaction();
        res.json({ new_quantity: newQty });
        logActivity(req.slug, req.user, 'STOCK_MOVEMENT', 'stock', item_id, { type, quantity: qty, newQty }, req);
    } catch (err) {
        res.status(500).json({ message: 'Error recording movement' });
    }
});

// @route   GET api/stock/chain
router.get('/chain', auth, hasPermission('stock'), (req, res) => {
    const { search } = req.query;
    if (!search || search.length < 3) return res.json([]);

    try {
        const superDb = require('../superDb');
        const { getDb } = require('../tenantManager');

        const workshop = superDb.prepare('SELECT chain_id FROM workshops WHERE slug = ?').get(req.slug);
        if (!workshop?.chain_id) return res.status(403).json({ message: 'Workshop not in a chain' });

        const members = superDb.prepare('SELECT slug, name FROM workshops WHERE chain_id = ? AND slug != ? AND status = "active"').all(workshop.chain_id, req.slug);

        let results = [];
        members.forEach(member => {
            try {
                const memberDb = getDb(member.slug);
                const items = memberDb.prepare(`
                    SELECT sku, name, category, quantity, location 
                    FROM stock_items 
                    WHERE (name LIKE ? OR sku LIKE ?) AND quantity > 0
                    LIMIT 20
                `).all(`%${search}%`, `%${search}%`);

                items.forEach(item => {
                    results.push({
                        ...item,
                        workshop_slug: member.slug,
                        workshop_name: member.name
                    });
                });
            } catch (e) {
                console.warn(`Could not query stock for ${member.slug}:`, e.message);
            }
        });

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching chain stock' });
    }
});

module.exports = router;
