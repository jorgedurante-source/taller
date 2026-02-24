const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth } = require('../middleware/auth');
const { sendEmail } = require('../lib/mailer');
const { generateOrderPDF } = require('../lib/pdfGenerator');

// Multer setup for photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// @route   GET api/orders
router.get('/', auth, (req, res) => {
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
router.post('/', auth, async (req, res) => {
    const { client_id, vehicle_id, description, items } = req.body;

    const insertOrder = req.db.prepare('INSERT INTO orders (client_id, vehicle_id, description, created_by_id) VALUES (?, ?, ?, ?)');
    const insertItem = req.db.prepare('INSERT INTO order_items (order_id, service_id, description, labor_price, parts_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        const actingUserId = req.user.id === 0 ? null : req.user.id;
        const orderResult = insertOrder.run(data.client_id, data.vehicle_id, data.description || '', actingUserId);
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
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.id = ?
            `).get(orderId);

            const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};

            if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
                console.warn('SMTP support is not fully configured. Email skipped.');
            } else if (order && order.email) {
                let message = template.content
                    .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
                    .replace(/\[cliente\]/g, order.first_name || 'Cliente')
                    .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
                    .replace(/{taller}|\[taller\]/g, config.workshop_name || 'Nuestro Taller')
                    .replace(/{orden_id}|\[orden_id\]/g, orderId);

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
router.get('/:id', auth, (req, res) => {
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
router.put('/:id/status', auth, async (req, res) => {
    const { status, notes, reminder_days } = req.body;
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
        if (status === 'Entregado' && reminder_days) {
            const baseDate = new Date(deliveredAt || new Date());
            baseDate.setDate(baseDate.getDate() + parseInt(reminder_days));
            reminderAt = baseDate.toISOString();
        }

        req.db.prepare('UPDATE orders SET status = ?, modified_by_id = ?, updated_at = CURRENT_TIMESTAMP, reminder_at = ?, delivered_at = ?, reminder_days = ? WHERE id = ?')
            .run(status, actingUserId, reminderAt, deliveredAt, reminder_days || null, req.params.id);

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
                SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.id = ?
            `).get(req.params.id);

            const items = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
            const servicesStr = items.map(i => i.description).join(', ');

            const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};
            const workshopName = config.workshop_name || 'Nuestro Taller';

            if (order && order.email) {
                let message = (template.content || '')
                    .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
                    .replace(/\[cliente\]/g, order.first_name || 'Cliente')
                    .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
                    .replace(/{taller}|\[taller\]/g, workshopName)
                    .replace(/\[servicios\]/g, servicesStr || 'Mantenimiento General')
                    .replace(/\[km\]/g, order.km || '---')
                    .replace(/{orden_id}|\[orden_id\]/g, order.id);

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
router.put('/:id/payment', auth, (req, res) => {
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
router.post('/:id/photos', auth, upload.array('photos', 5), (req, res) => {
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
router.post('/:id/budget', auth, (req, res) => {
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
                    SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km
                    FROM orders o
                    JOIN clients c ON o.client_id = c.id
                    JOIN vehicles v ON o.vehicle_id = v.id
                    WHERE o.id = ?
                `).get(req.params.id);

                const items = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
                const servicesStr = items.map(i => i.description).join(', ');

                const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

                if (order && order.email) {
                    let message = template.content
                        .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
                        .replace(/\[cliente\]/g, order.first_name || 'Cliente')
                        .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
                        .replace(/{taller}|\[taller\]/g, config.workshop_name || 'Nuestro Taller')
                        .replace(/\[servicios\]/g, servicesStr || 'Mantenimiento General')
                        .replace(/\[km\]/g, order.km || '---')
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
router.post('/:id/items', auth, (req, res) => {
    const { items } = req.body;
    const insertItem = req.db.prepare('INSERT INTO order_items (order_id, service_id, description, labor_price, parts_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)');

    const transaction = req.db.transaction((data) => {
        data.forEach(item => {
            const subtotal = (parseFloat(item.labor_price) || 0) + (parseFloat(item.parts_price) || 0);
            insertItem.run(
                req.params.id,
                item.service_id || null,
                item.description,
                item.labor_price || 0,
                item.parts_price || 0,
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
router.put('/items/:itemId', auth, (req, res) => {
    const { description, labor_price, parts_price } = req.body;
    const subtotal = (parseFloat(labor_price) || 0) + (parseFloat(parts_price) || 0);
    try {
        const item = req.db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item no encontrado' });

        req.db.prepare(`
            UPDATE order_items 
            SET description = ?, labor_price = ?, parts_price = ?, subtotal = ? 
            WHERE id = ?
        `).run(description, labor_price, parts_price, subtotal, req.params.itemId);

        const actingUserId = req.user.id === 0 ? null : req.user.id;
        req.db.prepare('UPDATE orders SET modified_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(actingUserId, item.order_id);

        res.json({ message: 'Item actualizado' });
    } catch (err) {
        res.status(500).json({ message: 'Error actualizando item' });
    }
});

// @route   DELETE api/orders/items/:itemId
router.delete('/items/:itemId', auth, (req, res) => {
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
router.post('/:id/send-email', auth, async (req, res) => {
    try {
        const order = req.db.prepare(`
            SELECT o.*, c.first_name, c.nickname, c.email, v.model, v.brand, v.km
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE o.id = ?
        `).get(req.params.id);

        const orderItems = req.db.prepare('SELECT description FROM order_items WHERE order_id = ?').all(req.params.id);
        const servicesStr = orderItems.map(i => i.description).join(', ');

        if (!order || !order.email) return res.status(404).json({ message: 'Order or client email not found' });

        let template = req.db.prepare('SELECT * FROM templates WHERE trigger_status = ?').get(order.status);
        if (!template) {
            template = req.db.prepare("SELECT * FROM templates WHERE name = 'Presupuesto Listo'").get();
        }

        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

        let message = template.content
            .replace(/{apodo}|\[apodo\]/g, order.nickname || order.first_name || 'Cliente')
            .replace(/\[cliente\]/g, order.first_name || 'Cliente')
            .replace(/{vehiculo}|\[vehiculo\]/g, `${order.brand} ${order.model}`)
            .replace(/{taller}|\[taller\]/g, config.workshop_name || 'Nuestro Taller')
            .replace(/\[servicios\]/g, servicesStr || 'Mantenimiento General')
            .replace(/\[km\]/g, order.km || '---')
            .replace(/{orden_id}|\[orden_id\]/g, order.id);

        let attachments = [];
        const pdfBuffer = await generateOrderPDF(req.db, order.id);
        if (pdfBuffer) {
            attachments.push({ filename: `orden_${order.id}.pdf`, content: pdfBuffer });
        }

        await sendEmail(req.db, order.email, `Actualización de tu Orden #${order.id}`, message, attachments);
        res.json({ message: 'Email enviado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al enviar email');
    }
});

// @route   POST api/orders/send-manual-template
router.post('/send-manual-template', auth, async (req, res) => {
    const { clientId, vehicleId, orderId, templateId } = req.body;
    try {
        const client = req.db.prepare('SELECT first_name, nickname, email FROM clients WHERE id = ?').get(clientId);
        const vehicle = req.db.prepare('SELECT brand, model FROM vehicles WHERE id = ?').get(vehicleId);
        const template = req.db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

        if (!client || !template) return res.status(404).json({ message: 'Client or Template not found' });

        let message = template.content
            .replace(/{apodo}|\[apodo\]/g, client.nickname || client.first_name || 'Cliente')
            .replace(/\[cliente\]/g, client.first_name || 'Cliente')
            .replace(/{vehiculo}|\[vehiculo\]/g, vehicle ? `${vehicle.brand} ${vehicle.model}` : 'vehículo')
            .replace(/{taller}|\[taller\]/g, config.workshop_name || 'Nuestro Taller')
            .replace(/{orden_id}|\[orden_id\]/g, orderId || '');

        await sendEmail(req.db, client.email, template.name, message, []);
        res.json({ message: 'Mensaje enviado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al enviar el mensaje');
    }
});

module.exports = router;
