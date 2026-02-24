const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, hasPermission } = require('../middleware/auth');
const { sendEmail } = require('../lib/mailer');
const { generateOrderPDF } = require('../lib/pdfGenerator');

// Multer setup for photos - using tenant-specific persistent storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { getTenantDir } = require('../tenantManager');
        const slug = req.slug || req.params.slug;
        const dir = path.join(getTenantDir(slug), 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// @route   GET api/orders
router.get('/', auth, hasPermission('orders'), (req, res) => {
    const orders = req.db.prepare(`
        SELECT o.*, 
            (c.first_name || ' ' || c.last_name) as client_name, 
            v.plate, v.model,
            COALESCE((SELECT SUM(subtotal) FROM order_items WHERE order_id = o.id), 0) as order_total
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        JOIN vehicles v ON o.vehicle_id = v.id
        ORDER BY o.created_at DESC
    `).all();
    res.json(orders);
});

// @route   POST api/orders
router.post('/', auth, hasPermission('orders'), async (req, res) => {
    const { client_id, vehicle_id, description, items } = req.body;

    const crypto = require('crypto');
    const share_token = crypto.randomBytes(6).toString('hex');
    const insertOrder = req.db.prepare('INSERT INTO orders (client_id, vehicle_id, description, created_by_id, share_token) VALUES (?, ?, ?, ?, ?)');
    const insertItem = req.db.prepare('INSERT INTO order_items (order_id, service_id, description, labor_price, parts_price, parts_profit, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        const actingUserId = req.user.id === 0 ? null : req.user.id;
        const orderResult = insertOrder.run(data.client_id, data.vehicle_id, data.description || '', actingUserId, share_token);
        const orderId = orderResult.lastInsertRowid;

        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                const subtotal = (parseFloat(item.labor_price) || 0) + (parseFloat(item.parts_price) || 0);
                insertItem.run(
                    orderId,
                    item.service_id || null,
                    item.description,
                    item.labor_price || 0,
                    item.parts_price || 0,
                    item.parts_profit || 0,
                    subtotal
                );
            });
        }
        return orderId;
    });

    try {
        const orderId = transaction({ client_id, vehicle_id, description, items });

        // Log Initial History
        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('INSERT INTO order_history (order_id, status, notes, user_id) VALUES (?, ?, ?, ?)')
            .run(orderId, 'Pendiente', 'Orden de trabajo creada', actingUserId);

        // --- Automation Logic ---
        const template = req.db.prepare("SELECT * FROM templates WHERE trigger_status = 'Pendiente'").get();
        if (template) {
            const order = req.db.prepare(`
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, u.first_name as user_first_name, u.last_name as user_last_name
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                LEFT JOIN users u ON o.created_by_id = u.id
                WHERE o.id = ?
            `).get(orderId);

            const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};

            if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
                console.warn('SMTP support is not fully configured. Email skipped.');
            } else if (order && order.email && template.send_email === 1) {
                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const trackingLink = `${siteUrl}/${req.slug}/o/${order.share_token}`;

                const replacements = {
                    'apodo': order.nickname || order.first_name || 'Cliente',
                    'cliente': order.first_name || 'Cliente',
                    'vehiculo': `${order.brand} ${order.model}`,
                    'taller': config.workshop_name || 'Nuestro Taller',
                    'usuario': `${order.user_first_name || 'Taller'} ${order.user_last_name || ''}`.trim(),
                    'turno_fecha': '---',
                    'link': trackingLink,
                    'orden_id': orderId
                };

                let message = template.content;
                Object.keys(replacements).forEach(key => {
                    const regex = new RegExp(`[\\{\\[]${key}[\\}\\]]`, 'gi');
                    message = message.replace(regex, replacements[key]);
                });

                let attachments = [];
                if (template.include_pdf === 1) {
                    const pdfBuffer = await generateOrderPDF(req.db, orderId);
                    if (pdfBuffer) {
                        attachments.push({ filename: `orden_${orderId}.pdf`, content: pdfBuffer });
                    }
                }
                sendEmail(req.db, order.email, `Nueva Orden #${orderId} - Confirmación`, message, attachments)
                    .catch(err => console.error('Initial email error:', err));
            }
        }

        res.json({ id: orderId, message: 'Order created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating order' });
    }
});

