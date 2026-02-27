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
        if (decoded.role !== 'superusuario' && decoded.role !== 'superuser') return res.status(403).json({ message: 'Acceso restringido a superadministradores' });
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
            { id: user.id, username: user.username, role: 'superusuario' },
            secret,
            { expiresIn: '12h' }
        );

        logSystemActivity(user, 'LOGIN', 'auth', user.id, 'Superadmin logged in', req);

        res.json({ token, user: { id: user.id, username: user.username, role: 'superusuario' } });
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
    try {
        const workshop = superDb.prepare('SELECT environment FROM workshops WHERE slug = ?').get(slug);
        if (workshop?.environment !== 'dev') {
            return res.status(403).json({ message: 'Esta operación solo está permitida en modo Desarrollo' });
        }

        const db = getDb(slug);
        const { seedWorkshop } = require('../utils/seeder');
        seedWorkshop(db);
        logSystemActivity(req.superUser, 'SEED_WORKSHOP', 'workshop', slug, 'Inserted test data (development mode)', req);
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
        logSystemActivity(req.superUser, 'CLEAR_WORKSHOP', 'workshop', slug, 'Database wiped (development mode)', req);
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

    const token = jwt.sign(
        { id: 0, username: `superuser@${slug}`, role: 'superuser', permissions: enabledModules, slug, isSuperuser: true },
        secret,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: { id: 0, username: `superuser@${slug}`, role: 'superuser', permissions: finalPermissions, isSuperuser: true, slug }
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

                if (lastActivity < thirtyDaysAgo) {
                    anomalies.push({
                        slug: w.slug,
                        name: w.name,
                        type: 'inactivity',
                        severity: 'warning',
                        message: 'Sin actividad en más de 30 días',
                        last_seen: lastActivity.toISOString()
                    });
                }

                // 2. Check Storage (Individual Tenant)
                const dbPath = path.resolve(__dirname, `../tenants/${w.slug}/taller.db`);
                if (fs.existsSync(dbPath)) {
                    const size = fs.statSync(dbPath).size;
                    const sizeMB = size / 1024 / 1024;
                    if (sizeMB > 50) { // Alert if > 50MB
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

module.exports = router;
