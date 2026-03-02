const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auth middlewares
const { auth, hasPermission } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { logActivity } = require('../lib/auditLogger');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const slug = req.user?.slug || req.slug;
        const dir = path.resolve(__dirname, `../tenants/${slug}/uploads/vehicles`);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `veh_${req.params.vid}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// @route   GET api/clients/all-vehicles
router.get('/all-vehicles', auth, hasPermission('vehicles'), (req, res) => {
    const vehicles = req.db.prepare(`
        SELECT v.*, c.first_name, c.last_name, c.phone as client_phone 
        FROM vehicles v
        JOIN clients c ON v.client_id = c.id
    `).all();
    res.json(vehicles);
});

// @route   GET api/clients/vehicle-reference
router.get('/vehicle-reference', auth, (req, res) => {
    try {
        const refs = req.db.prepare('SELECT * FROM vehicle_reference ORDER BY brand ASC, model ASC, version ASC').all();
        res.json(refs);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db

// @route   GET api/clients/vehicles/:vid/chain-history
router.get('/vehicles/:vid/chain-history', auth, (req, res) => {
    console.log(`[chain-history] Request for vehicle ${req.params.vid} in tenant ${req.slug}`);
    try {
        // 2. Get vehicle
        const vehicle = req.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.vid);
        if (!vehicle) {
            console.log(`[chain-history] Vehicle ${req.params.vid} not found in ${req.slug}`);
            return res.status(404).json({ message: 'Vehículo no encontrado' });
        }

        console.log(`[chain-history] Vehicle Plate: ${vehicle.plate}, UUID: ${vehicle.uuid}`);

        // 3. Check uuid
        if (!vehicle.uuid) {
            console.log(`[chain-history] Vehicle ${req.params.vid} has no UUID`);
            return res.json({ chain_orders: [], reason: 'vehicle_has_no_uuid' });
        }

        // 4. Find chain
        const superDb = require('../superDb');
        const member = superDb.prepare(
            'SELECT chain_id FROM chain_members WHERE tenant_slug = ?'
        ).get(req.slug);

        if (!member) {
            console.log(`[chain-history] Tenant ${req.slug} is NOT in a chain`);
            return res.json({ chain_orders: [], reason: 'not_in_chain' });
        }

        // 5. Get peers
        const peers = superDb.prepare(
            'SELECT tenant_slug FROM chain_members WHERE chain_id = ? AND tenant_slug != ?'
        ).all(member.chain_id, req.slug);

        // 6. Get visibility level
        const chain = superDb.prepare(
            'SELECT visibility_level FROM tenant_chains WHERE id = ?'
        ).get(member.chain_id);

        const visibility = chain?.visibility_level || 'summary';

        // 7. Fetch from peers
        const { getDb } = require('../tenantManager');
        const allChainOrders = [];

        console.log(`[chain-history] Found ${peers.length} peers for tenant ${req.slug}`);

        for (const peer of peers) {
            try {
                const peerDb = getDb(peer.tenant_slug);
                const peerVehicle = peerDb.prepare('SELECT id FROM vehicles WHERE uuid = ?').get(vehicle.uuid);

                if (peerVehicle) {
                    console.log(`[chain-history] Matched vehicle in peer ${peer.tenant_slug} (Peer VID: ${peerVehicle.id})`);
                    const columns = ['o.id', 'o.uuid', 'o.status', 'o.description', 'o.created_at', 'o.delivered_at', 'o.appointment_date'];
                    if (visibility === 'full') {
                        columns.push('o.payment_status');
                    }

                    const orders = peerDb.prepare(`
                        SELECT ${columns.join(', ')}
                        FROM orders o
                        WHERE o.vehicle_id = ?
                        ORDER BY o.created_at DESC
                        LIMIT 50
                    `).all(peerVehicle.id);

                    console.log(`[chain-history] Found ${orders.length} orders in peer ${peer.tenant_slug}`);

                    // Get workshop name
                    const workshop = superDb.prepare('SELECT name FROM workshops WHERE slug = ?').get(peer.tenant_slug);

                    orders.forEach(o => {
                        o.tenant_slug = peer.tenant_slug;
                        o.workshop_name = workshop?.name || peer.tenant_slug;
                        o.local_vehicle_id = vehicle.id;
                        o.plate = vehicle.plate;
                        allChainOrders.push(o);
                    });
                } else {
                    console.log(`[chain-history] Vehicle UUID ${vehicle.uuid} NOT found in peer ${peer.tenant_slug}`);
                }
            } catch (peerErr) {
                console.warn(`[chain-history] Failed to fetch from peer ${peer.tenant_slug}:`, peerErr.message);
                // Continue to next peer
            }
        }

        // 8. Return
        console.log(`[chain-history] Returning ${allChainOrders.length} cross-chain orders`);
        res.json({
            chain_orders: allChainOrders,
            vehicle_uuid: vehicle.uuid
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching chain history' });
    }
});

// @route   GET api/clients/vehicles/:vid/chain-history/:peer_slug/:oid
router.get('/vehicles/:vid/chain-history/:peer_slug/:oid', auth, (req, res) => {
    const { vid, peer_slug, oid } = req.params;
    try {
        const vehicle = req.db.prepare('SELECT uuid FROM vehicles WHERE id = ?').get(vid);
        if (!vehicle) return res.status(404).json({ message: 'Vehículo no encontrado' });

        const superDb = require('../superDb');
        const member = superDb.prepare('SELECT chain_id FROM chain_members WHERE tenant_slug = ?').get(req.slug);
        if (!member) return res.status(403).json({ message: 'Access denied: not in chain' });

        const peerMember = superDb.prepare('SELECT tenant_slug FROM chain_members WHERE chain_id = ? AND tenant_slug = ?').get(member.chain_id, peer_slug);
        if (!peerMember) return res.status(403).json({ message: 'Access denied: peer not in same chain' });

        const { getDb } = require('../tenantManager');
        const peerDb = getDb(peer_slug);

        const order = peerDb.prepare(`
            SELECT o.*, v.plate, v.brand, v.model, v.version, v.year, v.km, v.uuid as vehicle_uuid
            FROM orders o
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.id = ?
        `).get(oid);

        if (!order) return res.status(404).json({ message: 'Orden no encontrada en taller remoto' });
        if (order.vehicle_uuid !== vehicle.uuid) return res.status(403).json({ message: 'Access denied: order vehicle mismatch' });

        const chain = superDb.prepare('SELECT visibility_level FROM tenant_chains WHERE id = ?').get(member.chain_id);
        const visibility = chain?.visibility_level || 'summary';

        const items = peerDb.prepare('SELECT description, subtotal FROM order_items WHERE order_id = ?').all(oid);
        const history = peerDb.prepare('SELECT status, notes, created_at FROM order_history WHERE order_id = ? ORDER BY created_at DESC').all(oid);
        const workshop = superDb.prepare('SELECT name FROM workshops WHERE slug = ?').get(peer_slug);

        // Strip price data for cross-chain as requested
        order.payment_status = undefined;
        order.payment_amount = undefined;
        order.subtotal = undefined;
        order.total = undefined;
        items.forEach(i => {
            i.subtotal = undefined;
            i.price = undefined;
        });

        res.json({ order, items, history, workshop_name: workshop?.name || peer_slug });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching cross-chain order details' });
    }
});
router.get('/', auth, hasPermission('clients'), (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const offset = (page - 1) * limit;
    const { search } = req.query;

    if (search) {
        const s = `%${search}%`;
        const countQuery = `
            SELECT COUNT(*) as count FROM clients c
            WHERE
                c.first_name LIKE ? OR c.last_name LIKE ? OR
                (c.first_name || ' ' || c.last_name) LIKE ? OR
                c.email LIKE ? OR c.phone LIKE ? OR
                EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id AND v.plate LIKE ?)
        `;
        const baseQuery = `
            SELECT c.*, (c.first_name || ' ' || c.last_name) as full_name
            FROM clients c
            WHERE
                c.first_name LIKE ? OR c.last_name LIKE ? OR
                (c.first_name || ' ' || c.last_name) LIKE ? OR
                c.email LIKE ? OR c.phone LIKE ? OR
                EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id AND v.plate LIKE ?)
            ORDER BY c.first_name ASC, c.last_name ASC
            LIMIT ? OFFSET ?
        `;
        const searchParams = [s, s, s, s, s, s];
        const total = req.db.prepare(countQuery).get(...searchParams)?.count || 0;
        const clients = req.db.prepare(baseQuery).all(...searchParams, limit, offset);
        return res.json({
            data: clients,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
                has_next: page * limit < total,
                has_prev: page > 1
            }
        });
    }

    const total = req.db.prepare('SELECT COUNT(*) as count FROM clients').get()?.count || 0;
    const clients = req.db.prepare(`
        SELECT *, (first_name || ' ' || last_name) as full_name
        FROM clients
        ORDER BY first_name ASC, last_name ASC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
        data: clients,
        pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            has_next: page * limit < total,
            has_prev: page > 1
        }
    });
});