// @route   GET api/orders/:id
router.get('/:id', auth, hasPermission('orders'), (req, res) => {
    try {
        const order = req.db.prepare(`
            SELECT o.*, (c.first_name || ' ' || c.last_name) as client_name, c.phone as client_phone, c.email as client_email,
                   v.plate, v.brand, v.model, v.year,
                   u.username as created_by_name
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            JOIN vehicles v ON o.vehicle_id = v.id
            LEFT JOIN users u ON o.created_by_id = u.id
            WHERE o.id = ?
        `).get(req.params.id);

        if (!order) return res.status(404).json({ message: 'Order not found' });

        const items = req.db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
        const history = req.db.prepare(`
            SELECT h.*, u.username as user_name 
            FROM order_history h 
            LEFT JOIN users u ON h.user_id = u.id 
            WHERE h.order_id = ? 
            ORDER BY h.created_at DESC
        `).all(req.params.id);
        const budget = req.db.prepare('SELECT * FROM budgets WHERE order_id = ?').get(req.params.id);

        res.json({ ...order, items, history, budget });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/orders/:id/status
router.put('/:id/status', auth, hasPermission('orders'), async (req, res) => {
    const { status, notes, reminder_days, appointment_date } = req.body;
    try {
        const actingUserId = req.user.id === 0 ? null : req.user.id;

        // Fetch current order to check delivery date
        const currentOrder = req.db.prepare('SELECT status, delivered_at, payment_status, payment_amount FROM orders WHERE id = ?').get(req.params.id);

        let deliveredAt = currentOrder.delivered_at;
        // If changing to 'Entregado' or already 'Entregado', ensure we have a delivery date
        if (status === 'Entregado' && !deliveredAt) {
            deliveredAt = new Date().toISOString();
        }

        let reminderAt = null;
        if (status === 'Entregado' && reminder_days && req.enabledModules.includes('reminders')) {
            const baseDate = new Date(deliveredAt || new Date());
            baseDate.setDate(baseDate.getDate() + parseInt(reminder_days));
            reminderAt = baseDate.toISOString().split('T')[0];
        }

        let queryArgs = [status, actingUserId, reminderAt, deliveredAt, reminder_days || null];
        let dateQueryStr = '';
        if (appointment_date !== undefined) {
            dateQueryStr = ', appointment_date = ?';
            queryArgs.push(appointment_date);
        }
        queryArgs.push(req.params.id);

        req.db.prepare(`UPDATE orders SET status = ?, modified_by_id = ?, updated_at = CURRENT_TIMESTAMP, reminder_at = ?, delivered_at = ?, reminder_days = ? ${dateQueryStr} WHERE id = ?`)
            .run(...queryArgs);

        // Log History
        let historyNotes = notes || `Cambio de estado a ${status}`;
        if (reminderAt) {
            historyNotes += ` (Recordatorio programado para el ${new Date(reminderAt).toLocaleDateString()})`;
        }

        req.db.prepare('INSERT INTO order_history (order_id, status, notes, user_id) VALUES (?, ?, ?, ?)')
            .run(req.params.id, status, historyNotes, actingUserId);

        // Auto-set payment to 'cobrado' when delivered
        if (status === 'Entregado') {
            if (!currentOrder.payment_status || currentOrder.payment_status === 'sin_cobrar') {
                const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};
                const includeParts = config.income_include_parts ?? 1;
                const partsPercentage = (config.parts_profit_percentage ?? 100) / 100.0;
                const totalRow = req.db.prepare(`
                    SELECT SUM(labor_price + (CASE WHEN ? = 1 THEN parts_price * ? ELSE 0 END)) as total
                    FROM order_items WHERE order_id = ?
                `).get(includeParts, partsPercentage, req.params.id);
                const orderTotal = totalRow?.total || 0;
                req.db.prepare("UPDATE orders SET payment_status = 'cobrado', payment_amount = ? WHERE id = ?")
                    .run(orderTotal, req.params.id);
            }
        }

        // --- Automation Logic ---
        const template = req.db.prepare('SELECT * FROM templates WHERE trigger_status = ?').get(status);
        if (template) {
            const order = req.db.prepare(`
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km, u.first_name as user_first_name, u.last_name as user_last_name
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                LEFT JOIN users u ON o.modified_by_id = u.id
                WHERE o.id = ?
            `).get(req.params.id);

            const items = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
            const servicesStr = items.map(i => i.description).join(', ');

            const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};
            const workshopName = config.workshop_name || 'Nuestro Taller';

            let appointmentDateFormatted = '---';
            if (order.appointment_date) {
                const d = new Date(order.appointment_date);
                if (!isNaN(d.getTime())) {
                    appointmentDateFormatted = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' a las ' +
                        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs';
                }
            }

            if (order && order.email && template.send_email === 1) {
                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const trackingLink = `${siteUrl}/${req.slug}/o/${order.share_token}`;

                const replacements = {
                    'apodo': order.nickname || order.first_name || 'Cliente',
                    'cliente': order.first_name || 'Cliente',
                    'vehiculo': `${order.brand} ${order.model}`,
                    'taller': workshopName,
                    'servicios': servicesStr || 'servicios realizados',
                    'items': servicesStr || 'servicios realizados',
                    'km': order.km || '---',
                    'usuario': `${order.user_first_name || 'Taller'} ${order.user_last_name || ''}`.trim(),
                    'turno_fecha': appointmentDateFormatted,
                    'link': trackingLink,
                    'orden_id': order.id
                };

                let message = (template.content || '');
                Object.keys(replacements).forEach(key => {
                    const regex = new RegExp(`[\\{\\[]${key}[\\}\\]]`, 'gi');
                    message = message.replace(regex, replacements[key]);
                });

                let attachments = [];
                if (template.include_pdf === 1) {
                    const pdfBuffer = await generateOrderPDF(req.db, order.id);
                    if (pdfBuffer) {
                        attachments.push({ filename: `orden_${order.id}.pdf`, content: pdfBuffer });
                    }
                }

                sendEmail(req.db, order.email, `Actualización de tu Orden #${order.id} - ${status}`, message, attachments)
                    .catch(err => console.error('Delayed email error:', err));
            }
        }

        res.json({ message: 'Status updated and notification triggered' });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ message: 'Error interno: ' + err.message });
    }
});

