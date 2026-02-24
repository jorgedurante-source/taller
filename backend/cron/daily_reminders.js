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
            // 1. Reminders for today
            // 2. If Monday, also reminders from yesterday (Sunday)
            let query = `
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.reminder_at IS NOT NULL 
                AND o.status = 'Entregado'
                AND o.reminder_status = 'pending'
                AND (
                    date(o.reminder_at) = date('now', 'localtime')
            `;

            if (currentDay === 1) { // Monday
                query += ` OR date(o.reminder_at) = date('now', '-1 day', 'localtime')`;
            }

            query += `)`;

            const dueReminders = db.prepare(query).all();

            if (dueReminders.length === 0) continue;

            const workshopName = config.workshop_name || 'Nuestro Taller';
            let template = db.prepare("SELECT * FROM templates WHERE name LIKE '%Seguimiento%' OR name LIKE '%Recordatorio%'").get();

            if (!template) {
                console.log(`[cron:${slug}] No reminder template found.`);
                continue;
            }

            for (const order of dueReminders) {
                if (!order.email) continue;

                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const trackingLink = `${siteUrl}/${slug}/o/${order.share_token}`;

                const replacements = {
                    'apodo': order.nickname || order.first_name || 'Cliente',
                    'cliente': order.first_name || 'Cliente',
                    'vehiculo': `${order.brand} ${order.model}`,
                    'taller': workshopName,
                    'orden_id': order.id,
                    'link': trackingLink
                };

                let messageText = template.content;
                let messageHtml = template.content.replace(/\n/g, '<br>');

                Object.keys(replacements).forEach(key => {
                    const regex = new RegExp(`[\\{\\[]${key}[\\}\\]]`, 'gi');
                    const value = String(replacements[key] || '');
                    messageText = messageText.replace(regex, value);
                    if (key === 'link') {
                        messageHtml = messageHtml.replace(regex, `<a href="${value}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">${value}</a>`);
                    } else {
                        messageHtml = messageHtml.replace(regex, value);
                    }
                });

                let attachments = [];
                if (template.include_pdf === 1) {
                    const pdfBuffer = await generateOrderPDF(db, order.id);
                    if (pdfBuffer) {
                        attachments.push({ filename: `historial_${order.id}.pdf`, content: pdfBuffer });
                    }
                }

                try {
                    await sendEmail(db, order.email, `Recordatorio: Seguimiento de tu vehículo - ${workshopName}`, messageText, attachments, messageHtml);

                    // Mark as sent
                    db.prepare(`
                        UPDATE orders 
                        SET reminder_status = 'sent', reminder_sent_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `).run(order.id);

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
