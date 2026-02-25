const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve tenant uploads: /uploads/:slug/site/logo.png
// Internal structure: [DATA_DIR]/tenants/:slug/uploads/site/logo.png
const { getTenantDir } = require('./tenantManager');
app.use('/uploads/:slug', (req, res, next) => {
    const slug = req.params.slug;
    express.static(path.join(getTenantDir(slug), 'uploads'))(req, res, next);
});

// ─── Super admin routes (no tenant middleware) ────────────────────────────────
app.use('/api/super', require('./routes/super'));

// ─── Tenant middleware ────────────────────────────────────────────────────────
const tenantMiddleware = require('./middleware/tenant');

// ─── All tenant routes mounted under /api/:slug/ ─────────────────────────────
// Build a single tenant router
const tenantRouter = express.Router({ mergeParams: true });

tenantRouter.use('/auth', require('./routes/auth'));
tenantRouter.use('/clients', require('./routes/clients'));
tenantRouter.use('/orders', require('./routes/orders'));
tenantRouter.use('/reports', require('./routes/reports'));
tenantRouter.use('/config', require('./routes/config'));
tenantRouter.use('/services', require('./routes/services'));
tenantRouter.use('/templates', require('./routes/templates'));
tenantRouter.use('/client', require('./routes/client'));
tenantRouter.use('/users', require('./routes/users'));
tenantRouter.use('/roles', require('./routes/roles'));
tenantRouter.use('/public/order', require('./routes/public_order'));
tenantRouter.use('/', require('./routes/api'));

// ─── Public System Info ──────────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
    try {
        const superDb = require('./superDb');
        const settings = superDb.prepare("SELECT * FROM global_settings").all();
        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        // Also list of active workshops (slug + name only) for public selector if needed
        const workshops = superDb.prepare("SELECT slug, name, logo_path FROM workshops WHERE status = 'active'").all();

        res.json({
            ...config,
            workshops
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching system info' });
    }
});

// Mount tenant router
app.use('/api/:slug', tenantMiddleware, tenantRouter);

// ─── Scheduled Tasks (Cron) ──────────────────────────────────────────────────
const { processReminders } = require('./cron/daily_reminders');
const cron = require('node-cron');

// Correr al minuto 0 de cada hora (exactamente en punto)
cron.schedule('0 * * * *', processReminders);

// Correr también 10 segundos después del inicio del servidor para no perder notificaciones atrasadas.
setTimeout(processReminders, 10000);

// Manual trigger for superadmin
app.post('/api/super/trigger-reminders', (req, res) => {
    processReminders();
    res.json({ message: 'Proceso de recordatorios iniciado' });
});

// ─── Startup: Ensure at least one workshop exists or initialize existing ones ──
const { createTenant, listTenants, getDb } = require('./tenantManager');

(async () => {
    try {
        const workshops = listTenants();
        if (workshops.length === 0) {
            console.log('[startup] No workshops found, creating default "demo"...');
            createTenant('demo', 'Taller Demo');
        } else {
            // Ensure all registered workshops have their DB schemas ready
            workshops.forEach(w => {
                try { getDb(w.slug); } catch (e) { console.error(`[startup] Error loading ${w.slug}:`, e.message); }
            });
            console.log(`[startup] ${workshops.length} workshops ready`);
        }
    } catch (err) {
        console.error('[startup] Error initializing workshops:', err);
    }
})();

app.get('/', (req, res) => {
    res.json({ status: 'MechHub Multi-Tenant API', version: '2.0' });
});

app.listen(port, () => {
    console.log(`MechHub running on port ${port}`);
    console.log(`Superuser login: POST /api/super/login`);
    console.log(`Tenant API: /api/:slug/...`);
});