// @route   PUT api/orders/:id/payment
router.put('/:id/payment', auth, hasPermission('orders'), (req, res) => {
    const { payment_status, payment_amount } = req.body;
    if (!['cobrado', 'parcial', 'sin_cobrar'].includes(payment_status)) {
        return res.status(400).json({ message: 'Estado de cobro inválido' });
    }
    try {
        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('UPDATE orders SET payment_status = ?, payment_amount = ?, modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(payment_status, payment_amount || 0, actingUserId, req.params.id);

        req.db.prepare('INSERT INTO order_history (order_id, status, notes, user_id) VALUES (?, ?, ?, ?)')
            .run(req.params.id, `Cobro: ${payment_status}`, `Monto cobrado: $${payment_amount || 0}`, actingUserId);

        res.json({ message: 'Cobro actualizado' });
    } catch (err) {
        console.error('Error updating payment:', err);
        res.status(500).json({ message: 'Error interno: ' + err.message });
    }
});

// @route   POST api/orders/:id/photos
router.post('/:id/photos', auth, hasPermission('orders'), upload.array('photos', 5), (req, res) => {
    const filenames = req.files.map(f => f.filename);
    const order = req.db.prepare('SELECT photos FROM orders WHERE id = ?').get(req.params.id);
    const existingPhotos = JSON.parse(order.photos || '[]');
    const updatedPhotos = [...existingPhotos, ...filenames];

    const actingUserId = req.user.id === 0 ? null : req.user.id;
    req.db.prepare('UPDATE orders SET photos = ?, modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(updatedPhotos), actingUserId, req.params.id);
    res.json({ photos: updatedPhotos });
});

// @route   POST api/orders/:id/budget
router.post('/:id/budget', auth, hasPermission('orders'), (req, res) => {
    const { items, subtotal, tax, total } = req.body;
    const result = req.db.prepare('INSERT INTO budgets (order_id, items, subtotal, tax, total) VALUES (?, ?, ?, ?, ?)').run(
        req.params.id, JSON.stringify(items), subtotal, tax, total
    );

    const actingUserId = req.user.id === 0 ? null : req.user.id;
    req.db.prepare("UPDATE orders SET status = 'Presupuestado', modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(actingUserId, req.params.id);

    req.db.prepare('INSERT INTO order_history (order_id, status, notes, user_id) VALUES (?, ?, ?, ?)')
        .run(req.params.id, 'Presupuestado', `Presupuesto generado por un total de $${total}`, actingUserId);

    (async () => {
        try {
            const template = req.db.prepare("SELECT * FROM templates WHERE trigger_status = 'Presupuestado'").get();
            if (template) {
                const order = req.db.prepare(`
                    SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km, u.first_name as user_first_name, u.last_name as user_last_name
                    FROM orders o
                    JOIN clients c ON o.client_id = c.id
                    JOIN vehicles v ON o.vehicle_id = v.id
                    LEFT JOIN users u ON o.modified_by_id = u.id
                    WHERE o.id = ?
                `).get(req.params.id);

                const items = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
                const servicesStr = items.map(i => i.description).join(', ');

                const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

                if (order && order.email && template.send_email === 1) {
                    let message = template.content
                        .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
                        .replace(/\[cliente\]/g, order.first_name || 'Cliente')
                        .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
                        .replace(/{taller}|\[taller\]/g, config.workshop_name || 'Nuestro Taller')
                        .replace(/\[servicios\]/g, servicesStr || 'Mantenimiento General')
                        .replace(/\[km\]/g, order.km || '---')
                        .replace(/\[usuario\]/g, `${order.user_first_name || 'Taller'} ${order.user_last_name || ''}`.trim())
                        .replace(/{orden_id}|\[orden_id\]/g, req.params.id);

                    let attachments = [];
                    if (template.include_pdf === 1) {
                        const pdfBuffer = await generateOrderPDF(req.db, req.params.id);
                        if (pdfBuffer) {
                            attachments.push({ filename: `presupuesto_${req.params.id}.pdf`, content: pdfBuffer });
                        }
                    }
                    await sendEmail(req.db, order.email, `Presupuesto Disponible - Orden #${req.params.id}`, message, attachments);
                }
            }
        } catch (err) {
            console.error('Automation error in budget:', err);
        }
    })();

    res.json({ id: result.lastInsertRowid, total });
});

router.use('/photos', express.static('uploads'));

// @route   POST api/orders/:id/items
router.post('/:id/items', auth, hasPermission('orders'), (req, res) => {
    const { items } = req.body;
    const insertItem = req.db.prepare('INSERT INTO order_items (order_id, service_id, description, labor_price, parts_price, parts_profit, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        data.forEach(item => {
            const subtotal = (parseFloat(item.labor_price) || 0) + (parseFloat(item.parts_price) || 0);
            insertItem.run(
                req.params.id,
                item.service_id || null,
                item.description,
                item.labor_price || 0,
                item.parts_price || 0,
                item.parts_profit || 0,
                subtotal
            );
        });
    });

    try {
        transaction(items);
        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('UPDATE orders SET modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(actingUserId, req.params.id);
        res.json({ message: 'Items agregados correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error agregando items' });
    }
});

// @route   PUT api/orders/items/:itemId
router.put('/items/:itemId', auth, hasPermission('orders'), (req, res) => {
    const { description, labor_price, parts_price, parts_profit } = req.body;
    const subtotal = (parseFloat(labor_price) || 0) + (parseFloat(parts_price) || 0);
    try {
        const item = req.db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item no encontrado' });

        req.db.prepare(`
            UPDATE order_items 
            SET description = ?, labor_price = ?, parts_price = ?, parts_profit = ?, subtotal = ? 
            WHERE id = ?
        `).run(description, labor_price, parts_price, parts_profit || 0, subtotal, req.params.itemId);

        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('UPDATE orders SET modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(actingUserId, item.order_id);

        res.json({ message: 'Item actualizado' });
    } catch (err) {
        res.status(500).json({ message: 'Error actualizando item' });
    }
});

// @route   DELETE api/orders/items/:itemId
router.delete('/items/:itemId', auth, hasPermission('orders'), (req, res) => {
    try {
        const item = req.db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item no encontrado' });

        req.db.prepare('DELETE FROM order_items WHERE id = ?').run(req.params.itemId);

        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('UPDATE orders SET modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(actingUserId, item.order_id);

        res.json({ message: 'Item eliminado' });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando item' });
    }
});

// @route   POST api/orders/:id/send-email
router.post('/:id/send-email', auth, hasPermission('orders'), async (req, res) => {
    try {
        const order = req.db.prepare(`
            SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km, u.first_name as user_first_name, u.last_name as user_last_name
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            JOIN vehicles v ON o.vehicle_id = v.id
            LEFT JOIN users u ON o.modified_by_id = u.id
            WHERE o.id = ?
        `).get(req.params.id);

        const orderItems = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
        const servicesStr = orderItems.map(i => i.description).join(', ');

        if (!order || !order.email) return res.status(404).json({ message: 'Order or client email not found' });

        let template = req.db.prepare('SELECT * FROM templates WHERE trigger_status = ?').get(order.status);
        if (!template) {
            template = req.db.prepare("SELECT * FROM templates WHERE name = 'Presupuesto Listo'").get();
        }

        if (template && template.send_email !== 1) {
            return res.json({ message: 'La plantilla no tiene habilitado el envío por email. Ignorado.' });
        }

        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

        // Dynamic SITE_URL detection
        let siteUrl = process.env.SITE_URL;
        if (!siteUrl && req.headers.origin) {
            siteUrl = req.headers.origin;
        } else if (!siteUrl) {
            const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            siteUrl = `${protocol}://${req.get('host')}`.replace(':5000', ':3000'); // Common dev fallback
        }

        if (!order.share_token) {
            const crypto = require('crypto');
            order.share_token = crypto.randomBytes(6).toString('hex');
            req.db.prepare('UPDATE orders SET share_token = ? WHERE id = ?').run(order.share_token, order.id);
            console.log(`[Orders] Generated missing share_token for #${order.id}: ${order.share_token}`);
        }

        const trackingLink = `${siteUrl}/${req.slug}/o/${order.share_token}`;

        // Replacement data
        const replacements = {
            'apodo': order.nickname || order.first_name || 'Cliente',
            'cliente': order.first_name || 'Cliente',
            'vehiculo': `${order.brand} ${order.model}`,
            'taller': config.workshop_name || 'Nuestro Taller',
            'servicios': servicesStr || 'Mantenimiento General',
            'km': order.km || '---',
            'orden_id': order.id,
            'link': trackingLink,
            'usuario': `${order.user_first_name || 'Taller'} ${order.user_last_name || ''}`.trim()
        };

        let messageText = template.content;
        let messageHtml = template.content.replace(/\n/g, '<br>');

        console.log(`[Orders] Sending email for #${order.id}. Tracking Link: ${trackingLink}`);

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

        console.log(`- Final check: Replaced [link]? ${!messageText.includes('[link]')}`);

        let attachments = [];
        const pdfBuffer = await generateOrderPDF(req.db, order.id);
        if (pdfBuffer) {
            attachments.push({ filename: `orden_${order.id}.pdf`, content: pdfBuffer });
        }

        await sendEmail(req.db, order.email, `Actualización de tu Orden #${order.id}`, messageText, attachments, messageHtml);
        res.json({ message: 'Email enviado correctamente' });
    } catch (err) {
        console.error('[Orders] CRITICAL ERROR:', err);
        res.status(500).json({ message: 'Error interno al enviar email' });
    }
});

// @route   POST api/orders/send-manual-template
router.post('/send-manual-template', auth, hasPermission('orders'), async (req, res) => {
    const { clientId, vehicleId, orderId, templateId } = req.body;
    try {
        const client = req.db.prepare('SELECT first_name, nickname, email FROM clients WHERE id = ?').get(clientId);
        const vehicle = req.db.prepare('SELECT brand, model FROM vehicles WHERE id = ?').get(vehicleId);
        const template = req.db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        let userFirstName = 'Taller';
        let userLastName = '';
        if (req.user && req.user.id !== 0) {
            const u = req.db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(req.user.id);
            if (u) {
                userFirstName = u.first_name || 'Taller';
                userLastName = u.last_name || '';
            }
        }

        if (!client || !template) return res.status(404).json({ message: 'Client or Template not found' });

        if (template.send_email !== 1) {
            return res.status(400).json({ message: 'La plantilla seleccionada tiene el envío por correo deshabilitado.' });
        }

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const trackingLink = `${siteUrl}/${req.slug}/o/${orderId || 'error'}`; // Fallback if no order context

        const replacements = {
            'apodo': client.nickname || client.first_name || 'Cliente',
            'cliente': client.first_name || 'Cliente',
            'vehiculo': vehicle ? `${vehicle.brand} ${vehicle.model}` : 'vehículo',
            'taller': config.workshop_name || 'Nuestro Taller',
            'usuario': `${userFirstName} ${userLastName}`.trim(),
            'orden_id': orderId || '',
            'link': trackingLink
        };

        let message = template.content;
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`[\\{\\[]${key}[\\}\\]]`, 'gi');
            message = message.replace(regex, replacements[key]);
        });

        await sendEmail(req.db, client.email, template.name, message, []);
        res.json({ message: 'Mensaje enviado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al enviar el mensaje');
    }
});

// @route   PUT api/orders/:id/reminder-status
router.put('/:id/reminder-status', auth, hasPermission('reminders'), (req, res) => {
    const { status } = req.body; // 'pending', 'skipped', 'sent'
    try {
        req.db.prepare('UPDATE orders SET reminder_status = ? WHERE id = ?').run(status, req.params.id);
        res.json({ message: 'Estado de recordatorio actualizado' });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar estado de recordatorio' });
    }
});

module.exports = router;
