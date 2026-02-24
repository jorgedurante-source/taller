const { sendEmail } = require('./mailer');
const { generateOrderPDF } = require('./pdfGenerator');

async function sendOrderReminder(db, orderId, slug, config) {
    const order = db.prepare(`
        SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km, u.first_name as user_first_name, u.last_name as user_last_name,
               (SELECT GROUP_CONCAT(description, ', ') FROM order_items WHERE order_id = o.id) as services_done
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        JOIN vehicles v ON o.vehicle_id = v.id
        LEFT JOIN users u ON o.modified_by_id = u.id
        WHERE o.id = ?
    `).get(orderId);

    if (!order) throw new Error('Order not found');

    const workshopName = config.workshop_name || 'Nuestro Taller';
    let template = db.prepare("SELECT * FROM templates WHERE name LIKE '%Seguimiento%' OR name LIKE '%Recordatorio%'").get();

    if (!template) {
        throw new Error('No reminder template found');
    }

    const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const trackingLink = `${siteUrl}/${slug}/o/${order.share_token}`;

    const replacements = {
        'apodo': order.nickname || order.first_name || 'Cliente',
        'cliente': order.first_name || 'Cliente',
        'vehiculo': `${order.brand} ${order.model}`,
        'taller': workshopName,
        'orden_id': order.id,
        'link': trackingLink,
        'items': order.services_done || 'servicios realizados',
        'servicios': order.services_done || 'servicios realizados',
        'km': order.km || '0',
        'usuario': `${order.user_first_name || 'Taller'} ${order.user_last_name || ''}`.trim()
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

    if (template.send_email === 1 && order.email) {
        await sendEmail(db, order.email, `Recordatorio: Seguimiento de tu vehículo - ${workshopName}`, messageText, attachments, messageHtml);
    }

    // Mark as sent
    db.prepare(`
        UPDATE orders 
        SET reminder_status = 'sent', reminder_sent_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(order.id);

    return true;
}

module.exports = { sendOrderReminder };
