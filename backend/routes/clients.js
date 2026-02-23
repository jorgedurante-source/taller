const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auth middlewares
const { auth } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// Multer storage for vehicle photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.resolve(__dirname, `../tenants/${req.user.slug}/uploads/vehicles`);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `veh_${req.params.vid}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
router.get('/', auth, (req, res) => {
    const clients = req.db.prepare("SELECT *, (first_name || ' ' || last_name) as full_name FROM clients").all();
    res.json(clients);
});

// @route   POST api/clients
router.post('/', auth, (req, res) => {
    const { first_name, last_name, nickname, phone, email, address, notes, vehicle } = req.body;

    // Use a transaction for consistency
    const insertClient = req.db.prepare('INSERT INTO clients (first_name, last_name, nickname, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertVehicle = req.db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, year, km) VALUES (?, ?, ?, ?, ?, ?)');
    const insertKmHistory = req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        const clientResult = insertClient.run(data.first_name, data.last_name, data.nickname, data.phone, data.email, data.address, data.notes);
        const clientId = clientResult.lastInsertRowid;

        if (data.vehicle) {
            const vResult = insertVehicle.run(
                clientId,
                data.vehicle.plate,
                data.vehicle.brand,
                data.vehicle.model,
                data.vehicle.year || null,
                data.vehicle.km || null
            );
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
    } catch (err) {
        if (err.message.includes('plate')) {
            return res.status(400).json({ message: 'La patente ya está registrada' });
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// @route   PUT api/clients/:id
router.put('/:id', auth, (req, res) => {
    const { first_name, last_name, nickname, phone, email, address, notes } = req.body;
    try {
        req.db.prepare(`
            UPDATE clients 
            SET first_name = ?, last_name = ?, nickname = ?, phone = ?, email = ?, address = ?, notes = ? 
            WHERE id = ?
        `).run(first_name, last_name, nickname, phone, email, address, notes, req.params.id);
        res.json({ message: 'Cliente actualizado' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/clients/:id/password
router.post('/:id/password', auth, async (req, res) => {
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

// @route   GET api/clients/all-vehicles
router.get('/all-vehicles', auth, (req, res) => {
    const vehicles = req.db.prepare(`
        SELECT v.*, c.first_name, c.last_name, c.phone as client_phone 
        FROM vehicles v
        JOIN clients c ON v.client_id = c.id
    `).all();
    res.json(vehicles);
});

// @route   GET api/clients/:id/vehicles
router.get('/:id/vehicles', auth, (req, res) => {
    const vehicles = req.db.prepare('SELECT * FROM vehicles WHERE client_id = ?').all(req.params.id);
    res.json(vehicles);
});

// @route   POST api/clients/:id/vehicles
router.post('/:id/vehicles', auth, (req, res) => {
    const { plate, brand, model, year, km, photos } = req.body;
    try {
        const result = req.db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, year, km, photos) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            req.params.id, plate, brand, model, year, km, JSON.stringify(photos || [])
        );

        // Log initial km
        if (km && parseInt(km) > 0) {
            req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes) VALUES (?, ?, ?)').run(
                result.lastInsertRowid, parseInt(km), 'Kilometraje inicial al registrar vehículo'
            );
        }

        res.json({ id: result.lastInsertRowid, plate, brand, model });
    } catch (err) {
        if (err.message && err.message.includes('plate')) {
            return res.status(400).json({ message: 'La patente ya está registrada' });
        }
        res.status(500).json({ message: 'Error interno: ' + err.message });
    }
});

// @route   PUT api/clients/vehicles/:vid
router.put('/vehicles/:vid', auth, (req, res) => {
    const { brand, model, plate, year, km, status } = req.body;
    try {
        const current = req.db.prepare('SELECT km FROM vehicles WHERE id = ?').get(req.params.vid);

        req.db.prepare(`
            UPDATE vehicles 
            SET brand = ?, model = ?, plate = ?, year = ?, km = ?, status = ? 
            WHERE id = ?
        `).run(brand, model, plate, year, km, status, req.params.vid);

        // Log km change if km actually changed
        if (current && km !== undefined && km !== null && parseInt(km) !== parseInt(current.km || 0)) {
            req.db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km) VALUES (?, ?)').run(req.params.vid, parseInt(km));
        }

        res.json({ message: 'Vehículo actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/clients/vehicles/:vid/km
// @desc    Update only the km of a vehicle and log the change
router.put('/vehicles/:vid/km', auth, (req, res) => {
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

        res.json({ message: 'Kilometraje actualizado', km: newKm, delta: newKm - oldKm });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/clients/vehicles/:vid/km-history
// @desc    Get the km history for a vehicle
router.get('/vehicles/:vid/km-history', auth, (req, res) => {
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

// @route   DELETE api/clients/vehicles/:vid
router.delete('/vehicles/:vid', auth, (req, res) => {
    try {
        // Check if vehicle has orders
        const orders = req.db.prepare('SELECT COUNT(*) as count FROM orders WHERE vehicle_id = ?').get(req.params.vid);
        if (orders.count > 0) {
            return res.status(400).json({ message: 'No se puede eliminar un vehículo que tiene órdenes registradas' });
        }

        req.db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.vid);
        res.json({ message: 'Vehículo eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   POST api/clients/vehicles/:vid/photo
router.post('/vehicles/:vid/photo', auth, upload.single('photo'), (req, res) => {
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

module.exports = router;
