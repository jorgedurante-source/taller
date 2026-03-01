const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const unzipper = require('unzipper');
const superDb = require('../superDb');
const { createTenant, listTenants, getDb, closeDb, tenantExists, getTenantDir } = require('../tenantManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { LOGS_DIR } = require('../lib/logger');
const { logSystemActivity, logActivity } = require('../lib/auditLogger');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

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
        if (decoded.role !== 'superusuario' && decoded.role !== 'superuser' && decoded.role !== 'superadmin') return res.status(403).json({ message: 'Acceso restringido a superadministradores' });

        // --- Session Timeout Check ---
        const user = superDb.prepare('SELECT last_activity FROM super_users WHERE id = ?').get(decoded.id);
        if (user && user.last_activity) {
            const timeoutMinutes = parseInt(superDb.prepare("SELECT value FROM global_settings WHERE key = 'superadmin_session_timeout'").get()?.value || '120');
            const lastActivity = new Date(user.last_activity);
            const now = new Date();
            const diffMins = (now - lastActivity) / (1000 * 60);

            if (diffMins > timeoutMinutes) {
                return res.status(401).json({ message: 'Sesión expirada por inactividad', timeout: true });
            }
        }

        // Update activity
        superDb.prepare('UPDATE super_users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(decoded.id);

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
            { id: user.id, username: user.username, role: 'superadmin', language: user.language || 'es' },
            secret,
            { expiresIn: '12h' }
        );

        superDb.prepare('UPDATE super_users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        logSystemActivity(user, 'LOGIN', 'auth', user.id, 'Superadmin logged in', req);

        res.json({ token, user: { id: user.id, username: user.username, role: 'superadmin', language: user.language || 'es' } });
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
            let enabledModules = [];
            try {
                enabledModules = JSON.parse(w.enabled_modules || '[]');
            } catch (e) {
                console.error(`[super] Error parsing modules for ${w.slug}:`, e.message);
            }

            try {
                const db = getDb(w.slug);
                const orders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status != 'Entregado'").get();
                const clients = db.prepare("SELECT COUNT(*) as c FROM clients").get();
                const errors = db.prepare("SELECT COUNT(*) as c FROM system_logs WHERE level = 'error'").get();
                return {
                    ...w,
                    enabled_modules: enabledModules,
                    active_orders: orders.c,
                    total_clients: clients.c,
                    error_count: errors.c
                };
            } catch (e) {
                return { ...w, enabled_modules: enabledModules, active_orders: 0, total_clients: 0, error_count: 0 };
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
        logSystemActivity(req.superUser, 'CREATE_WORKSHOP', 'workshop', slug, `Created workshop: ${name}`, req);
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
        if (req.body.enabled_modules) {
            superDb.prepare("UPDATE workshops SET enabled_modules = ? WHERE slug = ?").run(
                JSON.stringify(req.body.enabled_modules),
                slug
            );
        }
        logSystemActivity(req.superUser, 'UPDATE_WORKSHOP', 'workshop', slug, req.body, req);
        res.json({ message: 'Taller actualizado' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// ─── POST /api/super/workshops/:slug/seed ────────────────────────────────────
router.post('/workshops/:slug/seed', superAuth, (req, res) => {
    const { slug } = req.params;
    const { type } = req.body; // 'operational', 'users'
    try {
        const workshop = superDb.prepare('SELECT environment FROM workshops WHERE slug = ?').get(slug);
        if (workshop?.environment !== 'dev') {
            return res.status(403).json({ message: 'Esta operación solo está permitida en modo Desarrollo' });
        }

        const db = getDb(slug);
        const { seedWorkshop, seedUsers } = require('../utils/seeder');

        if (type === 'users') {
            seedUsers(db);
            logSystemActivity(req.superUser, 'SEED_USERS', 'workshop', slug, 'Inserted test users', req);
        } else {
            seedWorkshop(db);
            logSystemActivity(req.superUser, 'SEED_WORKSHOP', 'workshop', slug, 'Inserted test data', req);
        }

        res.json({ message: 'Datos de prueba insertados' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al sembrar datos' });
    }
});

// ─── POST /api/super/workshops/:slug/clear ───────────────────────────────────
router.post('/workshops/:slug/clear', superAuth, (req, res) => {
    const { slug } = req.params;
    const { type } = req.body; // 'operational', 'users', 'templates'
    try {
        const workshop = superDb.prepare('SELECT environment FROM workshops WHERE slug = ?').get(slug);
        if (workshop?.environment !== 'dev') {
            return res.status(403).json({ message: 'Esta operación solo está permitida en modo Desarrollo' });
        }

        const db = getDb(slug);
        const { clearOperationalData, clearUsersAndRoles } = require('../utils/seeder');

        if (type === 'users') {
            clearUsersAndRoles(db);
            logSystemActivity(req.superUser, 'CLEAR_USERS', 'workshop', slug, 'Wiped users and roles', req);
        } else if (type === 'templates') {
            db.prepare('DELETE FROM templates').run();
            logSystemActivity(req.superUser, 'CLEAR_TEMPLATES', 'workshop', slug, 'Wiped templates', req);
        } else {
            clearOperationalData(db);
            logSystemActivity(req.superUser, 'CLEAR_WORKSHOP', 'workshop', slug, 'Database operational data wiped', req);
        }
        res.json({ message: 'Datos eliminados correctamente' });
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

// ─── POST /api/super/workshops/:slug/test-error ─────────────────────────────
router.post('/workshops/:slug/test-error', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const { logError } = require('../lib/logger');
        const { getDb } = require('../tenantManager');
        const db = getDb(slug);

        // Simular un error manual
        const error = new Error('Error de prueba generado manualmente desde Superadmin');
        error.stack = 'Stack trace simulado:\n  at Object.test-error (routes/super.js)\n  --- Fin ---';

        logError(db, slug, error, req);

        res.json({ message: 'Error de prueba registrado correctamente' });
    } catch (err) {
        res.status(500).json({ message: 'Error al generar error de prueba' });
    }
});

// ─── GET /api/super/workshops/:slug/logs ─────────────────────────────────────
router.get('/workshops/:slug/logs', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const db = getDb(slug);
        const limit = parseInt(req.query.limit) || 100;
        const logs = db.prepare(`
            SELECT sl.*, u.username as user_name
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            ORDER BY sl.created_at DESC
            LIMIT ?
        `).all(limit);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener logs' });
    }
});

// ─── GET /api/super/workshops/:slug/audit ─────────────────────────────────────
router.get('/workshops/:slug/audit', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const db = getDb(slug);
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const logs = db.prepare(`
            SELECT a.*, COALESCE(u.username, a.user_name, 'Sistema') as user_display_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
        res.json(logs);
    } catch (err) {
        console.error(`[super:/audit/${slug}] Error:`, err);
        res.status(500).json({ message: 'Error al obtener auditoría del taller' });
    }
});

// ─── GET /api/super/workshops/:slug/logs/file ────────────────────────────────
router.get('/workshops/:slug/logs/file', superAuth, (req, res) => {
    const { slug } = req.params;
    try {
        const logPath = path.join(LOGS_DIR, `error_${slug}.log`);
        if (!fs.existsSync(logPath)) return res.json([]);

        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').map(line => {
            try { return JSON.parse(line); } catch (e) { return { message: line }; }
        }).reverse();
        res.json(lines);
    } catch (err) {
        res.status(500).json({ message: 'Error al leer archivo de logs' });
    }
});

// ─── DELETE /api/super/workshops/:slug/logs ──────────────────────────────────
router.delete('/workshops/:slug/logs', superAuth, (req, res) => {
    const { slug } = req.params;
    const { mode, ids } = req.query; // mode='all'|'old' or ids='1,2,3'
    try {
        const db = getDb(slug);
        if (ids) {
            const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (idList.length > 0) {
                const placeholders = idList.map(() => '?').join(',');
                db.prepare(`DELETE FROM system_logs WHERE id IN (${placeholders})`).run(...idList);
            }
        } else if (mode === 'all') {
            db.prepare('DELETE FROM system_logs').run();
            const logPath = path.join(LOGS_DIR, `error_${slug}.log`);
            if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '');
        } else {
            db.prepare("DELETE FROM system_logs WHERE created_at < date('now', '-30 days')").run();
        }
        res.json({ message: 'Logs purgados correctamente' });
    } catch (err) {
        res.status(500).json({ message: 'Error al purgar logs' });
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

    const workshop = superDb.prepare("SELECT api_token, enabled_modules FROM workshops WHERE slug = ?").get(slug);
    let enabledModules = [];
    try { enabledModules = JSON.parse(workshop?.enabled_modules || '[]'); } catch (e) { }

    // Superusers get all enabled modules
    const finalPermissions = enabledModules;

    const secret = workshop?.api_token || process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';

    // Get superuser language
    const superUser = superDb.prepare('SELECT language FROM super_users WHERE id = ?').get(req.superUser.id);
    const language = superUser?.language || 'es';

    const token = jwt.sign(
        {
            id: 0,
            username: `superuser@${slug}`,
            role: 'superuser',
            permissions: finalPermissions,
            slug,
            isSuperuser: true,
            superId: req.superUser.id,
            language
        },
        secret,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: {
            id: 0,
            username: `superuser@${slug}`,
            role: 'superuser',
            permissions: finalPermissions,
            isSuperuser: true,
            slug,
            language
        }
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

// ─── GET /api/super/reports ──────────────────────────────────────────────────
router.get('/reports', superAuth, (req, res) => {
    try {
        const workshops = listTenants();

        // 1. Crecimiento (Talleres por mes)
        const activeWorkshopsRaw = superDb.prepare(`
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
            FROM workshops GROUP BY month ORDER BY month ASC
        `).all();

        // 2. Volumen Global (Órdenes por día - last 7 days)
        const currentMs = Date.now();
        const ordersByDay = {}; // 'YYYY-MM-DD': count
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentMs - (i * 86400000));
            ordersByDay[d.toISOString().split('T')[0]] = 0;
        }

        // 3. Salud (Activos vs Inactivos)
        let activosCount = 0;
        let inactivosCount = 0;

        // 4. Consumo de Espacio
        const diskUsage = [];
        const fs = require('fs');
        const getDirSize = (dirPath) => {
            let size = 0;
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const file of files) {
                    const fullPath = path.join(dirPath, file.name);
                    if (file.isDirectory()) size += getDirSize(fullPath);
                    else size += fs.statSync(fullPath).size;
                }
            }
            return size;
        };

        for (const w of workshops) {
            // Health Map
            const isInactive = w.status === 'inactive';
            if (isInactive) inactivosCount++;
            else activosCount++;

            // Orders Map
            try {
                const db = getDb(w.slug);
                const recentOrders = db.prepare(`SELECT date(created_at) as date, COUNT(*) as count FROM orders WHERE created_at >= date('now', '-7 days') GROUP BY date`).all();
                for (const row of recentOrders) {
                    if (ordersByDay[row.date] !== undefined) ordersByDay[row.date] += row.count;
                }
            } catch (e) { }

            // Disk Usage Map
            try {
                const tDir = getTenantDir(w.slug);
                const bytes = getDirSize(tDir);
                diskUsage.push({ name: w.name || w.slug, size: bytes });
            } catch (e) { }
        }

        // 5. Workshop comparison metrics
        const comparisonMetrics = [];
        for (const w of workshops) {
            try {
                const db = getDb(w.slug);

                const ordersThisMonth = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM orders
                    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
                `).get();

                const avgTicket = db.prepare(`
                    SELECT ROUND(AVG(oi_total.total), 0) as avg
                    FROM (
                        SELECT order_id, SUM(subtotal) as total
                        FROM order_items
                        GROUP BY order_id
                    ) oi_total
                    JOIN orders o ON o.id = oi_total.order_id
                    WHERE o.status = 'delivered'
                      AND o.delivered_at >= date('now', '-30 days')
                `).get();

                const avgRepairDays = db.prepare(`
                    SELECT ROUND(AVG(JULIANDAY(delivered_at) - JULIANDAY(created_at)), 1) as avg
                    FROM orders
                    WHERE delivered_at IS NOT NULL
                      AND delivered_at >= date('now', '-90 days')
                `).get();

                const activeOrders = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM orders
                    WHERE status NOT IN ('delivered', 'cancelled')
                `).get();

                const totalClients = db.prepare(`SELECT COUNT(*) as count FROM clients`).get();

                const returnRate = db.prepare(`
                    SELECT ROUND(
                        100.0 * COUNT(DISTINCT CASE WHEN order_count > 1 THEN client_id END) / NULLIF(COUNT(DISTINCT client_id), 0),
                        1
                    ) as rate
                    FROM (
                        SELECT client_id, COUNT(*) as order_count FROM orders GROUP BY client_id
                    )
                `).get();

                comparisonMetrics.push({
                    slug: w.slug,
                    name: w.name || w.slug,
                    status: w.status,
                    orders_this_month: ordersThisMonth?.count || 0,
                    avg_ticket: avgTicket?.avg || 0,
                    avg_repair_days: avgRepairDays?.avg || 0,
                    active_orders: activeOrders?.count || 0,
                    total_clients: totalClients?.count || 0,
                    return_rate: returnRate?.rate || 0,
                });
            } catch (e) {
                // Taller sin datos o DB aún no inicializada
                comparisonMetrics.push({
                    slug: w.slug,
                    name: w.name || w.slug,
                    status: w.status,
                    orders_this_month: 0,
                    avg_ticket: 0,
                    avg_repair_days: 0,
                    active_orders: 0,
                    total_clients: 0,
                    return_rate: 0,
                });
            }
        }

        // Sort Top 5
        diskUsage.sort((a, b) => b.size - a.size);
        const top5Disk = diskUsage.slice(0, 5);

        // Format Global Volume
        const globalVolume = Object.keys(ordersByDay).sort().map(date => ({ month: date, count: ordersByDay[date] }));

        res.json({
            growth: activeWorkshopsRaw.map(r => ({ month: r.month, total: r.count })),
            orders: globalVolume,
            health: [
                { name: 'active', value: activosCount },
                { name: 'inactive', value: inactivosCount }
            ],
            storage: top5Disk,
            comparison: comparisonMetrics
        });

    } catch (err) {
        console.error('[super:/reports] Global error:', err);
        res.status(500).json({ message: 'Error interno al generar reportes' });
    }
});

// ─── GET /api/super/workshops/:slug/backup ───────────────────────────────────
router.get('/workshops/:slug/backup', superAuth, (req, res) => {
    const { slug } = req.params;
    if (!tenantExists(slug)) return res.status(404).json({ message: 'Taller no encontrado' });

    const tenantDir = getTenantDir(slug);

    // CRITICAL: Force checkpoint so db.sqlite is up to date
    try {
        const db = getDb(slug);
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
        console.warn(`[backup] Checkpoint failed for ${slug}:`, e.message);
    }

    const date = new Date().toISOString().split('T')[0];
    const filename = `backup-${slug}-${date}.zip`;

    res.attachment(filename);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    // Add DB
    const dbPath = path.join(tenantDir, 'db.sqlite');
    if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'db.sqlite' });
    }

    // Add Uploads if exists
    const uploadsPath = path.join(tenantDir, 'uploads');
    if (fs.existsSync(uploadsPath)) {
        archive.directory(uploadsPath, 'uploads');
    }

    archive.finalize();
});

// ─── GET /api/super/workshops/:slug/backups ──────────────────────────────────
router.get('/workshops/:slug/backups', superAuth, (req, res) => {
    const { slug } = req.params;
    const workshopBackupsDir = path.join(BACKUPS_DIR, slug);
    if (!fs.existsSync(workshopBackupsDir)) return res.json([]);

    const files = fs.readdirSync(workshopBackupsDir)
        .filter(f => f.endsWith('.zip'))
        .map(f => {
            const stats = fs.statSync(path.join(workshopBackupsDir, f));
            return {
                name: f,
                size: stats.size,
                created_at: stats.birthtime
            };
        })
        .sort((a, b) => b.created_at - a.created_at);

    res.json(files);
});

// ─── POST /api/super/workshops/:slug/backups/create ──────────────────────────
router.post('/workshops/:slug/backups/create', superAuth, (req, res) => {
    const { slug } = req.params;
    if (!tenantExists(slug)) return res.status(404).json({ message: 'Taller no encontrado' });

    const workshopBackupsDir = path.join(BACKUPS_DIR, slug);
    if (!fs.existsSync(workshopBackupsDir)) fs.mkdirSync(workshopBackupsDir, { recursive: true });

    const tenantDir = getTenantDir(slug);

    // Checkpoint DB to ensure the .sqlite file has all data before zipping
    try {
        const { getDb } = require('../tenantManager');
        const db = getDb(slug);
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
        console.warn(`[backup] Could not checkpoint DB for ${slug}:`, e.message);
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `manual-${date}.zip`;
    const destPath = path.join(workshopBackupsDir, filename);

    const output = fs.createWriteStream(destPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => res.json({ message: 'Backup creado', filename }));
    archive.on('error', (err) => res.status(500).send({ error: err.message }));

    archive.pipe(output);
    const dbPath = path.join(tenantDir, 'db.sqlite');
    if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'db.sqlite' });
    const uploadsPath = path.join(tenantDir, 'uploads');
    if (fs.existsSync(uploadsPath)) archive.directory(uploadsPath, 'uploads');

    archive.finalize();
    logSystemActivity(req.superUser, 'CREATE_MANUAL_BACKUP', 'backup', slug, { filename }, req);
});

// ─── DELETE /api/super/workshops/:slug/backups/:filename ────────────────────
router.delete('/workshops/:slug/backups/:filename', superAuth, (req, res) => {
    const { slug, filename } = req.params;
    const filePath = path.join(BACKUPS_DIR, slug, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    try {
        fs.unlinkSync(filePath);
        logSystemActivity(req.superUser, 'DELETE_BACKUP', 'backup', slug, { filename }, req);
        res.json({ message: 'Respaldo eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar respaldo' });
    }
});

// ─── POST /api/super/workshops/:slug/restore ─────────────────────────────────
router.post('/workshops/:slug/restore', superAuth, upload.single('backup'), async (req, res) => {
    const { slug } = req.params;
    const { restoreDb, restoreUploads } = req.body; // Strings "true" or "false"

    let zipPath = '';
    if (req.file) {
        zipPath = req.file.path;
    } else if (req.body.filename) {
        zipPath = path.join(BACKUPS_DIR, slug, req.body.filename);
    }

    if (!zipPath || !fs.existsSync(zipPath)) {
        return res.status(400).json({ message: 'No se proporcionó archivo de backup válido' });
    }

    try {
        const tenantDir = getTenantDir(slug);

        // Note: For Database restoration, we no longer delete the file physically.
        // We use an ATTACH DATABASE approach inside the extraction loop to merge data.
        // This avoids "EBUSY" errors on Windows.

        // If restoring uploads, clean the current ones to avoid mixing
        if (restoreUploads === 'true') {
            const uploadsDir = path.join(tenantDir, 'uploads');
            if (fs.existsSync(uploadsDir)) {
                console.log(`[restore] Cleaning uploads directory for ${slug}...`);
                fs.rmSync(uploadsDir, { recursive: true, force: true });
            }
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const directory = await unzipper.Open.file(zipPath);
        let dbRestored = false;
        let uploadsCount = 0;

        console.log(`[restore] ZIP opened: ${zipPath}`);
        console.log(`[restore] Target Workshop: ${slug} (${tenantDir})`);
        console.log(`[restore] ZIP contains ${directory.files.length} entries`);

        for (const entry of directory.files) {
            const normalizedPath = entry.path.replace(/\\/g, '/');

            // Match db.sqlite. If it's a system backup (has tenants/ folder), 
            // we MUST only take the one matching our current slug.
            let isDbFile = false;
            if (normalizedPath === 'db.sqlite') {
                isDbFile = true;
            } else if (normalizedPath.endsWith('/db.sqlite')) {
                // If it's something like "tenants/linares/db.sqlite", 
                // it must match our target slug.
                isDbFile = normalizedPath.includes(`/tenants/${slug}/`) || normalizedPath.startsWith(`tenants/${slug}/`);
            }

            if (isDbFile && restoreDb === 'true') {
                console.log(`[restore] -> Merging Database: ${entry.path} (${entry.uncompressedSize} bytes)`);
                const content = await entry.buffer();

                if (content.length < 100) {
                    throw new Error('El archivo de base de datos en el backup parece estar dañado.');
                }

                // 1. Write the backup to a temporary file
                const tempDbPath = path.join(tenantDir, `temp_restore_${Date.now()}.sqlite`);
                fs.writeFileSync(tempDbPath, content);

                try {
                    const targetDb = getDb(slug);

                    // Pre-cleanup: Ensure the alias is not already attached (from a previous failed run)
                    try { targetDb.prepare(`DETACH DATABASE backup`).run(); } catch (e) { /* ignore */ }

                    // 2. Attach the temporary DB to our current connection
                    targetDb.prepare(`ATTACH DATABASE ? AS backup`).run(tempDbPath);

                    try {

                        // Dynamically get tables from the backup, excluding internal and 'config'
                        const backupTables = targetDb.prepare(`
                        SELECT name FROM backup.sqlite_master 
                        WHERE type='table' 
                        AND name NOT LIKE 'sqlite_%' 
                        AND name != 'config'
                    `).all().map(t => t.name);

                        console.log(`[restore] Found ${backupTables.length} tables in backup to sync.`);

                        // 3. Perform the migration
                        // CRITICAL: Disable foreign keys OUTSIDE the transaction. 
                        // Inside a transaction, this PRAGMA is ignored by SQLite.
                        targetDb.pragma('foreign_keys = OFF');

                        // 3. Perform the migration
                        // CRITICAL: PRAGMA foreign_keys = OFF MUST be outside the transaction
                        targetDb.pragma('foreign_keys = OFF');
                        console.log(`[restore] Foreign keys disabled for ${slug}`);

                        try {
                            const allMainTables = targetDb.prepare(`
                                SELECT name FROM main.sqlite_master 
                                WHERE type='table' 
                                AND name NOT LIKE 'sqlite_%' 
                                AND name != 'config'
                            `).all().map(t => t.name);

                            const runMigration = targetDb.transaction(() => {
                                // A. RESET sequences first to allow clean ID insertion
                                try {
                                    targetDb.prepare(`DELETE FROM main.sqlite_sequence`).run();
                                } catch (e) { /* ignore if table doesn't exist */ }

                                // B. FORCE WIPE all local tables (clean slate)
                                for (const table of allMainTables) {
                                    targetDb.prepare(`DELETE FROM main."${table}"`).run();
                                    console.log(`[restore] Wiped local table "${table}"`);
                                }

                                // C. SYNC from backup maintaining EXACT IDs
                                for (const table of backupTables) {
                                    const mainTableInfo = targetDb.prepare(`PRAGMA main.table_info("${table}")`).all();
                                    const backupTableInfo = targetDb.prepare(`PRAGMA backup.table_info("${table}")`).all();

                                    if (mainTableInfo.length > 0 && backupTableInfo.length > 0) {
                                        const mainCols = mainTableInfo.map(c => c.name);
                                        const backupCols = backupTableInfo.map(c => c.name);

                                        // Intersection: Must include 'id' if it exists in both
                                        const commonCols = mainCols.filter(c => backupCols.includes(c));

                                        if (commonCols.length > 0) {
                                            const colList = commonCols.map(c => `"${c}"`).join(', ');
                                            const ins = targetDb.prepare(`INSERT INTO main."${table}" (${colList}) SELECT ${colList} FROM backup."${table}"`).run();
                                            console.log(`[restore] Restored table "${table}": Added ${ins.changes} rows with ORIGINAL IDs`);
                                        }
                                    }
                                }

                                // D. Finalize sequences from backup data
                                try {
                                    targetDb.prepare(`INSERT INTO main.sqlite_sequence SELECT * FROM backup.sqlite_sequence WHERE name IN (SELECT name FROM main.sqlite_master WHERE type='table')`).run();
                                } catch (e) { /* ignore */ }
                            });

                            runMigration();
                            dbRestored = true;
                            console.log(`[restore] SUCCESS: Database fusion completed for ${slug}`);
                        } finally {
                            // Re-enable foreign keys
                            targetDb.pragma('foreign_keys = ON');
                        }
                    } finally {
                        // ALWAYS DETACH the backup database
                        try { targetDb.prepare(`DETACH DATABASE backup`).run(); } catch (e) { /* ignore */ }
                    }

                } catch (e) {
                    console.error(`[restore] Merge ERROR:`, e.message);
                    throw new Error(`Error al fusionar datos: ${e.message}`);
                } finally {
                    // 4. Cleanup temp file
                    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
                }
            }

            else if (restoreUploads === 'true') {
                // We handle two formats: "uploads/..." or "tenants/slug/uploads/..."
                let uploadRelPath = '';

                if (normalizedPath.startsWith('uploads/')) {
                    uploadRelPath = normalizedPath;
                } else if (normalizedPath.includes(`/tenants/${slug}/uploads/`)) {
                    // Extract only if it matches our workshop slug
                    uploadRelPath = normalizedPath.substring(normalizedPath.indexOf('uploads/'));
                }

                if (uploadRelPath && entry.type !== 'Directory') {
                    const dest = path.join(tenantDir, uploadRelPath);
                    const dir = path.dirname(dest);

                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    const content = await entry.buffer();
                    fs.writeFileSync(dest, content);
                    uploadsCount++;
                }
            }
        }

        // Cleanup temp file if it was an upload
        if (req.file && fs.existsSync(req.file.path)) {
            console.log(`[restore] Cleaning up temp upload: ${req.file.path}`);
            fs.unlinkSync(req.file.path);
        }

        // Final verification
        if (restoreDb === 'true' && !dbRestored) {
            console.error('[restore] FAILED: db.sqlite not found in ZIP');
            throw new Error('No se encontró el archivo db.sqlite en el backup. Asegúrate de que el ZIP sea válido.');
        }

        console.log(`[restore] SUCCESS for ${slug}: DB=${dbRestored}, Files=${uploadsCount}`);

        logSystemActivity(req.superUser, 'RESTORE_BACKUP', 'backup', slug, {
            source: req.file ? 'upload' : req.body.filename,
            restoreDb,
            restoreUploads,
            filesExtracted: uploadsCount
        }, req);

        res.json({
            message: 'Restauración completada con éxito',
            summary: {
                database: dbRestored ? 'Restaurada' : 'No solicitada',
                files: uploadsCount
            }
        });
    } catch (err) {
        console.error('[restore] ERROR CRÍTICO:', err);
        res.status(500).json({
            message: 'Fallo en la restauración: ' + err.message,
            details: err.stack
        });
    }
});

// ─── GET /api/super/system/backup ───────────────────────────────────────────
router.get('/system/backup', superAuth, async (req, res) => {
    const tenants = listTenants();

    // Checkpoint all tenants first
    for (const t of tenants) {
        try {
            const db = getDb(t.slug);
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) { }
    }

    const date = new Date().toISOString().split('T')[0];
    const filename = `system-backup-${date}.zip`;

    res.attachment(filename);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    // Add Super DB
    const superDbPath = path.resolve(__dirname, '../super.db');
    if (fs.existsSync(superDbPath)) {
        archive.file(superDbPath, { name: 'super.db' });
    }

    // Add All Tenants
    const tenantsDir = path.resolve(__dirname, '../tenants');
    if (fs.existsSync(tenantsDir)) {
        archive.directory(tenantsDir, 'tenants');
    }

    archive.finalize();
    logSystemActivity(req.superUser, 'CREATE_SYSTEM_BACKUP', 'system', 'all', { filename }, req);
});

// ─── GET /api/super/audit ───────────────────────────────────────────────────
router.get('/audit', superAuth, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const logs = superDb.prepare(`
            SELECT l.*, COALESCE(u.username, l.super_user_name, 'System') as user_name
            FROM system_audit_logs l
            LEFT JOIN super_users u ON l.super_user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
        res.json(logs);
    } catch (err) {
        console.error('[super:/audit] Error fetching system audit logs:', err);
        res.status(500).json({ message: 'Error interno al obtener logs de auditoría' });
    }
});

// ─── Master Migration Manager ───────────────────────────────────────────────
router.post('/workshops/migrate', superAuth, async (req, res) => {
    try {
        const workshops = listTenants();
        const results = {
            total: workshops.length,
            success: 0,
            failed: 0,
            errors: []
        };

        for (const w of workshops) {
            try {
                // getDb already triggers initTenantDb(db, slug)
                getDb(w.slug);
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push({ slug: w.slug, error: err.message });
                console.error(`[super:migrate] Failed for ${w.slug}:`, err);
            }
        }

        logSystemActivity(req.superUser, 'MIGRATE_ALL', 'system', null, `Executed master migration on ${results.success}/${results.total} workshops`, req);

        res.json(results);
    } catch (err) {
        console.error('[super:/migrate] Error:', err);
        res.status(500).json({ message: 'Error al ejecutar migración maestra' });
    }
});

// ─── Anomalies & Alerts ──────────────────────────────────────────────────────
router.get('/anomalies', superAuth, (req, res) => {
    try {
        const workshops = listTenants();
        const anomalies = [];

        // Load thresholds from settings
        const settingsList = superDb.prepare('SELECT key, value FROM global_settings').all();
        const settings = settingsList.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

        const inactivityDays = parseInt(settings.inactivity_threshold || 30);
        const storageLimitMB = parseInt(settings.storage_threshold_mb || 50);
        const checkEmailAlerts = settings.alert_email_config === 'true';

        const inactivityLimit = new Date();
        inactivityLimit.setDate(inactivityLimit.getDate() - inactivityDays);

        for (const w of workshops) {
            try {
                const db = getDb(w.slug);

                // 1. Check Inactivity (Last order or audit log)
                const lastOrder = db.prepare('SELECT created_at FROM orders ORDER BY created_at DESC LIMIT 1').get();
                const lastAudit = db.prepare('SELECT created_at FROM audit_logs ORDER BY created_at DESC LIMIT 1').get();

                const lastActivity = [
                    lastOrder ? new Date(lastOrder.created_at) : new Date(0),
                    lastAudit ? new Date(lastAudit.created_at) : new Date(0)
                ].sort((a, b) => b - a)[0];

                if (lastActivity < inactivityLimit) {
                    anomalies.push({
                        slug: w.slug,
                        name: w.name,
                        type: 'inactivity',
                        severity: 'warning',
                        message: `Sin actividad en más de ${inactivityDays} días`,
                        last_seen: lastActivity.toISOString()
                    });
                }

                // 2. Check Storage (Individual Tenant)
                const dbPath = path.resolve(__dirname, `../tenants/${w.slug}/taller.db`);
                if (fs.existsSync(dbPath)) {
                    const size = fs.statSync(dbPath).size;
                    const sizeMB = size / 1024 / 1024;
                    if (sizeMB > storageLimitMB) {
                        anomalies.push({
                            slug: w.slug,
                            name: w.name,
                            type: 'storage',
                            severity: 'info',
                            message: `Base de datos grande (${sizeMB.toFixed(1)} MB)`
                        });
                    }
                }

                // 3. Check Email Config
                if (checkEmailAlerts) {
                    const emailConfig = db.prepare('SELECT smtp_host, imap_host FROM config LIMIT 1').get();
                    if (!emailConfig || (!emailConfig.smtp_host && !emailConfig.imap_host)) {
                        anomalies.push({
                            slug: w.slug,
                            name: w.name,
                            type: 'config',
                            severity: 'info',
                            message: 'Email no configurado'
                        });
                    }
                }

            } catch (err) {
                console.error(`[super:anomalies] Error scanning ${w.slug}:`, err);
            }
        }

        res.json(anomalies);
    } catch (err) {
        console.error('[super:/anomalies] Error:', err);
        res.status(500).json({ message: 'Error al escanear anomalías' });
    }
});

// ─── Global Announcements ───────────────────────────────────────────────────
router.get('/announcements', superAuth, (req, res) => {
    try {
        const list = superDb.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener anuncios' });
    }
});

router.post('/announcements', superAuth, (req, res) => {
    const { title, content, type } = req.body;
    try {
        const info = superDb.prepare(`
            INSERT INTO announcements (title, content, type)
            VALUES (?, ?, ?)
        `).run(title, content, type || 'info');

        logSystemActivity(req.superUser, 'CREATE_ANNOUNCEMENT', 'announcement', info.lastInsertRowid, `Created: ${title}`, req);
        res.json({ id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ message: 'Error al crear anuncio' });
    }
});

router.put('/announcements/:id/toggle', superAuth, (req, res) => {
    const { id } = req.params;
    try {
        const item = superDb.prepare('SELECT is_active FROM announcements WHERE id = ?').get(id);
        if (!item) return res.status(404).json({ message: 'No encontrado' });

        const newValue = item.is_active ? 0 : 1;
        superDb.prepare('UPDATE announcements SET is_active = ? WHERE id = ?').run(newValue, id);

        logSystemActivity(req.superUser, 'TOGGLE_ANNOUNCEMENT', 'announcement', id, `New status: ${newValue}`, req);
        res.json({ success: true, is_active: newValue });
    } catch (err) {
        res.status(500).json({ message: 'Error al modificar anuncio' });
    }
});

router.delete('/announcements/:id', superAuth, (req, res) => {
    const { id } = req.params;
    try {
        superDb.prepare('DELETE FROM announcements WHERE id = ?').run(id);
        logSystemActivity(req.superUser, 'DELETE_ANNOUNCEMENT', 'announcement', id, 'Deleted announcement', req);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar anuncio' });
    }
});

// ─── Health & Resources ──────────────────────────────────────────────────────

const getDirSize = (dirPath) => {
    let size = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                size += getDirSize(filePath);
            } else {
                size += stats.size;
            }
        }
    } catch (e) { }
    return size;
};

router.get('/health', superAuth, (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const uptime = os.uptime();
        const cpuLoad = os.loadavg();
        const cpus = os.cpus().length;

        const processUsage = process.memoryUsage();

        // Database sizes
        const superDbPath = path.resolve(__dirname, '../super.db');
        const superDbSize = fs.existsSync(superDbPath) ? fs.statSync(superDbPath).size : 0;

        const tenantsDir = path.resolve(__dirname, '../tenants');
        const tenantsSize = fs.existsSync(tenantsDir) ? getDirSize(tenantsDir) : 0;

        const backupsDir = path.resolve(__dirname, '../backups');
        const backupsSize = fs.existsSync(backupsDir) ? getDirSize(backupsDir) : 0;

        res.json({
            system: {
                platform: os.platform(),
                release: os.release(),
                uptime,
                cpus,
                cpuLoad,
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    percent: (usedMem / totalMem) * 100
                }
            },
            process: {
                memory: processUsage.rss,
                uptime: process.uptime()
            },
            storage: {
                superDb: superDbSize,
                tenants: tenantsSize,
                backups: backupsSize,
                total: superDbSize + tenantsSize + backupsSize
            }
        });
    } catch (err) {
        console.error('[super:/health] Error:', err);
        res.status(500).json({ message: 'Error al obtener estado del sistema' });
    }
});