// @route   GET api/clients/:id
router.get('/:id', auth, hasPermission('clients'), (req, res) => {
    try {
        const client = req.db.prepare('SELECT *, (first_name || \' \' || last_name) as full_name FROM clients WHERE id = ?').get(req.params.id);
        if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });
        res.json(client);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/clients
router.post('/', auth, hasPermission('clients'), (req, res) => {
    const { first_name, last_name, nickname, phone, email, address, notes, vehicle } = req.body;

    const { randomUUID } = require('crypto');
    const insertClient = req.db.prepare('INSERT INTO clients (first_name, last_name, nickname, phone, email, address, notes, uuid, source_tenant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertVehicle = req.db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, version, year, km, uuid, source_tenant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertKmHistory = req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)');
    const insertRef = req.db.prepare('INSERT OR IGNORE INTO vehicle_reference (brand, model, version) VALUES (?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        const clientResult = insertClient.run(data.first_name, data.last_name, data.nickname, data.phone, data.email, data.address, data.notes, randomUUID(), req.slug);
        const clientId = clientResult.lastInsertRowid;

        if (data.vehicle) {
            const vResult = insertVehicle.run(
                clientId,
                data.vehicle.plate,
                data.vehicle.brand,
                data.vehicle.model,
                data.vehicle.version || null,
                data.vehicle.year || null,
                data.vehicle.km || null,
                randomUUID(),
                req.slug
            );

            // Auto-learn reference
            if (data.vehicle.brand && data.vehicle.model) {
                insertRef.run(data.vehicle.brand, data.vehicle.model, data.vehicle.version || null);
            }

            // Log initial km
            if (data.vehicle.km && parseInt(data.vehicle.km) > 0) {
                insertKmHistory.run(vResult.lastInsertRowid, parseInt(data.vehicle.km), 'Kilometraje inicial al registrar vehículo');
            }
        }
        return clientId;
    });

    try {
        const clientId = transaction({ first_name, last_name, nickname, phone, email, address, notes, vehicle });
        res.json({ id: clientId, first_name, last_name, email });
        logActivity(req.slug, req.user, 'CREATE_CLIENT', 'client', clientId, { first_name, last_name, email, hasVehicle: !!vehicle }, req);

        // Chain sync
        try {
            const { enqueueSyncToChain } = require('./chainSync');
            const newClient = req.db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
            enqueueSyncToChain(req.slug, 'upsert_client', { ...newClient });

            if (vehicle) {
                const newVehicle = req.db.prepare('SELECT v.*, c.uuid as client_uuid FROM vehicles v JOIN clients c ON v.client_id = c.id WHERE v.client_id = ?').get(clientId);
                if (newVehicle) enqueueSyncToChain(req.slug, 'upsert_vehicle', { ...newVehicle });
            }
        } catch (e) {
            console.warn('[chainSync] enqueue failed for new client:', e.message);
        }
    } catch (err) {
        if (err.message.includes('plate')) {
            return res.status(400).json({ message: 'La patente ya está registrada' });
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// @route   PUT api/clients/:id
router.put('/:id', auth, hasPermission('clients'), (req, res) => {
    const { first_name, last_name, nickname, phone, email, address, notes } = req.body;
    try {
        req.db.prepare(`
            UPDATE clients 
            SET first_name = ?, last_name = ?, nickname = ?, phone = ?, email = ?, address = ?, notes = ? 
            WHERE id = ?
        `).run(first_name, last_name, nickname, phone, email, address, notes, req.params.id);
        res.json({ message: 'Cliente actualizado' });
        logActivity(req.slug, req.user, 'UPDATE_CLIENT', 'client', req.params.id, { first_name, last_name, email }, req);

        // Chain sync
        try {
            const { enqueueSyncToChain } = require('./chainSync');
            const updatedClient = req.db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
            if (updatedClient) enqueueSyncToChain(req.slug, 'upsert_client', { ...updatedClient });
        } catch (e) {
            console.warn('[chainSync] enqueue failed for updated client:', e.message);
        }
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/clients/:id/password
router.post('/:id/password', auth, hasPermission('clients'), async (req, res) => {
    const { password } = req.body;
    try {
        const client = req.db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
        if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        req.db.prepare('UPDATE clients SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// --- Vehicles ---



// @route   GET api/clients/:id/vehicles
router.get('/:id/vehicles', auth, hasPermission('vehicles'), (req, res) => {
    const vehicles = req.db.prepare('SELECT * FROM vehicles WHERE client_id = ?').all(req.params.id);
    res.json(vehicles);
});

// @route   POST api/clients/:id/vehicles
router.post('/:id/vehicles', auth, hasPermission('vehicles'), (req, res) => {
    const { plate, brand, model, version, year, km, photos } = req.body;
    const { randomUUID } = require('crypto');
    try {
        const result = req.db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, version, year, km, photos, uuid, source_tenant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            req.params.id, plate, brand, model, version || null, year, km, JSON.stringify(photos || []), randomUUID(), req.slug
        );

        const vehicleId = result.lastInsertRowid;
        // Auto-learn reference
        if (brand && model) {
            req.db.prepare('INSERT OR IGNORE INTO vehicle_reference (brand, model, version) VALUES (?, ?, ?)').run(brand, model, version || null);
        }

        res.json({ id: vehicleId, plate, brand, model });
        logActivity(req.slug, req.user, 'ADD_VEHICLE', 'vehicle', vehicleId, { plate, brand, model, version, clientId: req.params.id }, req);

        // Chain sync
        try {
            const { enqueueSyncToChain } = require('./chainSync');
            const newVehicle = req.db.prepare('SELECT v.*, c.uuid as client_uuid FROM vehicles v JOIN clients c ON v.client_id = c.id WHERE v.id = ?').get(vehicleId);
            if (newVehicle) enqueueSyncToChain(req.slug, 'upsert_vehicle', { ...newVehicle });
        } catch (e) {
            console.warn('[chainSync] enqueue failed for new vehicle:', e.message);
        }
        // Log initial km
        if (km && parseInt(km) > 0) {
            req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)').run(
                result.lastInsertRowid, parseInt(km), 'Kilometraje inicial al registrar vehículo'
            );
        }
    } catch (err) {
        if (err.message && err.message.includes('plate')) {
            return res.status(400).json({ message: 'La patente ya está registrada' });
        }
        res.status(500).json({ message: 'Error interno: ' + err.message });
    }
});

// @route   PUT api/clients/vehicles/:vid
router.put('/vehicles/:vid', auth, hasPermission('vehicles'), (req, res) => {
    const { brand, model, version, plate, year, km, status } = req.body;
    try {
        const current = req.db.prepare('SELECT km FROM vehicles WHERE id = ?').get(req.params.vid);

        req.db.prepare(`
            UPDATE vehicles 
            SET brand = ?, model = ?, version = ?, plate = ?, year = ?, km = ?, status = ? 
            WHERE id = ?
        `).run(brand, model, version || null, plate, year, km, status, req.params.vid);

        // Auto-learn reference
        if (brand && model) {
            req.db.prepare('INSERT OR IGNORE INTO vehicle_reference (brand, model, version) VALUES (?, ?, ?)').run(brand, model, version || null);
        }

        // Chain sync
        try {
            const { enqueueSyncToChain } = require('./chainSync');
            const updatedVehicle = req.db.prepare('SELECT v.*, c.uuid as client_uuid FROM vehicles v JOIN clients c ON v.client_id = c.id WHERE v.id = ?').get(req.params.vid);
            if (updatedVehicle) enqueueSyncToChain(req.slug, 'upsert_vehicle', { ...updatedVehicle });
        } catch (e) {
            console.warn('[chainSync] enqueue failed for updated vehicle:', e.message);
        }

        res.json({ message: 'Vehículo actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/clients/vehicles/:vid/km
// @desc    Update only the km of a vehicle and log the change
router.put('/vehicles/:vid/km', auth, hasPermission('vehicles'), (req, res) => {
    const { km, notes } = req.body;
    if (km === undefined || km === null) return res.status(400).json({ message: 'KM requerido' });
    try {
        const current = req.db.prepare('SELECT km FROM vehicles WHERE id = ?').get(req.params.vid);
        if (!current) return res.status(404).json({ message: 'Vehículo no encontrado' });

        const newKm = parseInt(km);
        const oldKm = parseInt(current.km || 0);

        req.db.prepare('UPDATE vehicles SET km = ? WHERE id = ?').run(newKm, req.params.vid);

        // Always log km update through this dedicated endpoint
        req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)').run(req.params.vid, newKm, notes || null);

        // Chain sync
        try {
            const { enqueueSyncToChain } = require('./chainSync');
            const updatedVehicle = req.db.prepare('SELECT v.*, c.uuid as client_uuid FROM vehicles v JOIN clients c ON v.client_id = c.id WHERE v.id = ?').get(req.params.vid);
            if (updatedVehicle) enqueueSyncToChain(req.slug, 'upsert_vehicle', { ...updatedVehicle });
        } catch (e) {
            console.warn('[chainSync] enqueue failed for vehicle KM update:', e.message);
        }

        res.json({ message: 'Kilometraje actualizado', km: newKm, delta: newKm - oldKm });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/clients/vehicles/:vid/km-history
// @desc    Get the km history for a vehicle
router.get('/vehicles/:vid/km-history', auth, hasPermission('vehicles'), (req, res) => {
    try {
        const history = req.db.prepare(`
            SELECT 
                id,
                km,
                notes,
                recorded_at,
                km - LAG(km, 1, km) OVER (ORDER BY recorded_at ASC) as delta,
                CAST((julianday(recorded_at) - julianday(LAG(recorded_at, 1, recorded_at) OVER (ORDER BY recorded_at ASC))) AS INTEGER) as day_diff
            FROM vehicle_km_history
            WHERE vehicle_id = ?
            ORDER BY recorded_at DESC
        `).all(req.params.vid);

        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/clients/vehicles/:vid/health
// @desc    Get vehicle health score and predicted service intervals
router.get('/vehicles/:vid/health', auth, hasPermission('vehicles'), (req, res) => {
    const vehicleId = parseInt(req.params.vid);
    const db = req.db;

    try {
        const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
        if (!vehicle) return res.status(404).json({ message: 'Vehículo no encontrado' });

        const intervals = db.prepare(`
            SELECT * FROM service_intervals
            WHERE vehicle_id = ?
            ORDER BY confidence DESC, predicted_next_date ASC
        `).all(vehicleId);

        const now = new Date();
        const currentKm = vehicle.km || 0;
        let onTime = 0, overdue = 0, unknown = 0;

        const annotated = intervals.map(interval => {
            let status = 'unknown';
            let urgency = 0;

            if (interval.confidence >= 25) {
                const dateOverdue = interval.predicted_next_date
                    ? new Date(interval.predicted_next_date) < now
                    : false;
                const kmOverdue = interval.predicted_next_km
                    ? currentKm > interval.predicted_next_km
                    : false;

                if (dateOverdue || kmOverdue) {
                    status = 'overdue';
                    overdue++;
                    if (interval.predicted_next_km && currentKm > interval.predicted_next_km) {
                        urgency = Math.min(
                            Math.round(((currentKm - interval.predicted_next_km) / (interval.avg_km_interval || 5000)) * 100),
                            100
                        );
                    } else if (interval.predicted_next_date) {
                        const daysLate = Math.round((now - new Date(interval.predicted_next_date)) / 86400000);
                        urgency = Math.min(
                            Math.round((daysLate / (interval.avg_day_interval || 180)) * 100),
                            100
                        );
                    }
                } else {
                    status = 'ok';
                    onTime++;
                }
            } else {
                unknown++;
            }

            return { ...interval, status, urgency };
        });

        const total = onTime + overdue;
        const healthScore = total > 0 ? Math.round((onTime / total) * 100) : null;

        const timeline = db.prepare(`
            SELECT o.id, o.status, o.delivered_at, o.created_at, v.km,
                   GROUP_CONCAT(oi.description, ' · ') as services
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.vehicle_id = ? AND o.status = 'delivered'
            GROUP BY o.id
            ORDER BY o.delivered_at DESC
            LIMIT 10
        `).all(vehicleId);

        res.json({
            vehicle,
            healthScore,
            intervals: annotated,
            timeline,
            stats: { onTime, overdue, unknown }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching vehicle health' });
    }
});

// @route   DELETE api/clients/vehicles/:vid
router.delete('/vehicles/:vid', auth, hasPermission('vehicles'), (req, res) => {
    try {
        // Check if vehicle has orders
        const orders = req.db.prepare('SELECT COUNT(*) as count FROM orders WHERE vehicle_id = ?').get(req.params.vid);
        if (orders.count > 0) {
            return res.status(400).json({ message: 'No se puede eliminar un vehículo que tiene órdenes registradas' });
        }

        req.db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.vid);
        res.json({ message: 'Vehículo eliminado' });
        logActivity(req.slug, req.user, 'DELETE_VEHICLE', 'vehicle', req.params.vid, {}, req);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   POST api/clients/vehicles/:vid/photo
router.post('/vehicles/:vid/photo', auth, hasPermission('vehicles'), upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
        const photoPath = `/uploads/${req.user.slug}/vehicles/${req.file.filename}`;
        req.db.prepare('UPDATE vehicles SET image_path = ? WHERE id = ?').run(photoPath, req.params.vid);
        res.json({ message: 'Foto actualizada', photoPath });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// --- Vehicle Reference Management ---



// @route   POST api/clients/vehicle-reference
router.post('/vehicle-reference', auth, hasPermission('settings'), (req, res) => {
    const { brand, model, version } = req.body;
    try {
        const result = req.db.prepare('INSERT OR IGNORE INTO vehicle_reference (brand, model, version) VALUES (?, ?, ?)').run(brand, model, version || null);
        res.json({ id: result.lastInsertRowid, message: 'Referencia agregada' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/clients/vehicle-reference/:id
router.delete('/vehicle-reference/:id', auth, hasPermission('settings'), (req, res) => {
    try {
        req.db.prepare('DELETE FROM vehicle_reference WHERE id = ?').run(req.params.id);
        res.json({ message: 'Referencia eliminada' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});




module.exports = router;
