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
        entity_type TEXT, -- 'workshop', 'settings', etc.
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (super_user_id) REFERENCES super_users(id) ON DELETE SET NULL
    );
`);

// 2. Incremental Migrations
function addColumn(table, column, type) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`[super] Migration: Added column ${column} to ${table}`);
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            // Already exists
        } else {
            console.error(`[super] Migration error adding ${column} to ${table}:`, e.message);
        }
    }
}

addColumn('workshops', 'status', "TEXT DEFAULT 'active'");
addColumn('workshops', 'api_token', 'TEXT');
addColumn('workshops', 'logo_path', 'TEXT');
addColumn('workshops', 'environment', "TEXT DEFAULT 'prod'");
addColumn('workshops', 'enabled_modules', "TEXT DEFAULT '[\"dashboard\", \"clientes\", \"vehiculos\", \"ordenes\", \"ingresos\", \"configuracion\", \"usuarios\", \"roles\", \"recordatorios\", \"turnos\", \"proveedores\"]'");

// Ensure unique index for token
try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_workshops_api_token ON workshops(api_token)");
} catch (e) {
    // If there were duplicate nulls, this might fail, but since it's a new migration it should be fine
}

// 3. Ensure all workshops have tokens
try {
    const workshopsWithoutTokens = db.prepare("SELECT slug FROM workshops WHERE api_token IS NULL").all();
    workshopsWithoutTokens.forEach(w => {
        const token = crypto.randomBytes(32).toString('hex');
        db.prepare("UPDATE workshops SET api_token = ? WHERE slug = ?").run(token, w.slug);
        console.log(`[super] Generated missing token for: ${w.slug}`);
    });
} catch (e) {
    console.error("[super] Error generating tokens:", e.message);
}

// 4. Seed Settings
const seedSetting = (key, value) => {
    try {
        const exists = db.prepare("SELECT key FROM global_settings WHERE key = ?").get(key);
        if (!exists) {
            db.prepare("INSERT INTO global_settings (key, value) VALUES (?, ?)").run(key, value);
        }
    } catch (e) {
        console.error(`[super] Error seeding setting ${key}:`, e.message);
    }
};

seedSetting('product_name', 'MechHub');
seedSetting('maintenance_mode', 'false');
seedSetting('allow_new_registrations', 'true');
seedSetting('support_email', 'soporte@surforge.com');
seedSetting('system_currency', '$');
seedSetting('system_announcement', '');
seedSetting('superadmin_theme', 'default');
seedSetting('backup_enabled', 'false');
seedSetting('backup_frequency', 'daily');
seedSetting('backup_retention', '7');

// 5. Seed Superuser
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

// --- DATA MIGRATION: Normalize workshops' enabled_modules to Spanish ---
try {
    const workshops = db.prepare('SELECT id, slug, enabled_modules FROM workshops').all();
    const mapping = {
        'inventory': ['clientes', 'vehiculos'],
        'appointments': ['turnos'],
        'income': ['ingresos'],
        'reports': ['recordatorios'],
        'settings': ['configuracion', 'usuarios', 'roles'],
        'clients': ['clientes'],
        'vehicles': ['vehiculos'],
        'orders': ['ordenes'],
        'reminders': ['recordatorios'],
        'suppliers': ['proveedores']
    };

    workshops.forEach(w => {
        if (!w.enabled_modules) return;
        let modules = [];
        try {
            modules = JSON.parse(w.enabled_modules || '[]');
        } catch (e) {
            return;
        }

        let migrated = false;
        let newModules = [];

        // Add 'dashboard' if missing
        if (!modules.includes('dashboard')) {
            modules.push('dashboard');
            migrated = true;
        }

        modules.forEach(m => {
            if (mapping[m]) {
                newModules.push(...mapping[m]);
                migrated = true;
            } else if (!newModules.includes(m)) {
                newModules.push(m);
            }
        });

        // Extra check: if 'configuracion' is enabled, ensure 'usuarios' and 'roles' are too
        if (newModules.includes('configuracion')) {
            if (!newModules.includes('usuarios')) { newModules.push('usuarios'); migrated = true; }
            if (!newModules.includes('roles')) { newModules.push('roles'); migrated = true; }
        }

        if (migrated) {
            const finalModules = Array.from(new Set(newModules));
            db.prepare('UPDATE workshops SET enabled_modules = ? WHERE id = ?').run(JSON.stringify(finalModules), w.id);
            console.log(`[super] Migrated workshop '${w.slug}' enabled_modules to Spanish`);
        }
    });
} catch (e) {
    console.error(`[super] Error migrating workshops enabled_modules:`, e.message);
}

db.generateApiToken = () => crypto.randomBytes(32).toString('hex');

module.exports = db;
