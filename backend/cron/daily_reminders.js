const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { sendEmail } = require('../lib/mailer');
const { generateOrderPDF } = require('../lib/pdfGenerator');

const tenantsDir = path.join(__dirname, '..', 'tenants');

async function processReminders() {
    console.log(`[cron] Starting daily reminders check: ${new Date().toISOString()}`);

    if (!fs.existsSync(tenantsDir)) return;

    const tenants = fs.readdirSync(tenantsDir);

    for (const slug of tenants) {
        const dbPath = path.join(tenantsDir, slug, 'db.sqlite');
        if (!fs.existsSync(dbPath)) continue;

        const db = new Database(dbPath);
        try {
            // Find reminders due today
            const dueReminders = db.prepare(`
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.reminder_at IS NOT NULL 
                AND date(o.reminder_at) = date('now')
                AND o.status = 'Entregado'
            `).all();

            if (dueReminders.length === 0) continue;

            const config = db.prepare('SELECT * FROM config LIMIT 1').get() || {};
            const workshopName = config.workshop_name || 'Nuestro Taller';

            // Find the "Seguimiento" template (or fallback)
            let template = db.prepare("SELECT * FROM templates WHERE name LIKE '%Seguimiento%' OR name LIKE '%Recordatorio%'").get();
            if (!template) {
                // If no specific template, we don't send automatically to avoid spam without a good message
                console.log(`[cron] No reminder template found for ${slug}, skipping automatic emails.`);
                continue;
            }

            for (const order of dueReminders) {
                if (!order.email) continue;

                let message = template.content
                    .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
                    .replace(/\[cliente\]/g, order.first_name || 'Cliente')
                    .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
                    .replace(/{taller}|\[taller\]/g, workshopName)
                    .replace(/{orden_id}|\[orden_id\]/g, order.id);

                let attachments = [];
                if (template.include_pdf === 1) {
                    const pdfBuffer = await generateOrderPDF(db, order.id);
                    if (pdfBuffer) {
                        attachments.push({ filename: `historial_${order.id}.pdf`, content: pdfBuffer });
                    }
                }

                try {
                    await sendEmail(db, order.email, `Recordatorio: Seguimiento de tu vehículo - ${workshopName}`, message, attachments);
                    console.log(`[cron] Sent reminder for order #${order.id} in ${slug}`);

                    // Mark as notified or clear reminder to avoid double sending
                    db.prepare("UPDATE orders SET reminder_at = NULL WHERE id = ?").run(order.id);
                } catch (sendErr) {
                    console.error(`[cron] Failed to send email for order #${order.id}:`, sendErr.message);
                }
            }
        } catch (err) {
            console.error(`[cron] Error processing tenant ${slug}:`, err.message);
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
