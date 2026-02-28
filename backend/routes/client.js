const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { generateVehicleHistoryPDF } = require('../lib/pdfGenerator');

// @route   GET api/client/me
// Get logged in client profile and their vehicles/orders
router.get('/me', auth, (req, res) => {
    try {
        const client = req.db.prepare('SELECT id, first_name, last_name, email, phone, address FROM clients WHERE email = ?').get(req.user.username);

        if (!client) {
            // Allow admins to preview the portal without crashing
            if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'staff') {
                return res.json({
                    client: { first_name: 'Admin', last_name: '(Vista Previa)' },
                    vehicles: [],
                    orders: []
                });
            }
            return res.status(404).json({ message: 'Client profile not found' });
        }

        const vehicles = req.db.prepare(`
            WITH ImminentServices AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY predicted_next_km ASC) as rn
                FROM service_intervals
                WHERE predicted_next_km IS NOT NULL
            )
            SELECT v.*, 
                ims.service_description as next_service_desc,
                ims.predicted_next_km, 
                ims.predicted_next_date, 
                ims.confidence,
                (SELECT km FROM vehicle_km_history kh WHERE kh.vehicle_id = v.id ORDER BY recorded_at DESC LIMIT 1) as last_km
            FROM vehicles v
            LEFT JOIN ImminentServices ims ON v.id = ims.vehicle_id AND ims.rn = 1
            WHERE v.client_id = ?
        `).all(client.id);

        const orders = req.db.prepare(`
      SELECT o.*, v.plate, v.model,
             (SELECT COUNT(*) FROM budgets b WHERE b.order_id = o.id) as has_budget,
             (SELECT notes FROM order_history WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as last_note
      FROM orders o
      JOIN vehicles v ON o.vehicle_id = v.id
      WHERE o.client_id = ?
      ORDER BY o.updated_at DESC
    `).all(client.id);

        res.json({ client, vehicles, orders });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/client/register
// Portal registration for new clients
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone } = req.body;

    // Check if registration is allowed
    if (req.globalSettings?.allow_new_registrations === 'false') {
        return res.status(403).json({
            message: 'Registraciones suspendidas temporalmente',
            details: 'El sistema no está aceptando nuevos registros en este momento.'
        });
    }

    try {
        const userExists = req.db.prepare('SELECT * FROM users WHERE username = ?').get(email);
        if (userExists) return res.status(400).json({ message: 'El email ya está registrado' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Run in transaction
        const regTransaction = req.db.transaction((data) => {
            // 1. Create user account
            req.db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
                data.email, data.hashedPassword, 'client'
            );

            // 2. Check if client profile already exists (added by admin)
            const existingClient = req.db.prepare('SELECT id FROM clients WHERE email = ?').get(data.email);

            if (!existingClient) {
                // Create client profile only if it doesn't exist
                req.db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)').run(
                    data.first_name, data.last_name, data.email, data.phone
                );
            }
        });

        regTransaction({ first_name, last_name, email, phone, hashedPassword });
        res.json({ message: 'Registration successful' });
    } catch (err) {
        console.error('REGISTRATION ERROR:', err);
        res.status(500).send('Server error');
    }
});

// @route   POST api/client/vehicles
// Allow logged in client to add their own vehicle
router.post('/vehicles', auth, (req, res) => {
    const { plate, brand, model, year, km } = req.body;
    try {
        const client = req.db.prepare('SELECT id FROM clients WHERE email = ?').get(req.user.username);
        if (!client) return res.status(404).json({ message: 'Client profile not found' });

        const result = req.db.prepare(`
            INSERT INTO vehicles (client_id, plate, brand, model, year, km) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(client.id, plate, brand, model, year, km);

        // Log initial km
        if (km && parseInt(km) > 0) {
            req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)').run(
                result.lastInsertRowid, parseInt(km), 'Kilometraje inicial al registrar vehículo'
            );
        }

        res.json({ id: result.lastInsertRowid, plate, brand, model });
    } catch (err) {
        if (err.message.includes('plate')) {
            return res.status(400).json({ message: 'La patente ya está registrada' });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/client/orders
// Allow logged in client to create an order request
router.post('/orders', auth, (req, res) => {
    const { vehicle_id, description } = req.body;
    try {
        const client = req.db.prepare('SELECT id, first_name, last_name FROM clients WHERE email = ?').get(req.user.username);
        if (!client) return res.status(404).json({ message: 'Client profile not found' });

        // Verify vehicle belongs to client
        const vehicle = req.db.prepare('SELECT id FROM vehicles WHERE id = ? AND client_id = ?').get(vehicle_id, client.id);
        if (!vehicle) return res.status(403).json({ message: 'Vehicle does not belong to you' });

        const crypto = require('crypto');
        const share_token = crypto.randomBytes(6).toString('hex');

        const result = req.db.prepare(`
            INSERT INTO orders (client_id, vehicle_id, description, status, created_by_id, share_token) 
            VALUES (?, ?, ?, 'pending', NULL, ?)
        `).run(client.id, vehicle_id, description || '', share_token);

        req.db.prepare('INSERT INTO order_history (order_id, status, notes, user_id) VALUES (?, ?, ?, NULL)')
            .run(result.lastInsertRowid, 'pending', 'Turno solicitado por el cliente desde el portal');

        res.json({ id: result.lastInsertRowid, message: 'Turno solicitado correctamente' });
    } catch (err) {
        console.error('CLIENT ORDER ERROR:', err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/client/orders/:id
router.get('/orders/:id', auth, (req, res) => {
    try {
        const client = req.db.prepare('SELECT id FROM clients WHERE email = ?').get(req.user.username);
        if (!client) return res.status(404).json({ message: 'Client profile not found' });

        const order = req.db.prepare(`
            SELECT o.*, v.plate, v.model, v.brand
            FROM orders o
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.id = ? AND o.client_id = ?
        `).get(req.params.id, client.id);

        if (!order) return res.status(404).json({ message: 'Order not found' });

        const items = req.db.prepare('SELECT description, labor_price, parts_price FROM order_items WHERE order_id = ?').all(order.id);
        const history = req.db.prepare('SELECT status, notes, created_at FROM order_history WHERE order_id = ? ORDER BY created_at DESC').all(order.id);

        res.json({ order, items, history });
    } catch (err) {
        console.error('CLIENT ORDER DETAIL ERROR:', err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/client/history-pdf/:vehicle_id
// Allow logged in client to download history of their vehicle
router.get('/history-pdf/:vehicle_id', auth, async (req, res) => {
    try {
        const client = req.db.prepare('SELECT id FROM clients WHERE email = ?').get(req.user.username);
        if (!client) return res.status(404).json({ message: 'Client profile not found' });

        // Verify vehicle belongs to client
        const vehicle = req.db.prepare('SELECT id FROM vehicles WHERE id = ? AND client_id = ?').get(req.params.vehicle_id, client.id);
        if (!vehicle) return res.status(403).json({ message: 'Vehicle does not belong to you' });

        const pdfBuffer = await generateVehicleHistoryPDF(req.db, req.params.vehicle_id);
        if (!pdfBuffer) return res.status(404).send('Error generating History PDF');

        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.error('CLIENT HISTORY PDF ERROR:', err);
        res.status(500).send('Error generating PDF');
    }
});

module.exports = router;
