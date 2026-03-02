const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const TENANTS_DIR = path.join(process.env.DATA_DIR || __dirname, 'tenants');

// Cache of DB instances per slug
const dbCache = {};

/**
 * Returns the absolute path to a tenant's root folder.
 */
function getTenantDir(slug) {
    return path.join(TENANTS_DIR, slug);
}

/**
 * Returns the absolute path to the tenant's database file.
 */
function getTenantDbPath(slug) {
    return path.join(getTenantDir(slug), 'db.sqlite');
}

/**
 * Returns upload subdirectory paths for a tenant.
 */
function getTenantUploads(slug) {
    const base = path.join(getTenantDir(slug), 'uploads');
    return {
        base,
        site: path.join(base, 'site'),       // logos, banners, etc.
        vehicles: path.join(base, 'vehicles'), // vehicle photos
        orders: path.join(base, 'orders'),     // order attachments
    };
}

/**
 * Initializes all tables for a tenant DB (exact clone of former db.js schema).
 */
function initTenantDb(db, slug) {
    db.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            permissions TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            language TEXT DEFAULT 'es',
            role_id INTEGER,
            client_id INTEGER,
            role TEXT,
            last_activity DATETIME,
            FOREIGN KEY (role_id) REFERENCES roles(id),
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workshop_name TEXT NOT NULL,
            logo_path TEXT,
            footer_text TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            whatsapp TEXT,
            instagram TEXT,
            business_hours TEXT,
            tax_percentage REAL DEFAULT 21.0,
            income_include_parts INTEGER DEFAULT 1,
            parts_profit_percentage REAL DEFAULT 100.0,
            smtp_host TEXT,
            smtp_port INTEGER,
            smtp_user TEXT,
            smtp_pass TEXT,
            imap_host TEXT,
            imap_port INTEGER,
            imap_user TEXT,
            imap_pass TEXT,
            imap_enabled INTEGER DEFAULT 0,
            theme_id TEXT DEFAULT 'default',
            reminder_enabled INTEGER DEFAULT 1,
            reminder_time TEXT DEFAULT '09:00',
            messages_enabled INTEGER DEFAULT 1,
            client_portal_language TEXT DEFAULT 'es',
            enabled_modules TEXT DEFAULT '["clients", "vehicles", "orders", "income", "reports", "settings", "dashboard", "reminders", "appointments"]'
        );

        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            nickname TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            notes TEXT,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            plate TEXT UNIQUE NOT NULL,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            version TEXT,
            year INTEGER,
            km INTEGER,
            image_path TEXT,
            photos TEXT,
            status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vehicle_reference (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            version TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(brand, model, version)
        );

        CREATE TABLE IF NOT EXISTS service_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            base_price REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS service_price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id INTEGER NOT NULL,
            old_price REAL,
            new_price REAL NOT NULL,
            changed_by_id INTEGER,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE CASCADE,
            FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'unpaid',
            payment_amount REAL DEFAULT 0,
            photos TEXT,
            share_token TEXT,
            reminder_at DATETIME,
            delivered_at DATETIME,
            reminder_days INTEGER,
            reminder_status TEXT DEFAULT 'pending',
            reminder_sent_at DATETIME,
            appointment_date DATETIME,
            created_by_id INTEGER,
            modified_by_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
            FOREIGN KEY (created_by_id) REFERENCES users(id),
            FOREIGN KEY (modified_by_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            service_id INTEGER,
            description TEXT NOT NULL,
            labor_price REAL DEFAULT 0,
            parts_price REAL DEFAULT 0,
            parts_profit REAL DEFAULT 0,
            subtotal REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            items TEXT NOT NULL,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            trigger_status TEXT,
            include_pdf INTEGER DEFAULT 0,
            send_whatsapp INTEGER DEFAULT 0,
            send_email INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            reply_to TEXT,
            is_read INTEGER DEFAULT 0,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS vehicle_km_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            km INTEGER NOT NULL,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS service_intervals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            service_description TEXT NOT NULL,
            last_done_at DATETIME,
            last_done_km INTEGER,
            avg_km_interval INTEGER,
            avg_day_interval INTEGER,
            predicted_next_date DATE,
            predicted_next_km INTEGER,
            confidence INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_service_intervals_unique
        ON service_intervals(vehicle_id, service_description);

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS part_inquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            supplier_ids TEXT NOT NULL,
            part_description TEXT NOT NULL,
            vehicle_info TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT DEFAULT 'info',
            message TEXT NOT NULL,
            stack_trace TEXT,
            path TEXT,
            method TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_name TEXT,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS stock_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT,
            name TEXT NOT NULL,
            category TEXT,
            quantity REAL DEFAULT 0,
            min_quantity REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            supplier_id INTEGER,
            location TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            type TEXT NOT NULL,  -- 'in' | 'out' | 'adjustment' | 'transfer_out' | 'transfer_in'
            quantity REAL NOT NULL,
            order_id INTEGER,
            notes TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS chain_sync_meta (
            entity_type TEXT NOT NULL,
            entity_uuid TEXT NOT NULL,
            source_tenant TEXT NOT NULL,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (entity_type, entity_uuid)
        );
    `);

    // Incremental Migrations Helper
    const addColumn = (table, column, type) => {
        try {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
            console.log(`[tenant:${slug}] Migration: Added ${column} to ${table}`);
        } catch (e) { }
    };

    // Ensure columns exist (for manual migrations on existing dbs)
    addColumn('users', 'language', "TEXT DEFAULT 'es'");
    addColumn('users', 'last_activity', "DATETIME");
    addColumn('config', 'enabled_modules', "TEXT");
    addColumn('config', 'theme_id', "TEXT DEFAULT 'default'");
    addColumn('config', 'client_portal_language', "TEXT DEFAULT 'es'");
    addColumn('orders', 'appointment_date', "DATETIME");
    addColumn('orders', 'payment_status', "TEXT DEFAULT 'unpaid'");
    addColumn('orders', 'status', "TEXT DEFAULT 'pending'");
    addColumn('order_items', 'parts_profit', "REAL DEFAULT 0");
    addColumn('vehicles', 'version', "TEXT");
    addColumn('service_price_history', 'changed_by_id', "INTEGER");

    addColumn('orders', 'budget_approval_status', "TEXT DEFAULT NULL");
    addColumn('orders', 'budget_approval_notes', 'TEXT');
    addColumn('orders', 'budget_approved_at', 'DATETIME');

    addColumn('orders', 'transferred_to_slug', 'TEXT');
    addColumn('orders', 'transferred_to_order_id', 'INTEGER');
    addColumn('orders', 'transferred_from_slug', 'TEXT');
    addColumn('orders', 'transferred_from_order_id', 'INTEGER');

    addColumn('orders', 'uuid', 'TEXT');
    addColumn('clients', 'uuid', 'TEXT');
    addColumn('clients', 'source_tenant', 'TEXT');
    addColumn('vehicles', 'uuid', 'TEXT');
    addColumn('vehicles', 'source_tenant', 'TEXT');

    // Backfill UUIDs and source_tenant for existing records that don't have them
    const { randomUUID } = require('crypto');
    try {
        const ordersWithoutUuid = db.prepare("SELECT id FROM orders WHERE uuid IS NULL").all();
        const updateOrderUuid = db.prepare("UPDATE orders SET uuid = ? WHERE id = ?");
        for (const o of ordersWithoutUuid) updateOrderUuid.run(randomUUID(), o.id);

        const clientsToFix = db.prepare("SELECT id, uuid, source_tenant FROM clients WHERE uuid IS NULL OR source_tenant IS NULL").all();
        const updateClientFix = db.prepare("UPDATE clients SET uuid = ?, source_tenant = ? WHERE id = ?");
        for (const c of clientsToFix) updateClientFix.run(c.uuid || randomUUID(), c.source_tenant || slug, c.id);

        const vehiclesToFix = db.prepare("SELECT id, uuid, source_tenant FROM vehicles WHERE uuid IS NULL OR source_tenant IS NULL").all();
        const updateVehicleFix = db.prepare("UPDATE vehicles SET uuid = ?, source_tenant = ? WHERE id = ?");
        for (const v of vehiclesToFix) updateVehicleFix.run(v.uuid || randomUUID(), v.source_tenant || slug, v.id);
    } catch (e) {
        if (slug !== 'test') console.warn(`[tenant:${slug}] identity backfill error:`, e.message);
    }

    // ── Performance Indexes ──────────────────────────────────────────────────────
    const createIndex = (name, ddl) => {
        try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ${ddl}`); }
        catch (e) { /* already exists */ }
    };

    // orders — las queries más frecuentes del sistema
    createIndex('idx_orders_client_id', 'ON orders(client_id)');
    createIndex('idx_orders_vehicle_id', 'ON orders(vehicle_id)');
    createIndex('idx_orders_status', 'ON orders(status)');
    createIndex('idx_orders_created_at', 'ON orders(created_at DESC)');
    createIndex('idx_orders_appointment', 'ON orders(appointment_date) WHERE appointment_date IS NOT NULL');
    createIndex('idx_orders_payment_status', 'ON orders(payment_status)');
    createIndex('idx_orders_delivered_at', 'ON orders(delivered_at) WHERE delivered_at IS NOT NULL');
    createIndex('idx_orders_status_created', 'ON orders(status, created_at DESC)');

    // order_items — se consultan en cada detalle de orden
    createIndex('idx_order_items_order_id', 'ON order_items(order_id)');
    createIndex('idx_order_items_service_id', 'ON order_items(service_id) WHERE service_id IS NOT NULL');

    // order_history — se consulta en cada listado de órdenes (unread_messages)
    createIndex('idx_order_history_order_id', 'ON order_history(order_id)');
    createIndex('idx_order_history_unread', 'ON order_history(order_id, is_read) WHERE status = "response_received"');

    // clients — búsqueda y login del portal
    createIndex('idx_clients_email', 'ON clients(email) WHERE email IS NOT NULL');
    createIndex('idx_clients_created_at', 'ON clients(created_at DESC)');
    createIndex('idx_clients_uuid', 'ON clients(uuid) WHERE uuid IS NOT NULL');

    // vehicles — lookup frecuente desde órdenes
    createIndex('idx_vehicles_client_id', 'ON vehicles(client_id)');
    createIndex('idx_vehicles_uuid', 'ON vehicles(uuid) WHERE uuid IS NOT NULL');

    // audit_logs — paginación del historial
    createIndex('idx_audit_logs_created_at', 'ON audit_logs(created_at DESC)');
    createIndex('idx_audit_logs_entity', 'ON audit_logs(entity_type, entity_id)');

    // system_logs — filtros del superadmin
    createIndex('idx_system_logs_created_at', 'ON system_logs(created_at DESC)');
    createIndex('idx_system_logs_level', 'ON system_logs(level, created_at DESC)');

    // vehicle_km_history
    createIndex('idx_km_history_vehicle_id', 'ON vehicle_km_history(vehicle_id, recorded_at DESC)');

    // service_intervals
    createIndex('idx_service_intervals_vehicle', 'ON service_intervals(vehicle_id)');

    // stock
    createIndex('idx_stock_items_sku', 'ON stock_items(sku) WHERE sku IS NOT NULL');
    createIndex('idx_stock_movements_item', 'ON stock_movements(item_id, created_at DESC)');

    // Roles Seeding
    const roles = [
        { name: 'Admin', permissions: ['dashboard', 'clients', 'vehicles', 'orders', 'income', 'reports', 'settings', 'users', 'roles', 'reminders', 'appointments', 'suppliers'] },
        { name: 'Technician', permissions: ['dashboard', 'clients', 'vehicles', 'orders', 'reminders', 'appointments'] }
    ];

    roles.forEach(r => {
        const exists = db.prepare("SELECT id FROM roles WHERE name = ?").get(r.name);
        if (!exists) {
            db.prepare("INSERT INTO roles (name, permissions) VALUES (?, ?)").run(r.name, JSON.stringify(r.permissions));
        } else {
            // Update permissions to English keys
            db.prepare("UPDATE roles SET permissions = ? WHERE name = ?").run(JSON.stringify(r.permissions), r.name);
        }
    });

    // Config Seeding
    const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
    if (configCount === 0) {
        db.prepare(`
            INSERT INTO config(workshop_name, footer_text, address, phone, email, whatsapp, business_hours, enabled_modules)
            VALUES(?, 'Powered by SurForge', '-', '-', '-', '-', ?, ?)
        `).run(slug, JSON.stringify({ mon_fri: '09:00 - 18:00', sat: '09:00 - 13:00', sun: 'Closed' }),
            JSON.stringify(['clients', 'vehicles', 'orders', 'income', 'reports', 'settings', 'dashboard', 'reminders', 'appointments']));
    }

    // Default Templates (English Identifiers)
    const templateIds = [
        { name: 'vehicle_reception', trigger: 'pending', desc: 'Recepción de Vehículo' },
        { name: 'budget_review', trigger: 'quoted', desc: 'Presupuesto para Revisión' },
        { name: 'work_in_progress', trigger: 'approved', desc: 'Trabajo en Marcha' },
        { name: 'vehicle_ready', trigger: 'ready', desc: 'Vehículo Listo' },
        { name: 'delivery_thanks', trigger: 'delivered', desc: 'Agradecimiento y Entrega' },
        { name: 'follow_up', trigger: 'reminder', desc: 'Seguimiento Preventivo' },
        { name: 'document_send', trigger: null, desc: 'Envío de Documento' },
        { name: 'appointment_assigned', trigger: 'appointment', desc: 'Turno Asignado' }
    ];

    const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
    if (templateCount === 0) {
        const insertTpl = db.prepare("INSERT INTO templates (name, content, trigger_status, include_pdf) VALUES (?, ?, ?, ?)");
        insertTpl.run('vehicle_reception', 'Hola [apodo], te damos la bienvenida a [taller]. Ya registramos el ingreso de tu [vehiculo]. Podés seguir el progreso aquí: [link]. Orden: #[orden_id].', 'pending', 0);
        insertTpl.run('budget_review', 'Hola [apodo], el presupuesto para tu [vehiculo] ya está disponible. Podés verlo adjunto o en el portal.', 'quoted', 1);
        insertTpl.run('vehicle_ready', '¡Buenas noticias [apodo]! Tu [vehiculo] ya está listo para retirar.', 'ready', 0);
        insertTpl.run('delivery_thanks', 'Gracias por confiar en [taller]. Registramos la entrega de tu [vehiculo] con [km] km.', 'delivered', 1);
        insertTpl.run('appointment_assigned', 'Hola [apodo], tu turno para el [vehiculo] en [taller] fue agendado para el [turno_fecha].', 'appointment', 0);
    }

    // Seed Admin User
    const adminRoleId = db.prepare("SELECT id FROM roles WHERE name = 'Admin'").get()?.id;
    const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (!adminExists && adminRoleId) {
        const hashed = bcrypt.hashSync('admin123', 10);
        db.prepare("INSERT INTO users (username, password, role_id, role) VALUES (?, ?, ?, 'admin')").run('admin', hashed, adminRoleId);
    }

    // Auto-seed vehicle reference data if empty
    try {
        const { seedVehicleReference } = require('./utils/seeder');
        seedVehicleReference(db);
    } catch (e) {
        console.error(`[tenant:${slug}] Failed to auto-seed vehicle references:`, e.message);
    }
}

