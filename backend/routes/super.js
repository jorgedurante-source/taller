const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const superDb = require('../superDb');
const { createTenant, listTenants, getDb, tenantExists } = require('../tenantManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.resolve(__dirname, `../temp_uploads`);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// ─── Super auth middleware ───────────────────────────────────────────────────
function superAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No se encontró token de sesión' });
    try {
        const secret = process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';
        const decoded = jwt.verify(token, secret);
        if (decoded.role !== 'superuser') return res.status(403).json({ message: 'Acceso restringido a superadministradores' });
        req.superUser = decoded;
        next();
    } catch (err) {
        console.error('[superAuth] Token error:', err.message);
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
}

// ─── POST /api/super/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = superDb.prepare('SELECT * FROM super_users WHERE username = ?').get(username);
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });

        const secret = process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';
        const token = jwt.sign(
            { id: user.id, username: user.username, role: 'superuser' },
            secret,
            { expiresIn: '12h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: 'superuser' } });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ─── GET /api/super/workshops ────────────────────────────────────────────────
router.get('/workshops', superAuth, (req, res) => {
    try {
        const workshops = listTenants();
        const enriched = workshops.map(w => {
            try {
                const db = getDb(w.slug);
                const orders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status != 'Entregado'").get();
                const clients = db.prepare("SELECT COUNT(*) as c FROM clients").get();
                return { ...w, active_orders: orders.c, total_clients: clients.c };
            } catch (e) {
                return { ...w, active_orders: 0, total_clients: 0 };
            }
        });
        res.json(enriched);
    } catch (err) {
        console.error('[super:/workshops] Global error:', err);
        res.status(500).json({ message: 'Error interno al listar talleres' });
    }
});

// ─── POST /api/super/workshops ───────────────────────────────────────────────
router.post('/workshops', superAuth, (req, res) => {
    const { slug, name } = req.body;
    if (!slug || !name) return res.status(400).json({ message: 'slug y name son requeridos' });
    try {
        const result = createTenant(slug, name);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─── PATCH /api/super/workshops/:slug ────────────────────────────────────────
router.patch('/workshops/:slug', superAuth, (req, res) => {
    const { slug } = req.params;
    const { name, status, environment } = req.body;
    try {
        if (name) superDb.prepare("UPDATE workshops SET name = ? WHERE slug = ?").run(name, slug);
        if (status) superDb.prepare("UPDATE workshops SET status = ? WHERE slug = ?").run(status, slug);
        if (environment) superDb.prepare("UPDATE workshops SET environment = ? WHERE slug = ?").run(environment, slug);
        res.json({ message: 'Taller actualizado' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// ─── POST /api/super/workshops/:slug/seed ────────────────────────────────────
router.post('/workshops/:slug/seed', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const workshop = superDb.prepare('SELECT environment FROM workshops WHERE slug = ?').get(slug);
        if (workshop?.environment !== 'dev') {
            return res.status(403).json({ message: 'Esta operación solo está permitida en modo Desarrollo' });
        }

        const db = getDb(slug);
        const { seedWorkshop } = require('../utils/seeder');
        seedWorkshop(db);
        res.json({ message: 'Datos de prueba insertados' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al sembrar datos' });
    }
});

// ─── POST /api/super/workshops/:slug/clear ───────────────────────────────────
router.post('/workshops/:slug/clear', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const workshop = superDb.prepare('SELECT environment FROM workshops WHERE slug = ?').get(slug);
        if (workshop?.environment !== 'dev') {
            return res.status(403).json({ message: 'Esta operación solo está permitida en modo Desarrollo' });
        }

        const db = getDb(slug);
        const { clearWorkshop } = require('../utils/seeder');
        clearWorkshop(db);
        res.json({ message: 'Base de datos del taller limpia' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al limpiar base de datos' });
    }
});

// ─── POST /api/super/workshops/:slug/reseed-templates ────────────────────────
router.post('/workshops/:slug/reseed-templates', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const db = getDb(slug);
        const { reseedTemplates } = require('../utils/seeder');
        reseedTemplates(db);
        res.json({ message: 'Plantillas de mensajes restauradas' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al restaurar plantillas' });
    }
});

// ─── POST /api/super/workshops/:slug/token ───────────────────────────────────
router.post('/workshops/:slug/token', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const newToken = superDb.generateApiToken();
        superDb.prepare("UPDATE workshops SET api_token = ? WHERE slug = ?").run(newToken, slug);
        res.json({ api_token: newToken });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// ─── POST /api/super/workshops/:slug/logo ────────────────────────────────────
router.post('/workshops/:slug/logo', superAuth, upload.single('logo'), (req, res) => {
    const { slug } = req.params;
    if (!req.file) return res.status(400).json({ message: 'Logo file required' });
    try {
        const targetDir = path.resolve(__dirname, `../tenants/${slug}/uploads/site`);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const targetPath = path.resolve(targetDir, req.file.filename);
        fs.renameSync(req.file.path, targetPath);

        const logoPath = `/uploads/${slug}/site/${req.file.filename}`;
        superDb.prepare("UPDATE workshops SET logo_path = ? WHERE slug = ?").run(logoPath, slug);
        res.json({ logo_path: logoPath });
    } catch (err) {
        console.error('[super] Error uploading logo:', err);
        res.status(500).json({ message: 'Error server: ' + err.message });
    }
});

// ─── DELETE /api/super/workshops/:slug ──────────────────────────────────────
router.delete('/workshops/:slug', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const result = require('../tenantManager').deleteTenant(slug);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─── POST /api/super/workshops/:slug/admin-password ─────────────────────────
router.post('/workshops/:slug/admin-password', superAuth, async (req, res) => {
    const { slug } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required' });

    try {
        const db = getDb(slug);
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = db.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run(hashedPassword);

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Usuario admin no encontrado en este taller' });
        }

        res.json({ message: 'Contraseña de administrador actualizada correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ─── SETTINGS ROUTES ──────────────────────────────────────────────────────────

router.get('/settings', superAuth, (req, res) => {
    try {
        const settings = superDb.prepare("SELECT * FROM global_settings").all();
        const config = {};
        settings.forEach(s => config[s.key] = s.value);
        res.json(config);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.post('/settings', superAuth, (req, res) => {
    const updates = req.body; // { key: value, ... }
    try {
        const upsert = superDb.prepare("INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        Object.entries(updates).forEach(([key, value]) => {
            upsert.run(key, String(value));
        });
        res.json({ message: 'Settings updated' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// ─── GET /api/super/impersonate/:slug ────────────────────────────────────────
router.post('/impersonate/:slug', superAuth, (req, res) => {
    const { slug } = req.params;
    if (!tenantExists(slug)) return res.status(404).json({ message: 'Taller no encontrado' });

    const db = getDb(slug);
    const adminRole = db.prepare("SELECT id, permissions FROM roles WHERE name = 'Admin'").get();
    let permissions = [];
    try { permissions = JSON.parse(adminRole?.permissions || '[]'); } catch (e) { }

    const workshop = superDb.prepare("SELECT api_token FROM workshops WHERE slug = ?").get(slug);
    const secret = workshop?.api_token || process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';

    const token = jwt.sign(
        { id: 0, username: `superuser@${slug}`, role: 'superuser', permissions, slug, isSuperuser: true },
        secret,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: { id: 0, username: `superuser@${slug}`, role: 'superuser', permissions, isSuperuser: true, slug }
    });
});

// ─── GET /api/super/stats ────────────────────────────────────────────────────
router.get('/stats', superAuth, (req, res) => {
    try {
        const workshops = listTenants();
        let totalOrders = 0, totalClients = 0, totalVehicles = 0;
        for (const w of workshops) {
            try {
                const db = getDb(w.slug);
                totalOrders += db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
                totalClients += db.prepare("SELECT COUNT(*) as c FROM clients").get().c;
                totalVehicles += db.prepare("SELECT COUNT(*) as c FROM vehicles").get().c;
            } catch (e) { }
        }
        res.json({
            total_workshops: workshops.length,
            active_workshops: workshops.filter(w => w.status === 'active').length,
            total_orders: totalOrders,
            total_clients: totalClients,
            total_vehicles: totalVehicles
        });
    } catch (err) {
        console.error('[super:/stats] Global error:', err);
        res.status(500).json({ message: 'Error interno al calcular estadísticas' });
    }
});

module.exports = router;
