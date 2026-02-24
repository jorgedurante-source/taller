const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'tenants/kabul/db.sqlite');
const db = new Database(dbPath);
try {
    const token = 'c828943fb48b';
    const order = db.prepare(`
        SELECT o.id, o.status, o.description, o.created_at, o.updated_at, o.appointment_date,
               v.brand, v.model, v.plate,
               (SELECT workshop_name FROM config LIMIT 1) as workshop_name,
               (SELECT phone FROM config LIMIT 1) as workshop_phone,
               (SELECT address FROM config LIMIT 1) as workshop_address,
               (SELECT logo_path FROM config LIMIT 1) as logo_path,
               (SELECT enabled_modules FROM config LIMIT 1) as enabled_modules
        FROM orders o
        LEFT JOIN vehicles v ON o.vehicle_id = v.id
        WHERE o.share_token = ?
    `).get(token);
    console.log('Result:', JSON.stringify(order, null, 2));
} catch (e) {
    console.error('ERROR:', e.message);
} finally {
    db.close();
}
