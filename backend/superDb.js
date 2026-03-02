const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.resolve(DATA_DIR, 'super.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// 1. Initial Tables (Minimal set)
db.exec(`
    CREATE TABLE IF NOT EXISTS super_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        language TEXT DEFAULT 'es',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workshops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS global_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS system_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        super_user_id INTEGER,
        super_user_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (super_user_id) REFERENCES super_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workshop_slug TEXT NOT NULL,
        workshop_name TEXT NOT NULL,
        user_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        reply TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        visibility_level TEXT DEFAULT 'summary',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chain_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        tenant_slug TEXT NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chain_id) REFERENCES tenant_chains(id) ON DELETE CASCADE,
        UNIQUE(chain_id, tenant_slug)
    );

    CREATE TABLE IF NOT EXISTS chain_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        can_see_financials INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chain_id) REFERENCES tenant_chains(id) ON DELETE CASCADE,
        UNIQUE(chain_id, email)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        source_slug TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        FOREIGN KEY (chain_id) REFERENCES tenant_chains(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        requesting_slug TEXT NOT NULL,
        requesting_user_name TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        item_name TEXT NOT NULL,
        sku TEXT,
        quantity REAL NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'delivered'
        response_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        delivered_at DATETIME,
        FOREIGN KEY (chain_id) REFERENCES tenant_chains(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chain_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        from_slug TEXT NOT NULL,
        from_user_name TEXT NOT NULL,
        to_slug TEXT,          -- NULL = broadcast a toda la cadena
        message TEXT NOT NULL,
        linked_request_id INTEGER,   -- FK a stock_requests si el mensaje es parte de un pedido
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chain_id) REFERENCES tenant_chains(id) ON DELETE CASCADE,
        FOREIGN KEY (linked_request_id) REFERENCES stock_requests(id) ON DELETE SET NULL
    );
`);

// 2. Incremental Migrations
function addColumn(table, column, type) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`[super] Migration: Added column ${column} to ${table}`);
    } catch (e) {
        // Ignore duplicate column errors
    }
}

addColumn('workshops', 'status', "TEXT DEFAULT 'active'");
addColumn('workshops', 'api_token', 'TEXT');
addColumn('workshops', 'logo_path', 'TEXT');
addColumn('workshops', 'environment', "TEXT DEFAULT 'prod'");
addColumn('workshops', 'enabled_modules', "TEXT DEFAULT '[\"dashboard\", \"clients\", \"vehicles\", \"orders\", \"income\", \"settings\", \"users\", \"roles\", \"reminders\", \"appointments\", \"suppliers\", \"audit\"]'");
addColumn('super_users', 'last_activity', 'DATETIME');
addColumn('super_users', 'language', "TEXT DEFAULT 'es'");
addColumn('workshops', 'chain_id', 'INTEGER');

// Initial global settings for timeouts
function ensureSetting(key, defaultValue) {
    const exists = db.prepare("SELECT key FROM global_settings WHERE key = ?").get(key);
    if (!exists) {
        db.prepare("INSERT INTO global_settings (key, value) VALUES (?, ?)").run(key, defaultValue);
    }
}
ensureSetting('user_session_timeout', '60');
ensureSetting('superadmin_session_timeout', '120');

// Ensure unique index for token
try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_workshops_api_token ON workshops(api_token)");
} catch (e) { }

// Seed Superuser
try {
    const existing = db.prepare("SELECT id FROM super_users WHERE username = 'superuser'").get();
    if (!existing) {
        const hashed = bcrypt.hashSync('jorge', 10);
        db.prepare("INSERT INTO super_users (username, password) VALUES ('superuser', ?)").run(hashed);
        console.log('[super] Seeded superuser: superuser / jorge');
    }
} catch (e) {
    console.error("[super] Error seeding superuser:", e.message);
}

// Ensure English categories in enabled_modules
try {
    const workshops = db.prepare('SELECT id, slug, enabled_modules FROM workshops').all();
    const reverseMapping = {
        'clientes': 'clients',
        'vehiculos': 'vehicles',
        'ordenes': 'orders',
        'ingresos': 'income',
        'configuracion': 'settings',
        'usuarios': 'users',
        'roles': 'roles',
        'recordatorios': 'reminders',
        'turnos': 'appointments',
        'proveedores': 'suppliers',
        'auditoria': 'audit'
    };

    workshops.forEach(w => {
        if (!w.enabled_modules) return;
        let modules = [];
        try { modules = JSON.parse(w.enabled_modules || '[]'); } catch (e) { return; }

        let migrated = false;
        let fixedModules = modules.map(m => {
            if (reverseMapping[m]) {
                migrated = true;
                return reverseMapping[m];
            }
            return m;
        });

        if (migrated) {
            const finalModules = Array.from(new Set(fixedModules));
            db.prepare('UPDATE workshops SET enabled_modules = ? WHERE id = ?').run(JSON.stringify(finalModules), w.id);
            console.log(`[super] Refactored workshop '${w.slug}' modules to English`);
        }
    });
} catch (e) { }

db.generateApiToken = () => crypto.randomBytes(32).toString('hex');

module.exports = db;
