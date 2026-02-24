const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const tenantsDir = path.join(__dirname, 'tenants');

function generateToken() {
    return crypto.randomBytes(6).toString('hex'); // 12 characters
}

if (!fs.existsSync(tenantsDir)) {
    console.log('No tenants directory found.');
    process.exit(0);
}

const tenants = fs.readdirSync(tenantsDir);

tenants.forEach(slug => {
    const dbPath = path.join(tenantsDir, slug, 'db.sqlite');
    if (fs.existsSync(dbPath)) {
        console.log(`Migrating tenant: ${slug}`);
        const db = new Database(dbPath);

        try {
            // Add share_token column if it doesn't exist
            const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
            const hasToken = tableInfo.some(c => c.name === 'share_token');

            if (!hasToken) {
                db.prepare("ALTER TABLE orders ADD COLUMN share_token TEXT").run();
                console.log(`- Added share_token column to ${slug}`);
            }

            // Fill empty tokens
            const orders = db.prepare("SELECT id FROM orders WHERE share_token IS NULL").all();
            const updateStmt = db.prepare("UPDATE orders SET share_token = ? WHERE id = ?");

            orders.forEach(o => {
                updateStmt.run(generateToken(), o.id);
            });

            if (orders.length > 0) {
                console.log(`- Generated tokens for ${orders.length} orders in ${slug}`);
            }

        } catch (err) {
            console.error(`Error migrating ${slug}:`, err);
        } finally {
            db.close();
        }
    }
});
