const Database = require('./tenantManager');
const fs = require('fs');
const path = require('path');

const tenantsDir = path.join(__dirname, 'tenants');
if (!fs.existsSync(tenantsDir)) {
    console.log('No tenants dir');
    process.exit(0);
}

const tenants = fs.readdirSync(tenantsDir);
for (const slug of tenants) {
    console.log(`--- Tenant: ${slug} ---`);
    const db = Database.getDb(slug);
    const config = db.prepare('SELECT reminder_enabled, reminder_time, smtp_host, smtp_user, resend_api_key FROM config LIMIT 1').get();
    console.log('Config:', config);

    const count = db.prepare("SELECT COUNT(*) as count FROM orders WHERE reminder_at IS NOT NULL AND status = 'Entregado' AND reminder_status = 'pending' AND date(reminder_at) = date('now', 'localtime')").get().count;
    console.log('Pending reminders for today:', count);

    const sample = db.prepare("SELECT id, reminder_at, reminder_status FROM orders WHERE reminder_at IS NOT NULL LIMIT 5").all();
    console.log('Sample reminders:', sample);
}
