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
            role_id INTEGER,
            client_id INTEGER,
            role TEXT,
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
            theme_id TEXT DEFAULT 'default'
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
            year INTEGER,
            km INTEGER,
            image_path TEXT,
            photos TEXT,
            status TEXT CHECK(status IN ('Activo', 'Inactivo')) DEFAULT 'Activo',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS service_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            base_price REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('Pendiente', 'En proceso', 'Presupuestado', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado')) DEFAULT 'Pendiente',
            payment_status TEXT DEFAULT 'sin_cobrar',
            payment_amount REAL DEFAULT 0,
            photos TEXT,
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
            include_pdf INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
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
    `);

    // Clean up seeding
    const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'Admin'").get();
    if (!adminRole) {
        db.prepare("INSERT INTO roles (name, permissions) VALUES ('Admin', ?)").run(
            JSON.stringify(['dashboard', 'clients', 'vehicles', 'orders', 'income', 'settings', 'manage_users', 'manage_roles'])
        );
        db.prepare("INSERT INTO roles (name, permissions) VALUES ('Mecánico', ?)").run(
            JSON.stringify(['dashboard', 'clients', 'vehicles', 'orders'])
        );
    }

    const adminRoleId = db.prepare("SELECT id FROM roles WHERE name = 'Admin'").get()?.id;
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (!admin && adminRoleId) {
        const hashed = bcrypt.hashSync('admin123', 10);
        db.prepare("INSERT INTO users (username, password, role_id, role) VALUES (?, ?, ?, 'admin')").run('admin', hashed, adminRoleId);
        console.log(`[${slug}] Seeded admin user: admin / admin123`);
    }

    // Incremental Migrations
    const addColumn = (table, column, type) => {
        try {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
            console.log(`[tenant:${slug}] Migration: Added ${column} to ${table}`);
        } catch (e) {
            // Ignore if column exists
        }
    };
    addColumn('config', 'theme_id', "TEXT DEFAULT 'default'");
    addColumn('vehicles', 'image_path', "TEXT");
    addColumn('orders', 'created_by_id', "INTEGER");
    addColumn('orders', 'modified_by_id', "INTEGER");
    addColumn('order_history', 'user_id', "INTEGER");

    const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
    if (configCount === 0) {
        db.prepare(`
            INSERT INTO config(workshop_name, footer_text, address, phone, email, whatsapp, business_hours)
            VALUES(?, 'Powered by SurForge', '-', '-', '-', '-', ?)
        `).run(slug, JSON.stringify({ mon_fri: '09:00 - 18:00', sat: '09:00 - 13:00', sun: 'Cerrado' }));
    }
}

/**
 * Returns a cached DB instance for the given slug.
 * Creates the tenant directory and DB if it doesn't exist.
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
    superDb.prepare("INSERT OR IGNORE INTO workshops (slug, name, api_token) VALUES (?, ?, ?)").run(slug, name || slug, apiToken);

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

module.exports = { getDb, createTenant, listTenants, tenantExists, getTenantDir, getTenantUploads, initTenantDb, deleteTenant };
