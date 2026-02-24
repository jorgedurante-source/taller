const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const tenantsDir = path.join(__dirname, 'tenants');
const tenants = fs.readdirSync(tenantsDir).filter(f => fs.statSync(path.join(tenantsDir, f)).isDirectory());

const newSchema = `
CREATE TABLE orders_new (
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
    appointment_date DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
)
`;

for (const slug of tenants) {
    const dbPath = path.join(tenantsDir, slug, 'db.sqlite');
    const targetDb = fs.existsSync(dbPath) ? dbPath : null;

    if (targetDb) {
        console.log(`Migrating ${slug} (${targetDb})...`);
        const db = new Database(targetDb);
        try {
            const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get()?.sql || '';
            if (tableSql.includes("CHECK(status IN") || tableSql.includes("CHECK (status IN") || tableSql.includes("CHECK(status")) {
                console.log(`Rebuilding orders table in ${slug}...`);

                db.prepare('PRAGMA foreign_keys=OFF').run();
                db.prepare('BEGIN TRANSACTION').run();

                // Get strictly the list of columns currently in 'orders' to maintain data sync
                const columnsInfo = db.prepare("PRAGMA table_info('orders')").all();
                const columns = columnsInfo.map(c => '"' + c.name + '"').join(', ');

                db.exec(newSchema);
                // Assume the columns match mostly, or at least subset matches. 
                db.exec(`INSERT INTO orders_new (${columns}) SELECT ${columns} FROM orders`);
                db.exec('DROP TABLE orders');
                db.exec('ALTER TABLE orders_new RENAME TO orders');

                db.prepare('COMMIT').run();
                console.log(`Table successfully rebuilt and CHECK constraint bypassed for ${slug}`);
            } else {
                console.log(`No fix needed for ${slug} (already bypassed)`);
            }

            // Fix enabled_modules in config
            const configInfo = db.prepare("PRAGMA table_info('config')").all();
            if (!configInfo.some(c => c.name === 'enabled_modules')) {
                console.log(`Adding enabled_modules to config in ${slug}...`);
                db.prepare('ALTER TABLE config ADD COLUMN enabled_modules TEXT DEFAULT \'["inventory", "appointments", "income", "reports", "settings"]\'').run();
            }
        } catch (e) {
            if (db.inTransaction) db.prepare('ROLLBACK').run();
            console.error(`Error migrating ${slug}:`, e.message);
        } finally {
            db.close();
        }
    }
}
