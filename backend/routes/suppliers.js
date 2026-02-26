const express = require('express');
const router = express.Router();
const { auth, hasPermission } = require('../middleware/auth');
const { sendEmail } = require('../lib/mailer');
const path = require('path');

// @route   GET api/:slug/suppliers
// @desc    Get all suppliers
router.get('/', auth, hasPermission('proveedores'), (req, res) => {
    try {
        const suppliers = req.db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
        res.json(suppliers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener proveedores' });
    }
});

// @route   POST api/:slug/suppliers
// @desc    Create a supplier
router.post('/', auth, hasPermission('proveedores'), (req, res) => {
    const { name, email, phone, notes } = req.body;
    try {
        const result = req.db.prepare(
            'INSERT INTO suppliers (name, email, phone, notes) VALUES (?, ?, ?, ?)'
        ).run(name, email, phone, notes);

        res.json({
            id: result.lastInsertRowid,
            name, email, phone, notes
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al crear proveedor' });
    }
});

// @route   PUT api/:slug/suppliers/:id
// @desc    Update a supplier
router.put('/:id', auth, hasPermission('proveedores'), (req, res) => {
    const { name, email, phone, notes } = req.body;
    try {
        req.db.prepare(
            'UPDATE suppliers SET name = ?, email = ?, phone = ?, notes = ? WHERE id = ?'
        ).run(name, email, phone, notes, req.params.id);

        res.json({ message: 'Proveedor actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar proveedor' });
    }
});

// @route   DELETE api/:slug/suppliers/:id
// @desc    Delete a supplier
router.delete('/:id', auth, hasPermission('proveedores'), (req, res) => {
    try {
        req.db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
        res.json({ message: 'Proveedor eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar proveedor' });
    }
});

// @route   POST api/:slug/suppliers/inquiry
// @desc    Send part inquiry to multiple suppliers
router.post('/inquiry', auth, hasPermission('proveedores'), async (req, res) => {
    const { supplierIds, partDescription, vehicleInfo, orderId } = req.body;

    try {
        const suppliers = req.db.prepare(`
            SELECT * FROM suppliers WHERE id IN (${supplierIds.map(() => '?').join(',')})
        `).all(...supplierIds);

        // Obtener configuración del taller para el nombre y datos de contacto
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get() || {};
        const workshopName = config.workshop_name || 'Nuestro Taller';
        const workshopContactInfo = `Email: ${config.email || '---'} | Tel: ${config?.whatsapp || config?.phone || '---'} | Dir: ${config.address || '---'}`;

        // Obtener usuario actual para el token [usuario]
        const user = req.user;
        const userName = `${user.first_name || user.username || 'Taller'} ${user.last_name || ''}`.trim();

        // Buscar plantilla para consulta a proveedor
        const template = req.db.prepare('SELECT * FROM templates WHERE trigger_status = ?').get('proveedores_consulta');

        // Guardar registro de la consulta
        const supplierNames = suppliers.map(s => s.name);
        req.db.prepare(`
            INSERT INTO part_inquiries (order_id, supplier_ids, part_description, vehicle_info)
            VALUES (?, ?, ?, ?)
        `).run(orderId || null, JSON.stringify(supplierNames), partDescription, vehicleInfo);

        // Enviar correos a proveedores que tienen email
        for (const supplier of suppliers) {
            if (supplier.email) {
                const subject = `Consulta de Repuesto - ${workshopName}${orderId ? ` (Orden #${orderId})` : ''}`;

                let messageBody = '';
                if (template) {
                    const replacements = {
                        'proveedor': supplier.name,
                        'repuesto': partDescription,
                        'vehiculo': vehicleInfo,
                        'taller': workshopName,
                        'datos_contacto_taller': workshopContactInfo,
                        'usuario': userName,
                        'orden_id': orderId || '---'
                    };

                    messageBody = template.content;
                    Object.keys(replacements).forEach(key => {
                        const regex = new RegExp(`[\\{\\[]${key}[\\}\\]]`, 'gi');
                        messageBody = messageBody.replace(regex, replacements[key]);
                    });

                    messageBody = messageBody.replace(/\n/g, '<br/>');
                } else {
                    messageBody = `
                        <h3>Consulta de Presupuesto de Repuesto</h3>
                        <p>Hola <strong>${supplier.name}</strong>,</p>
                        <p>Desde <strong>${workshopName}</strong> queremos consultarte por el presupuesto del siguiente repuesto:</p>
                        <div style="background: #f4f4f4; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>Vehículo:</strong> ${vehicleInfo}</p>
                            <p><strong>Repuesto y Detalles:</strong><br/>${partDescription}</p>
                        </div>
                        <p>${workshopContactInfo}</p>
                        <p>Saludos, ${userName}</p>
                    `;
                }

                try {
                    await sendEmail(req.db, supplier.email, subject, messageBody);
                } catch (err) {
                    console.error(`Error enviando consulta a ${supplier.name}:`, err);
                }
            }
        }

        res.json({
            message: `Consulta enviada a ${suppliers.length} proveedores correctamente`,
            suppliers: supplierNames
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al enviar consultas' });
    }
});

// @route   GET api/:slug/suppliers/inquiries/order/:orderId
// @desc    Get all inquiries for a specific order
router.get('/inquiries/order/:orderId', auth, (req, res) => {
    // Permisos: Solo si tiene 'proveedores' o al menos 'ordenes' para ver el historial
    if (!req.user.permissions.includes('proveedores') && !req.user.permissions.includes('ordenes')) {
        return res.status(403).json({ message: 'No tienes permiso' });
    }
    try {
        const inquiries = req.db.prepare(`
            SELECT * FROM part_inquiries WHERE order_id = ? ORDER BY created_at DESC
        `).all(req.params.orderId);

        res.json(inquiries.map(i => ({
            ...i,
            supplier_ids: JSON.parse(i.supplier_ids)
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener consultas' });
    }
});

module.exports = router;