/**
 * Returns a cached DB instance for the given slug.
 */
function getDb(slug) {
    if (!slug) throw new Error('Tenant slug is required');
    if (dbCache[slug] && !dbCache[slug].closed) return dbCache[slug];

    const tenantDir = getTenantDir(slug);
    const dbPath = getTenantDbPath(slug);

    if (!fs.existsSync(tenantDir)) {
        const uploads = getTenantUploads(slug);
        fs.mkdirSync(tenantDir, { recursive: true });
        fs.mkdirSync(uploads.site, { recursive: true });
        fs.mkdirSync(uploads.vehicles, { recursive: true });
        fs.mkdirSync(uploads.orders, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    initTenantDb(db, slug);

    dbCache[slug] = db;
    return db;
}

/**
 * Creates a new tenant. Registers it in super.db and scaffolds folder + DB.
 */
function createTenant(slug, name) {
    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error('Slug must be lowercase letters, numbers and hyphens only');
    }
    const superDb = require('./superDb');
    const apiToken = superDb.generateApiToken();
    const defaultModules = JSON.stringify(['dashboard', 'clients', 'vehicles', 'orders', 'income', 'reports', 'settings', 'users', 'roles', 'reminders', 'appointments']);
    superDb.prepare("INSERT OR IGNORE INTO workshops (slug, name, api_token, enabled_modules) VALUES (?, ?, ?, ?)").run(slug, name || slug, apiToken, defaultModules);

    getDb(slug);
    console.log(`[tenant] Created tenant: ${slug}`);
    return { slug, name: name || slug };
}

function listTenants() {
    const superDb = require('./superDb');
    return superDb.prepare("SELECT * FROM workshops ORDER BY created_at DESC").all();
}

function tenantExists(slug) {
    return fs.existsSync(getTenantDbPath(slug));
}

/**
 * Deletes a tenant: closes DB, removes folder and deletes from super.db.
 */
function deleteTenant(slug) {
    if (dbCache[slug]) {
        dbCache[slug].close();
        delete dbCache[slug];
        console.log(`[tenant] Closed DB for deletion: ${slug}`);
    }

    const tenantDir = getTenantDir(slug);
    if (fs.existsSync(tenantDir)) {
        fs.rmSync(tenantDir, { recursive: true, force: true });
        console.log(`[tenant] Deleted folder: ${tenantDir}`);
    }

    const superDb = require('./superDb');
    superDb.prepare("DELETE FROM workshops WHERE slug = ?").run(slug);

    return { success: true };
}

function closeDb(slug) {
    if (dbCache[slug]) {
        dbCache[slug].close();
        delete dbCache[slug];
        console.log(`[tenant] Closed DB connection for: ${slug}`);
    }
}

module.exports = { getDb, closeDb, createTenant, listTenants, tenantExists, getTenantDir, getTenantUploads, initTenantDb, deleteTenant };