// ─── Workshop Email Check ────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');

router.get('/workshops/:slug/email-check', superAuth, async (req, res) => {
    const { slug } = req.params;
    try {
        const db = getDb(slug);
        const config = db.prepare('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, imap_host, imap_port, imap_user, imap_pass FROM config LIMIT 1').get();

        if (!config || (!config.smtp_host && !config.imap_host)) {
            return res.json({
                smtp: { status: 'none', message: 'No configurado' },
                imap: { status: 'none', message: 'No configurado' }
            });
        }

        const results = {
            smtp: { status: 'pending' },
            imap: { status: 'pending' }
        };

        // Test SMTP
        if (config.smtp_host) {
            try {
                const transporter = nodemailer.createTransport({
                    host: config.smtp_host,
                    port: config.smtp_port,
                    secure: config.smtp_port === 465,
                    auth: {
                        user: config.smtp_user,
                        pass: config.smtp_pass
                    },
                    connectionTimeout: 5000
                });
                await transporter.verify();
                results.smtp = { status: 'ok', message: 'Conexión exitosa' };
            } catch (err) {
                results.smtp = { status: 'error', message: err.message };
            }
        } else {
            results.smtp = { status: 'none', message: 'No configurado' };
        }

        // Test IMAP
        if (config.imap_host) {
            try {
                const imapConfig = {
                    imap: {
                        user: config.imap_user,
                        password: config.imap_pass,
                        host: config.imap_host,
                        port: config.imap_port,
                        tls: true,
                        authTimeout: 5000
                    }
                };
                const connection = await imaps.connect(imapConfig);
                connection.end();
                results.imap = { status: 'ok', message: 'Conexión exitosa' };
            } catch (err) {
                results.imap = { status: 'error', message: err.message };
            }
        } else {
            results.imap = { status: 'none', message: 'No configurado' };
        }

        res.json(results);
    } catch (err) {
        console.error(`[super:/email-check/${slug}] Error:`, err);
        res.status(500).json({ message: 'Error al verificar conexión de email' });
    }
});

