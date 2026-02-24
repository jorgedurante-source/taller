const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { sendEmail } = require('../lib/mailer');
const { generateOrderPDF } = require('../lib/pdfGenerator');

const tenantsDir = path.join(__dirname, '..', 'tenants');

async function processReminders() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...

    console.log(`[cron] Running reminders check: ${now.toISOString()}`);

    if (!fs.existsSync(tenantsDir)) return;
    const tenants = fs.readdirSync(tenantsDir);

    for (const slug of tenants) {
        const dbPath = path.join(tenantsDir, slug, 'db.sqlite');
        if (!fs.existsSync(dbPath)) continue;

        const db = new Database(dbPath);
        try {
            const config = db.prepare('SELECT * FROM config LIMIT 1').get() || {};
            if (config.reminder_enabled === 0) {
                console.log(`[cron:${slug}] Reminders disabled, skipping.`);
                continue;
            }

            const targetTime = config.reminder_time || '09:00';
            const [targetH] = targetTime.split(':').map(Number);

            // Only run if we are in the target hour
            if (currentHour !== targetH) {
                continue;
            }

            // Skip Sunday
            if (currentDay === 0) {
                console.log(`[cron:${slug}] It's Sunday, skipping reminders.`);
                continue;
            }

            // Query logic:
            // Fetch any reminder scheduled for today OR in the past that is still 'pending'
            let query = `
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.reminder_at IS NOT NULL 
                AND o.status = 'Entregado'
                AND o.reminder_status = 'pending'
                AND date(o.reminder_at) <= date('now', 'localtime')
            `;

            const dueReminders = db.prepare(query).all();

            if (dueReminders.length === 0) continue;

            const { sendOrderReminder } = require('../lib/reminderUtils');

            for (const order of dueReminders) {
                try {
                    await sendOrderReminder(db, order.id, slug, config);
                    console.log(`[cron:${slug}] Sent reminder for order #${order.id}`);
                } catch (sendErr) {
                    console.error(`[cron:${slug}] Failed to send #${order.id}:`, sendErr.message);
                }
            }
        } catch (err) {
            console.error(`[cron:${slug}] CRITICAL ERROR:`, err.message);
        } finally {
            db.close();
        }
    }
}

// In a real environment, this would be triggered by a real cron or a setInterval
// For now, we'll expose it so the user can trigger it or we can set a timer in server.js
module.exports = { processReminders };

if (require.main === module) {
    processReminders();
}
