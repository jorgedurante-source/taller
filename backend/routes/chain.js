const express = require('express');
const router = express.Router();
const superDb = require('../superDb');
const { getDb, listTenants } = require('../tenantManager');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'mechub_secret';

// ── Auth middleware para chain users ──────────────────────────────────────────
function chainAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.chainUser = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}

// ── Helper: get chain members slugs ──────────────────────────────────────────
function getChainSlugs(chainId) {
    return superDb.prepare('SELECT tenant_slug FROM chain_members WHERE chain_id = ?')
        .all(chainId).map(r => r.tenant_slug);
}

// ── Helper: query all chain DBs in parallel ───────────────────────────────────
async function queryAllChainDbs(chainId, queryFn) {
    const slugs = getChainSlugs(chainId);
    const results = [];
    for (const slug of slugs) {
        try {
            const db = getDb(slug);
            const data = queryFn(db, slug);
            results.push({ slug, data });
        } catch (e) { results.push({ slug, data: null, error: e.message }); }
    }
    return results;
}

// ── POST /api/chain/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
    const { email, password, chain_slug } = req.body;
    const chain = superDb.prepare('SELECT * FROM tenant_chains WHERE slug = ?').get(chain_slug);
    if (!chain) return res.status(404).json({ message: 'Cadena no encontrada' });

    const user = superDb.prepare('SELECT * FROM chain_users WHERE chain_id = ? AND email = ?')
        .get(chain.id, email);
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign(
        {
            id: user.id, chain_id: chain.id, chain_slug: chain.slug, email: user.email,
            name: user.name, can_see_financials: user.can_see_financials
        },
        JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({
        token, user: {
            id: user.id, name: user.name, email: user.email,
            chain_id: chain.id, chain_slug: chain.slug,
            can_see_financials: user.can_see_financials
        }
    });
});

// ── GET /api/chain/me ─────────────────────────────────────────────────────────
router.get('/me', chainAuth, (req, res) => {
    const chain = superDb.prepare('SELECT id, slug, name, visibility_level FROM tenant_chains WHERE id = ?')
        .get(req.chainUser.chain_id);
    const members = getChainSlugs(req.chainUser.chain_id);
    const workshops = members.length > 0 ? superDb.prepare(
        `SELECT slug, name FROM workshops WHERE slug IN (${members.map(() => '?').join(',')})`
    ).all(...members) : [];
    res.json({ user: req.chainUser, chain, workshops });
});