// ─── SUPPORT TICKETS ROUTES ──────────────────────────────────────────────────
router.get('/tickets', superAuth, (req, res) => {
    try {
        const tickets = superDb.prepare("SELECT * FROM support_tickets ORDER BY status = 'open' DESC, created_at DESC").all();
        res.json(tickets);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.post('/tickets/:id/reply', superAuth, (req, res) => {
    const { id } = req.params;
    const { reply } = req.body;
    try {
        superDb.prepare("UPDATE support_tickets SET reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(reply, id);
        res.json({ message: 'Respuesta enviada correctamente' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.put('/tickets/:id/status', superAuth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        superDb.prepare("UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(status, id);
        res.json({ message: 'Estado actualizado correctamente' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// ── Merge clients/vehicles al acoplar un taller a una cadena ─────────────────
function mergeTenantsOnCouple(chainId, newSlug) {
    const { getDb } = require('../tenantManager');
    const { randomUUID } = require('crypto');

    // Obtener todos los slugs del grupo (incluyendo el nuevo)
    const allMembers = superDb.prepare(
        'SELECT tenant_slug FROM chain_members WHERE chain_id = ?'
    ).all(chainId).map(r => r.tenant_slug);

    if (allMembers.length === 0) return;

    // ── Paso 0: Asegurar que todos los clientes/vehículos tengan UUID y source_tenant ──
    // IMPORTANTE: Hacemos esto antes de propagar para que el filtro "WHERE uuid IS NOT NULL" no los ignore
    for (const slug of allMembers) {
        try {
            const db = getDb(slug);
            // Fix clients
            const incompleteClients = db.prepare('SELECT id, uuid, source_tenant FROM clients WHERE uuid IS NULL OR source_tenant IS NULL').all();
            for (const c of incompleteClients) {
                db.prepare('UPDATE clients SET uuid = ?, source_tenant = ? WHERE id = ?')
                    .run(c.uuid || randomUUID(), c.source_tenant || slug, c.id);
            }
            // Fix vehicles
            const incompleteVehicles = db.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE uuid IS NULL OR source_tenant IS NULL').all();
            for (const v of incompleteVehicles) {
                db.prepare('UPDATE vehicles SET uuid = ?, source_tenant = ? WHERE id = ?')
                    .run(v.uuid || randomUUID(), v.source_tenant || slug, v.id);
            }
        } catch (e) {
            console.warn(`[merge] backfill error in ${slug}:`, e.message);
        }
    }

    const newDb = getDb(newSlug);

    // Para cada taller existente en la cadena (que no sea el nuevo)
    const existingMembers = allMembers.filter(s => s !== newSlug);

    for (const existingSlug of existingMembers) {
        const existingDb = getDb(existingSlug);

        // ── Paso 1: Propagar clientes del taller existente → nuevo taller ──
        const existingClients = existingDb.prepare(
            'SELECT * FROM clients WHERE uuid IS NOT NULL'
        ).all();

        for (const client of existingClients) {
            // Buscar si ya existe en el nuevo taller por uuid o email
            const inNew = newDb.prepare('SELECT id, uuid, source_tenant FROM clients WHERE uuid = ?').get(client.uuid)
                || (client.email ? newDb.prepare('SELECT id, uuid, source_tenant FROM clients WHERE email = ? AND email != \'\'').get(client.email) : null);

            if (!inNew) {
                try {
                    newDb.prepare(`
                        INSERT INTO clients (uuid, first_name, last_name, nickname, phone, email,
                        address, notes, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(client.uuid, client.first_name, client.last_name, client.nickname,
                        client.phone, client.email, client.address, client.notes,
                        client.source_tenant, client.created_at);
                } catch (e) {
                    console.warn('[merge] error:', e.message);
                }
            } else if (!inNew.uuid || !inNew.source_tenant) {
                // Tenía el cliente pero le faltaba identidad — actualizar
                newDb.prepare('UPDATE clients SET uuid = ?, source_tenant = ? WHERE id = ?')
                    .run(client.uuid, client.source_tenant || existingSlug, inNew.id);
            }
        }

        // ── Paso 2: Propagar vehículos del taller existente → nuevo taller ──
        const existingVehicles = existingDb.prepare(`
            SELECT v.*, c.uuid as client_uuid
            FROM vehicles v
            JOIN clients c ON v.client_id = c.id
            WHERE v.uuid IS NOT NULL
        `).all();

        for (const vehicle of existingVehicles) {
            // Un vehiculo nuevo solo se puede insertar si ya existe su cliente en el nuevo taller
            const clientInNew = newDb.prepare('SELECT id FROM clients WHERE uuid = ?').get(vehicle.client_uuid);
            if (!clientInNew) continue;

            const inNew = newDb.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE uuid = ?').get(vehicle.uuid)
                || newDb.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE plate = ?').get(vehicle.plate);

            if (!inNew) {
                try {
                    newDb.prepare(`
                        INSERT INTO vehicles (uuid, client_id, plate, brand, model, version, year, km, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(vehicle.uuid, clientInNew.id, vehicle.plate, vehicle.brand,
                        vehicle.model, vehicle.version, vehicle.year, vehicle.km, vehicle.source_tenant, vehicle.created_at);
                } catch (e) {
                    console.warn('[merge] error:', e.message);
                }
            } else if (!inNew.uuid || !inNew.source_tenant) {
                newDb.prepare('UPDATE vehicles SET uuid = ?, source_tenant = ?, client_id = ?, km = ? WHERE id = ?')
                    .run(vehicle.uuid, vehicle.source_tenant || existingSlug, clientInNew.id, vehicle.km, inNew.id);
            }
        }

        // ── Paso 3: Propagar clientes del nuevo taller → talleres existentes ──
        const newClients = newDb.prepare('SELECT * FROM clients WHERE uuid IS NOT NULL').all();

        for (const client of newClients) {
            const inExisting = existingDb.prepare('SELECT id, uuid, source_tenant FROM clients WHERE uuid = ?').get(client.uuid)
                || (client.email ? existingDb.prepare('SELECT id, uuid, source_tenant FROM clients WHERE email = ? AND email != \'\'').get(client.email) : null);

            if (!inExisting) {
                try {
                    existingDb.prepare(`
                        INSERT INTO clients (uuid, first_name, last_name, nickname, phone, email,
                        address, notes, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(client.uuid, client.first_name, client.last_name, client.nickname,
                        client.phone, client.email, client.address, client.notes,
                        client.source_tenant, client.created_at);
                } catch (e) {
                    console.warn('[merge] error:', e.message);
                }
            } else if (!inExisting.uuid || !inExisting.source_tenant) {
                existingDb.prepare('UPDATE clients SET uuid = ?, source_tenant = ? WHERE id = ?')
                    .run(client.uuid, client.source_tenant || newSlug, inExisting.id);
            }
        }

        // ── Paso 4: Propagar vehículos del nuevo taller → talleres existentes ──
        const newVehicles = newDb.prepare(`
            SELECT v.*, c.uuid as client_uuid
            FROM vehicles v
            JOIN clients c ON v.client_id = c.id
            WHERE v.uuid IS NOT NULL
        `).all();

        for (const vehicle of newVehicles) {
            const clientInExisting = existingDb.prepare('SELECT id FROM clients WHERE uuid = ?').get(vehicle.client_uuid);
            if (!clientInExisting) continue;

            const inExisting = existingDb.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE uuid = ?').get(vehicle.uuid)
                || existingDb.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE plate = ?').get(vehicle.plate);

            if (!inExisting) {
                try {
                    existingDb.prepare(`
                        INSERT INTO vehicles (uuid, client_id, plate, brand, model, version, year, km, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(vehicle.uuid, clientInExisting.id, vehicle.plate, vehicle.brand,
                        vehicle.model, vehicle.version, vehicle.year, vehicle.km, vehicle.source_tenant, vehicle.created_at);
                } catch (e) {
                    console.warn('[merge] error:', e.message);
                }
            } else if (!inExisting.uuid || !inExisting.source_tenant) {
                existingDb.prepare('UPDATE vehicles SET uuid = ?, source_tenant = ?, client_id = ?, km = ? WHERE id = ?')
                    .run(vehicle.uuid, vehicle.source_tenant || newSlug, clientInExisting.id, vehicle.km, inExisting.id);
            }
        }
    }
}

// ── GET /api/super/chains ─────────────────────────────────────────────────────
router.get('/chains', superAuth, (req, res) => {
    const chains = superDb.prepare(`
        SELECT tc.*, COUNT(cm.id) as member_count
        FROM tenant_chains tc
        LEFT JOIN chain_members cm ON cm.chain_id = tc.id
        GROUP BY tc.id ORDER BY tc.created_at DESC
    `).all();

    const result = chains.map(chain => {
        const members = superDb.prepare(`
            SELECT cm.tenant_slug, w.name as workshop_name
            FROM chain_members cm
            LEFT JOIN workshops w ON w.slug = cm.tenant_slug
            WHERE cm.chain_id = ?
        `).all(chain.id);
        const users = superDb.prepare(
            'SELECT id, name, email, can_see_financials FROM chain_users WHERE chain_id = ?'
        ).all(chain.id);
        return { ...chain, members, users };
    });
    res.json(result);
});

// ── POST /api/super/chains ────────────────────────────────────────────────────
router.post('/chains', superAuth, (req, res) => {
    const { name, slug, visibility_level = 'summary', tenant_slugs = [] } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug required' });

    try {
        const result = superDb.prepare(
            'INSERT INTO tenant_chains (name, slug, visibility_level) VALUES (?,?,?)'
        ).run(name, slug, visibility_level);
        const chainId = result.lastInsertRowid;

        for (const ts of tenant_slugs) {
            superDb.prepare('INSERT OR IGNORE INTO chain_members (chain_id, tenant_slug) VALUES (?,?)').run(chainId, ts);
            superDb.prepare('UPDATE workshops SET chain_id = ? WHERE slug = ?').run(chainId, ts);
        }
        res.json({ id: chainId, name, slug });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// ── PATCH /api/super/chains/:id ───────────────────────────────────────────────
router.patch('/chains/:id', superAuth, (req, res) => {
    const { name, visibility_level } = req.body;
    if (name) superDb.prepare('UPDATE tenant_chains SET name = ? WHERE id = ?').run(name, req.params.id);
    if (visibility_level) superDb.prepare('UPDATE tenant_chains SET visibility_level = ? WHERE id = ?').run(visibility_level, req.params.id);
    res.json({ message: 'Updated' });
});

// ── POST /api/super/chains/:id/members ───────────────────────────────────────
router.post('/chains/:id/members', superAuth, (req, res) => {
    const { tenant_slug } = req.body;
    if (!tenant_slug) return res.status(400).json({ message: 'tenant_slug required' });

    try {
        superDb.prepare('INSERT OR IGNORE INTO chain_members (chain_id, tenant_slug) VALUES (?,?)')
            .run(req.params.id, tenant_slug);
        superDb.prepare('UPDATE workshops SET chain_id = ? WHERE slug = ?')
            .run(req.params.id, tenant_slug);

        // Merge clientes/vehículos existentes en segundo plano
        setImmediate(() => {
            try {
                mergeTenantsOnCouple(parseInt(req.params.id), tenant_slug);
                console.log(`[chain] Merge completed for ${tenant_slug} into chain ${req.params.id}`);
            } catch (e) {
                console.error(`[chain] Merge error for ${tenant_slug}:`, e.message);
            }
        });

        res.json({ message: 'Member added, sync in progress' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// ── POST /api/super/chains/:id/resync ────────────────────────────────────────
router.post('/chains/:id/resync', superAuth, (req, res) => {
    const chain = superDb.prepare('SELECT * FROM tenant_chains WHERE id = ?').get(req.params.id);
    if (!chain) return res.status(404).json({ message: 'Chain not found' });

    const members = superDb.prepare('SELECT tenant_slug FROM chain_members WHERE chain_id = ?')
        .all(req.params.id);

    res.json({ message: 'Resync started', members: members.length });

    setImmediate(() => {
        for (const { tenant_slug } of members) {
            try {
                mergeTenantsOnCouple(parseInt(req.params.id), tenant_slug);
            } catch (e) {
                console.error(`[resync] Error for ${tenant_slug}:`, e.message);
            }
        }
        console.log(`[chain] Full resync completed for chain ${req.params.id}`);
    });
});

// ── POST /api/super/chains/:id/resync-debug ──────────────────────────────────
router.post('/chains/:id/resync-debug', superAuth, (req, res) => {
    const { getDb } = require('../tenantManager');
    const { randomUUID } = require('crypto');
    const chainId = parseInt(req.params.id);
    const chain = superDb.prepare('SELECT * FROM tenant_chains WHERE id = ?').get(chainId);
    if (!chain) return res.status(404).json({ message: 'Chain not found' });

    const members = superDb.prepare('SELECT tenant_slug FROM chain_members WHERE chain_id = ?').all(chainId);
    const slugs = members.map(m => m.tenant_slug);

    const report = {
        chain: chain.name,
        members: slugs,
        total_inserted: 0,
        total_skipped: 0,
        total_errors: 0,
        pairs: []
    };

    for (const sourceSlug of slugs) {
        for (const targetSlug of slugs) {
            if (sourceSlug === targetSlug) continue;

            const pairReport = {
                from: sourceSlug,
                to: targetSlug,
                clients_total_in_source: 0,
                clients_inserted: 0,
                clients_skipped: 0,
                clients_errors: [],
                vehicles_total_in_source: 0,
                vehicles_inserted: 0,
                vehicles_skipped: 0,
                vehicles_errors: []
            };

            try {
                const sourceDb = getDb(sourceSlug);
                const targetDb = getDb(targetSlug);

                // Backfill source data if identity is missing
                const incompleteClients = sourceDb.prepare('SELECT id, uuid, source_tenant FROM clients WHERE uuid IS NULL OR source_tenant IS NULL').all();
                for (const c of incompleteClients) {
                    sourceDb.prepare('UPDATE clients SET uuid = ?, source_tenant = ? WHERE id = ?')
                        .run(c.uuid || randomUUID(), c.source_tenant || sourceSlug, c.id);
                }
                const incompleteVehicles = sourceDb.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE uuid IS NULL OR source_tenant IS NULL').all();
                for (const v of incompleteVehicles) {
                    sourceDb.prepare('UPDATE vehicles SET uuid = ?, source_tenant = ? WHERE id = ?')
                        .run(v.uuid || randomUUID(), v.source_tenant || sourceSlug, v.id);
                }

                // Sync Clients
                const sourceClients = sourceDb.prepare('SELECT * FROM clients WHERE uuid IS NOT NULL').all();
                pairReport.clients_total_in_source = sourceClients.length;

                for (const client of sourceClients) {
                    const inTarget = targetDb.prepare('SELECT id FROM clients WHERE uuid = ?').get(client.uuid)
                        || (client.email ? targetDb.prepare('SELECT id FROM clients WHERE email = ? AND email != \'\'').get(client.email) : null);

                    if (!inTarget) {
                        try {
                            targetDb.prepare(`
                                INSERT INTO clients (uuid, first_name, last_name, nickname, phone, email, address, notes, source_tenant, created_at)
                                VALUES (?,?,?,?,?,?,?,?,?,?)
                            `).run(client.uuid, client.first_name, client.last_name, client.nickname, client.phone, client.email, client.address, client.notes, client.source_tenant, client.created_at);
                            pairReport.clients_inserted++;
                            report.total_inserted++;
                        } catch (e) {
                            pairReport.clients_errors.push(`${client.first_name} ${client.last_name}: ${e.message}`);
                        }
                    } else {
                        pairReport.clients_skipped++;
                        report.total_skipped++;
                    }
                }

                // Sync Vehicles
                const sourceVehicles = sourceDb.prepare(`
                    SELECT v.*, c.uuid as client_uuid
                    FROM vehicles v
                    JOIN clients c ON v.client_id = c.id
                    WHERE v.uuid IS NOT NULL
                `).all();
                pairReport.vehicles_total_in_source = sourceVehicles.length;

                for (const vehicle of sourceVehicles) {
                    const clientInTarget = targetDb.prepare('SELECT id FROM clients WHERE uuid = ?').get(vehicle.client_uuid);
                    if (!clientInTarget) {
                        pairReport.vehicles_errors.push(`Plate ${vehicle.plate}: Client ${vehicle.client_uuid} not found in target`);
                        continue;
                    }

                    const inTarget = targetDb.prepare('SELECT id FROM vehicles WHERE uuid = ?').get(vehicle.uuid)
                        || targetDb.prepare('SELECT id FROM vehicles WHERE plate = ?').get(vehicle.plate);

                    if (!inTarget) {
                        try {
                            targetDb.prepare(`
                                INSERT INTO vehicles (uuid, client_id, plate, brand, model, version, year, km, source_tenant, created_at)
                                VALUES (?,?,?,?,?,?,?,?,?,?)
                            `).run(vehicle.uuid, clientInTarget.id, vehicle.plate, vehicle.brand, vehicle.model, vehicle.version, vehicle.year, vehicle.km, vehicle.source_tenant, vehicle.created_at);
                            pairReport.vehicles_inserted++;
                            report.total_inserted++;
                        } catch (e) {
                            pairReport.vehicles_errors.push(`Plate ${vehicle.plate}: ${e.message}`);
                        }
                    } else {
                        pairReport.vehicles_skipped++;
                        report.total_skipped++;
                    }
                }
            } catch (fatal) {
                pairReport.clients_errors.push(`FATAL PAIR ERROR: ${fatal.message}`);
            }

            report.total_errors += pairReport.clients_errors.length + pairReport.vehicles_errors.length;
            report.pairs.push(pairReport);
        }
    }

    res.json(report);
});

// ── DELETE /api/super/chains/:id/members/:slug ────────────────────────────────
// Decouple a tenant from the chain — apply retention rules
router.delete('/chains/:id/members/:slug', superAuth, (req, res) => {
    const { id, slug } = req.params;
    const { preview } = req.query;

    try {
        const db = getDb(slug);
        const chain = superDb.prepare('SELECT * FROM tenant_chains WHERE id = ?').get(id);
        if (!chain) return res.status(404).json({ message: 'Chain not found' });

        // Clients to KEEP: source_tenant = this slug OR has orders here
        const toKeep = db.prepare(`
            SELECT DISTINCT c.id, c.uuid, c.first_name, c.last_name, c.source_tenant,
                COUNT(o.id) as local_orders
            FROM clients c
            LEFT JOIN orders o ON o.client_id = c.id
            WHERE c.source_tenant = ? OR o.id IS NOT NULL
            GROUP BY c.id
        `).all(slug);

        // Clients to LOSE: foreign clients with no local orders
        const toLose = db.prepare(`
            SELECT c.id, c.uuid, c.first_name, c.last_name, c.source_tenant
            FROM clients c
            WHERE c.source_tenant != ? AND c.source_tenant IS NOT NULL
              AND c.id NOT IN (SELECT client_id FROM orders)
        `).all(slug);

        if (preview === 'true') {
            return res.json({
                to_keep: toKeep.length, to_lose: toLose.length,
                preview_keep: toKeep.slice(0, 5), preview_lose: toLose.slice(0, 5)
            });
        }

        // Execute decoupling
        for (const client of toLose) {
            db.prepare('DELETE FROM clients WHERE id = ?').run(client.id);
        }

        // Clear source_tenant on kept clients that originated here (they're fully local now)
        db.prepare("UPDATE clients SET source_tenant = NULL WHERE source_tenant = ?").run(slug);

        // Remove from chain
        superDb.prepare('DELETE FROM chain_members WHERE chain_id = ? AND tenant_slug = ?').run(id, slug);
        superDb.prepare('UPDATE workshops SET chain_id = NULL WHERE slug = ?').run(slug);

        // Cancel pending sync jobs for this tenant
        superDb.prepare(`UPDATE sync_queue SET status='cancelled' WHERE (source_slug=? OR target_slug=?) AND status='pending'`).run(slug, slug);

        res.json({ message: 'Decoupled', kept: toKeep.length, removed: toLose.length });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// ── POST /api/super/chains/:id/users ─────────────────────────────────────────
router.post('/chains/:id/users', superAuth, (req, res) => {
    const { name, email, password, can_see_financials = 0 } = req.body;
    const hash = require('bcrypt').hashSync(password, 10);
    try {
        const result = superDb.prepare(
            'INSERT INTO chain_users (chain_id, name, email, password, can_see_financials) VALUES (?,?,?,?,?)'
        ).run(req.params.id, name, email, hash, can_see_financials ? 1 : 0);
        res.json({ id: result.lastInsertRowid, name, email });
    } catch (e) {
        res.status(400).json({ message: 'Email already exists in this chain' });
    }
});

// ── DELETE /api/super/chains/:id/users/:userId ────────────────────────────────
router.delete('/chains/:id/users/:userId', superAuth, (req, res) => {
    superDb.prepare('DELETE FROM chain_users WHERE id = ? AND chain_id = ?').run(req.params.userId, req.params.id);
    res.json({ message: 'User deleted' });
});

// ── GET /api/super/chains/:id/sync-status ────────────────────────────────────
router.get('/chains/:id/sync-status', superAuth, (req, res) => {
    try {
        const pending = superDb.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE chain_id=? AND status='pending'").get(req.params.id);
        const failed = superDb.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE chain_id=? AND status='failed'").get(req.params.id);
        const done = superDb.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE chain_id=? AND status='done' AND processed_at > date('now', '-1 day')").get(req.params.id);
        const recentErrors = superDb.prepare(`
            SELECT * FROM sync_queue
            WHERE chain_id=? AND status='failed'
            ORDER BY created_at DESC LIMIT 10
        `).all(req.params.id);

        res.json({
            pending: pending.c,
            failed: failed.c,
            done_today: done.c,
            recent_errors: recentErrors
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
