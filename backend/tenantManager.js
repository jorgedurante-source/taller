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
            theme_id TEXT DEFAULT 'default',
            reminder_enabled INTEGER DEFAULT 1,
            reminder_time TEXT DEFAULT '09:00',
            enabled_modules TEXT DEFAULT '["inventory", "appointments", "income", "reports", "settings"]'
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
            status TEXT DEFAULT 'Pendiente',
            payment_status TEXT DEFAULT 'sin_cobrar',
            payment_amount REAL DEFAULT 0,
            photos TEXT,
            share_token TEXT,
            reminder_at DATETIME,
            delivered_at DATETIME,
            reminder_days INTEGER,
            reminder_status TEXT DEFAULT 'pending',
            reminder_sent_at DATETIME,
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
    const adminRole = db.prepare("SELECT permissions FROM roles WHERE name = 'Admin'").get();
    if (adminRole) {
        let perms = JSON.parse(adminRole.permissions || '[]');
        let modified = false;
        if (!perms.includes('reminders')) { perms.push('reminders'); modified = true; }
        if (!perms.includes('appointments')) { perms.push('appointments'); modified = true; }

        if (modified) {
            db.prepare("UPDATE roles SET permissions = ? WHERE name = 'Admin'").run(JSON.stringify(perms));
        }
    } else {
        db.prepare("INSERT INTO roles (name, permissions) VALUES ('Admin', ?)").run(
            JSON.stringify(['dashboard', 'clients', 'vehicles', 'orders', 'income', 'settings', 'manage_users', 'manage_roles', 'reminders', 'appointments'])
        );
    }

    const mecanicoRole = db.prepare("SELECT permissions FROM roles WHERE name = 'Mecánico'").get();
    if (mecanicoRole) {
        let perms = JSON.parse(mecanicoRole.permissions || '[]');
        let modified = false;
        if (!perms.includes('reminders')) { perms.push('reminders'); modified = true; }
        if (!perms.includes('appointments')) { perms.push('appointments'); modified = true; }

        if (modified) {
            db.prepare("UPDATE roles SET permissions = ? WHERE name = 'Mecánico'").run(JSON.stringify(perms));
        }
    } else {
        db.prepare("INSERT INTO roles (name, permissions) VALUES ('Mecánico', ?)").run(
            JSON.stringify(['dashboard', 'clients', 'vehicles', 'orders', 'reminders', 'appointments'])
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
    addColumn('orders', 'reminder_at', "DATETIME");
    addColumn('orders', 'delivered_at', "DATETIME");
    addColumn('orders', 'reminder_days', "INTEGER");
    addColumn('orders', 'reminder_status', "TEXT DEFAULT 'pending'");
    addColumn('orders', 'reminder_sent_at', "DATETIME");
    addColumn('orders', 'share_token', "TEXT");
    addColumn('orders', 'appointment_date', "DATETIME");
    addColumn('order_history', 'user_id', "INTEGER");
    addColumn('templates', 'send_whatsapp', "INTEGER DEFAULT 0");
    addColumn('templates', 'send_email', "INTEGER DEFAULT 1");
    addColumn('config', 'reminder_enabled', "INTEGER DEFAULT 1");
    addColumn('config', 'reminder_time', "TEXT DEFAULT '09:00'");
    addColumn('config', 'mail_provider', "TEXT DEFAULT 'smtp'");
    addColumn('config', 'resend_api_key', "TEXT");
    addColumn('order_items', 'parts_profit', "REAL DEFAULT 0");
    addColumn('users', 'first_name', "TEXT");
    addColumn('users', 'last_name', "TEXT");

    // Self-reparative migration for parts_profit on existing items
    try {
        const configMigration = db.prepare('SELECT parts_profit_percentage FROM config LIMIT 1').get();
        if (configMigration && configMigration.parts_profit_percentage > 0) {
            const countToUpdate = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE (parts_profit = 0 OR parts_profit IS NULL) AND parts_price > 0').get().count;
            if (countToUpdate > 0) {
                db.prepare(`
                    UPDATE order_items 
                    SET parts_profit = ROUND(parts_price * (? / 100.0))
                    WHERE (parts_profit = 0 OR parts_profit IS NULL) AND parts_price > 0
                `).run(configMigration.parts_profit_percentage);
                console.log(`[tenant:${slug}] Migration: Populated parts_profit for ${countToUpdate} items`);
            }
        }
    } catch (e) {
        console.error(`[tenant:${slug}] Error in parts_profit migration:`, e.message);
    }

    const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
    if (configCount === 0) {
        db.prepare(`
            INSERT INTO config(workshop_name, footer_text, address, phone, email, whatsapp, business_hours)
            VALUES(?, 'Powered by SurForge', '-', '-', '-', '-', ?)
        `).run(slug, JSON.stringify({ mon_fri: '09:00 - 18:00', sat: '09:00 - 13:00', sun: 'Cerrado' }));
    }

    const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
    if (templateCount === 0) {
        const defaultTemplates = [
            {
                name: 'Recepción de Vehículo',
                content: 'Hola [apodo], te damos la bienvenida a [taller]. Ya registramos el ingreso de tu [vehiculo]. Podés seguir el progreso en tiempo real aquí: [link]. Te avisaremos en cuanto tengamos el presupuesto listo. Orden de trabajo: #[orden_id].\n\nSaludos,\n[usuario]',
                trigger_status: 'Pendiente',
                include_pdf: 0,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Presupuesto para Revisión',
                content: 'Hola [apodo], el presupuesto para tu [vehiculo] ya se encuentra disponible para tu revisión. Podés verlo adjunto en este mensaje o desde el portal de clientes. Avisanos si estás de acuerdo para comenzar con el trabajo.\n\nSaludos,\n[usuario]',
                trigger_status: 'Presupuestado',
                include_pdf: 1,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Trabajo en Marcha',
                content: '¡Hola [apodo]! Te confirmamos que ya aprobaste el presupuesto y nos pusimos manos a la obra con tu [vehiculo]. Estaremos haciendo: [items]. Te avisamos en cuanto esté finalizado.\n\nSaludos,\n[usuario]',
                trigger_status: 'Aprobado',
                include_pdf: 0,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Vehículo Listo',
                content: '¡Buenas noticias [apodo]! Tu [vehiculo] ya está listo para ser retirado. Podés pasar por [taller] en nuestros horarios de atención. ¡Te esperamos!\n\nSaludos,\n[usuario]',
                trigger_status: 'Listo para entrega',
                include_pdf: 0,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Agradecimiento y Entrega',
                content: 'Muchas gracias [apodo] por confiar en [taller]. Acabamos de registrar la entrega de tu [vehiculo] con [km] km. Esperamos que disfrutes del andar y cualquier duda estamos a tu disposición.\n\nSaludos,\n[usuario]',
                trigger_status: 'Entregado',
                include_pdf: 1,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Seguimiento Preventivo',
                content: 'Hola [apodo], hace unos meses realizamos el servicio de [items] en tu [vehiculo] (registrado con [km] km). Te escribimos de [taller] para recordarte que podría ser un buen momento para una revisión preventiva y asegurar que todo siga funcionando perfecto. ¡Te esperamos!\n\nSaludos,\n[usuario]',
                trigger_status: 'Recordatorio',
                include_pdf: 0,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Envío de Documento',
                content: 'Hola [apodo], te enviamos adjunto el documento solicitado relacionado con tu [vehiculo] desde [taller]. Quedamos a tu disposición por cualquier consulta.\n\nSaludos,\n[usuario]',
                trigger_status: null,
                include_pdf: 1,
                send_email: 1,
                send_whatsapp: 0
            },
            {
                name: 'Turno Asignado',
                content: 'Hola [apodo], te confirmamos que tu turno para el [vehiculo] en [taller] fue agendado para el [turno_fecha]. ¡Te esperamos!\n\nSaludos,\n[usuario]',
                trigger_status: 'Turno asignado',
                include_pdf: 0,
                send_email: 1,
                send_whatsapp: 0
            }
        ];

        const insertStmt = db.prepare(`
            INSERT INTO templates (name, content, trigger_status, include_pdf, send_email, send_whatsapp) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const t of defaultTemplates) {
            insertStmt.run(t.name, t.content, t.trigger_status, t.include_pdf, t.send_email, t.send_whatsapp);
        }
    }

    // Migration to auto-append 'Saludos, [usuario]' to templates that lack any [usuario] token
    try {
        db.prepare(`
            UPDATE templates 
            SET content = content || char(10) || char(10) || 'Saludos,' || char(10) || '[usuario]'
            WHERE content NOT LIKE '%[usuario]%' AND content NOT LIKE '%[usuario_nombre]%'
        `).run();
    } catch (e) {
        console.error(`[tenant:${slug}] Error migrating templates with [usuario] token:`, e.message);
    }

    // Migration to add 'Turno Asignado' using correct trigger_status
    try {
        const turnoTemplateNew = db.prepare("SELECT COUNT(*) as count FROM templates WHERE trigger_status = 'Turno asignado'").get().count;
        if (turnoTemplateNew === 0) {
            db.prepare("DELETE FROM templates WHERE name = 'Turno Asignado' AND trigger_status = 'En proceso'").run();
            db.prepare(`
                INSERT INTO templates (name, content, trigger_status, include_pdf, send_email, send_whatsapp) 
                VALUES (?, ?, ?, 0, 1, 0)
            `).run(
                'Turno Asignado',
                'Hola [apodo], te confirmamos que tu turno para el [vehiculo] en [taller] fue agendado para el [turno_fecha]. ¡Te esperamos!\n\nSaludos,\n[usuario]',
                'Turno asignado'
            );
        }
    } catch (e) {
        console.error(`[tenant:${slug}] Error adding Turno Asignado template:`, e.message);
    }

    // Migration to wipe CHECK constraints cleanly (SQLite 3 magic bypass)
    try {
        const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get()?.sql || '';
        if (tableSql.includes("CHECK(status IN")) {
            const fixedSql = tableSql.replace(/CHECK\s*\(\s*status\s*IN\s*\([^)]+\)\s*\)/ig, "");
            db.prepare("PRAGMA writable_schema = 1").run();
            db.prepare("UPDATE sqlite_master SET sql = ? WHERE type='table' AND name='orders'").run(fixedSql);
            db.prepare("PRAGMA writable_schema = 0").run();
        }
    } catch (e) {
        console.error(`[tenant:${slug}] Migration to remove CHECK status failed`, e);
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

    // Refreshing db connections after migrate

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