// ── GET /api/chain/orders ─────────────────────────────────────────────────────
// Returns active orders from all chain tenants (read-only view)
router.get('/orders', chainAuth, async (req, res) => {
    try {
        const { status, search, slug: filterSlug } = req.query;
        const results = await queryAllChainDbs(req.chainUser.chain_id, (db, slug) => {
            if (filterSlug && filterSlug !== slug) return [];
            let query = `
                SELECT o.id, o.uuid, o.status, o.payment_status, o.created_at, o.updated_at,
                       o.appointment_date, o.description,
                       (c.first_name || ' ' || c.last_name) as client_name, c.email as client_email,
                       v.plate, v.brand, v.model
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.status != 'delivered'
            `;
            const params = [];
            if (status) { query += ' AND o.status = ?'; params.push(status); }
            if (search) {
                query += ' AND (c.first_name || " " || c.last_name LIKE ? OR v.plate LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            query += ' ORDER BY o.created_at DESC LIMIT 100';
            return db.prepare(query).all(...params).map(o => ({ ...o, tenant_slug: slug }));
        });

        const allOrders = results.flatMap(r => r.data || [])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(allOrders);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching chain orders' });
    }
});

// ── GET /api/chain/orders/:uuid ───────────────────────────────────────────────
// Get full order detail from whichever tenant has it
router.get('/orders/:uuid', chainAuth, async (req, res) => {
    try {
        const chain = superDb.prepare('SELECT * FROM tenant_chains WHERE id = ?').get(req.chainUser.chain_id);
        const slugs = getChainSlugs(req.chainUser.chain_id);

        for (const slug of slugs) {
            try {
                const db = getDb(slug);
                const order = db.prepare(`
                    SELECT o.*, (c.first_name || ' ' || c.last_name) as client_name,
                           v.plate, v.brand, v.model, v.year
                    FROM orders o
                    JOIN clients c ON o.client_id = c.id
                    JOIN vehicles v ON o.vehicle_id = v.id
                    WHERE o.uuid = ?
                `).get(req.params.uuid);

                if (order) {
                    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
                    const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at DESC').all(order.id);

                    // Apply visibility level
                    let filteredItems = items;
                    if (chain.visibility_level === 'summary') {
                        filteredItems = []; // Solo resumen, sin items
                    } else if (chain.visibility_level === 'no_prices') {
                        filteredItems = items.map(i => ({ ...i, labor_price: null, parts_price: null, subtotal: null }));
                    }

                    return res.json({ ...order, items: filteredItems, history, tenant_slug: slug });
                }
            } catch (e) { continue; }
        }
        res.status(404).json({ message: 'Order not found' });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// ── GET /api/chain/clients ────────────────────────────────────────────────────
router.get('/clients', chainAuth, async (req, res) => {
    try {
        const { search } = req.query;
        const results = await queryAllChainDbs(req.chainUser.chain_id, (db, slug) => {
            let query = `
                SELECT c.id, c.uuid, c.first_name, c.last_name, c.email, c.phone, c.source_tenant,
                       COUNT(DISTINCT o.id) as order_count,
                       COUNT(DISTINCT v.id) as vehicle_count
                FROM clients c
                LEFT JOIN orders o ON o.client_id = c.id
                LEFT JOIN vehicles v ON v.client_id = c.id
            `;
            const params = [];
            if (search) {
                query += ` WHERE (c.first_name || ' ' || c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            query += ' GROUP BY c.id ORDER BY c.first_name ASC';
            return db.prepare(query).all(...params)
                .map(c => ({ ...c, tenant_slug: slug }));
        });

        // Deduplicate by UUID — keep entry from source_tenant, merge order counts
        const seen = new Map();
        for (const { data, slug } of results) {
            if (!data) continue;
            for (const client of data) {
                const key = client.uuid || `manual-${slug}-${client.id}`;
                if (!seen.has(key)) {
                    seen.set(key, { ...client, tenants: [slug], total_orders: client.order_count });
                } else {
                    const existing = seen.get(key);
                    if (!existing.tenants.includes(slug)) existing.tenants.push(slug);
                    existing.total_orders += client.order_count;
                }
            }
        }
        res.json(Array.from(seen.values()));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching clients' });
    }
});

// ── GET /api/chain/clients/:uuid/history ──────────────────────────────────────
router.get('/clients/:uuid/history', chainAuth, async (req, res) => {
    try {
        const results = await queryAllChainDbs(req.chainUser.chain_id, (db, slug) => {
            const client = db.prepare('SELECT * FROM clients WHERE uuid = ?').get(req.params.uuid);
            if (!client) return null;

            const orders = db.prepare(`
                SELECT o.id, o.uuid, o.status, o.payment_status, o.created_at, o.delivered_at,
                       o.description, v.plate, v.brand, v.model
                FROM orders o
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.client_id = ?
                ORDER BY o.created_at DESC
            `).all(client.id);

            return { client, orders, slug };
        });

        const allData = results.filter(r => r.data).map(r => ({
            tenant_slug: r.slug,
            ...r.data,
            orders: r.data.orders.map(o => ({ ...o, tenant_slug: r.slug }))
        }));

        res.json(allData);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching client history' });
    }
});

// ── GET /api/chain/reports ────────────────────────────────────────────────────
router.get('/reports', chainAuth, async (req, res) => {
    try {
        const canSeeFinancials = req.chainUser.can_see_financials;
        const results = await queryAllChainDbs(req.chainUser.chain_id, (db, slug) => {
            const ordersThisMonth = db.prepare(`
                SELECT COUNT(*) as count FROM orders
                WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            `).get();

            const activeOrders = db.prepare(`
                SELECT COUNT(*) as count FROM orders
                WHERE status NOT IN ('delivered', 'cancelled')
            `).get();

            const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get();

            const monthlyIncome = canSeeFinancials ? db.prepare(`
                SELECT COALESCE(SUM(oi.subtotal), 0) as total
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE o.status = 'delivered'
                  AND strftime('%Y-%m', o.delivered_at) = strftime('%Y-%m', 'now')
            `).get() : null;

            const avgRepairDays = db.prepare(`
                SELECT ROUND(AVG(JULIANDAY(delivered_at) - JULIANDAY(created_at)), 1) as avg
                FROM orders WHERE delivered_at IS NOT NULL
                  AND delivered_at >= date('now', '-30 days')
            `).get();

            const ordersByStatus = db.prepare(`
                SELECT status, COUNT(*) as count FROM orders
                WHERE status NOT IN ('delivered', 'cancelled')
                GROUP BY status
            `).all();

            const monthlyTrend = db.prepare(`
                SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
                FROM orders
                WHERE created_at >= date('now', '-6 months')
                GROUP BY month ORDER BY month ASC
            `).all();

            return {
                orders_this_month: ordersThisMonth?.count || 0,
                active_orders: activeOrders?.count || 0,
                total_clients: totalClients?.count || 0,
                monthly_income: monthlyIncome?.total || null,
                avg_repair_days: avgRepairDays?.avg || 0,
                orders_by_status: ordersByStatus,
                monthly_trend: monthlyTrend,
            };
        });

        const byTenant = {};
        for (const { slug, data } of results) {
            if (data) byTenant[slug] = data;
        }

        // Consolidated totals
        const consolidated = {
            orders_this_month: Object.values(byTenant).reduce((s, t) => s + (t.orders_this_month || 0), 0),
            active_orders: Object.values(byTenant).reduce((s, t) => s + (t.active_orders || 0), 0),
            total_clients: Object.values(byTenant).reduce((s, t) => s + (t.total_clients || 0), 0),
            monthly_income: canSeeFinancials
                ? Object.values(byTenant).reduce((s, t) => s + (t.monthly_income || 0), 0)
                : null,
        };

        res.json({ by_tenant: byTenant, consolidated });
    } catch (err) {
        res.status(500).json({ message: 'Error generating chain reports' });
    }
});

// ── GET /api/chain/appointments ───────────────────────────────────────────────
// All upcoming appointments across all chain tenants — for unified calendar
router.get('/appointments', chainAuth, async (req, res) => {
    try {
        const results = await queryAllChainDbs(req.chainUser.chain_id, (db, slug) => {
            return db.prepare(`
                SELECT o.id, o.uuid, o.appointment_date, o.status,
                       (c.first_name || ' ' || c.last_name) as client_name,
                       v.plate, v.brand, v.model
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.appointment_date IS NOT NULL
                  AND o.appointment_date >= date('now', '-1 day')
                ORDER BY o.appointment_date ASC
            `).all().map(a => ({ ...a, tenant_slug: slug }));
        });

        const all = results.flatMap(r => r.data || [])
            .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
        res.json(all);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

module.exports = router;
