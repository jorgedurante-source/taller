const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auth middlewares
const { auth, isAdmin, hasPermission } = require('../middleware/auth');

// Multer storage for logo - directly to tenant persistent path
const { getTenantDir } = require('../tenantManager');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // req.slug is provided by tenantMiddleware
        const slug = req.slug || req.params.slug;
        const dir = path.join(getTenantDir(slug), 'uploads', 'site');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// @route   GET api/config
router.get('/', (req, res) => {
    try {
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        // Also get environment from superDb
        const superDb = require('../superDb');
        const workshop = superDb.prepare('SELECT environment, status, name, logo_path FROM workshops WHERE slug = ?').get(req.slug);

        res.json({
            ...config,
            environment: workshop?.environment || 'prod',
            status: workshop?.status || 'active',
            workshop_name: workshop?.name || config.workshop_name, // Override with global name
            logo_path: workshop?.logo_path || config.logo_path,     // Override with global logo
            enabled_modules: req.enabledModules || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching config' });
    }
});

// @route   PUT api/config
router.put('/', auth, hasPermission('settings'), (req, res) => {
    const {
        workshop_name, footer_text, logo_path,
        address, phone, email, whatsapp, instagram, business_hours,
        tax_percentage, income_include_parts, parts_profit_percentage,
        smtp_host, smtp_port, smtp_user, smtp_pass, theme_id,
        reminder_enabled, reminder_time, mail_provider, resend_api_key,
        messages_enabled, imap_host, imap_port, imap_user, imap_pass, imap_enabled,
        client_portal_language
    } = req.body;

    try {
        const port = (smtp_port === '' || smtp_port === null || isNaN(parseInt(smtp_port))) ? null : parseInt(smtp_port);
        const iPort = (imap_port === '' || imap_port === null || isNaN(parseInt(imap_port))) ? 993 : parseInt(imap_port);

        req.db.prepare(`
            UPDATE config 
            SET workshop_name = ?, footer_text = ?, logo_path = ?,
                address = ?, phone = ?, email = ?, whatsapp = ?, instagram = ?, 
                business_hours = ?, tax_percentage = ?, income_include_parts = ?, 
                parts_profit_percentage = ?, smtp_host = ?, smtp_port = ?, 
                smtp_user = ?, smtp_pass = ?, theme_id = ?,
                reminder_enabled = ?, reminder_time = ?, mail_provider = ?, resend_api_key = ?,
                messages_enabled = ?, imap_host = ?, imap_port = ?, imap_user = ?, imap_pass = ?, imap_enabled = ?,
                client_portal_language = ?
            WHERE id = 1
        `).run(
            workshop_name, footer_text, logo_path,
            address, phone, email, whatsapp, instagram,
            typeof business_hours === 'string' ? business_hours : JSON.stringify(business_hours),
            tax_percentage, income_include_parts, parts_profit_percentage,
            smtp_host, port, smtp_user, smtp_pass, theme_id || 'default',
            reminder_enabled === undefined ? 1 : reminder_enabled,
            reminder_time || '09:00',
            mail_provider || 'smtp',
            resend_api_key || null,
            messages_enabled === undefined ? 1 : messages_enabled,
            imap_host || null,
            iPort,
            imap_user || null,
            imap_pass || null,
            imap_enabled || 0,
            client_portal_language || 'es'
        );
        res.json({ message: 'Configuración actualizada correctamente' });
        const { logActivity } = require('../lib/auditLogger');
        logActivity(req.slug, req.user, 'UPDATE_CONFIG', 'config', 1, req.body, req);
    } catch (err) {
        console.error('Error updating config:', err);
        res.status(500).json({ message: 'Error al actualizar configuración: ' + err.message });
    }
});

// @route   POST api/config/logo
router.post('/logo', auth, hasPermission('settings'), upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Logo file required' });
    try {
        const slug = req.user.slug || req.slug;
        const logoPath = `/uploads/${slug}/site/${req.file.filename}`;

        req.db.prepare("UPDATE config SET logo_path = ? WHERE id = 1").run(logoPath);
        const superDb = require('../superDb');
        superDb.prepare("UPDATE workshops SET logo_path = ? WHERE slug = ?").run(logoPath, slug);

        res.json({ logo_path: logoPath });
    } catch (err) {
        console.error('[config] Error uploading logo:', err);
        res.status(500).json({ message: 'Error server: ' + err.message });
    }
});

// @route   POST api/config/report
router.post('/report', auth, (req, res) => {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'El asunto y el mensaje son obligatorios' });

    try {
        const superDb = require('../superDb');
        const workshop = superDb.prepare('SELECT name FROM workshops WHERE slug = ?').get(req.slug);

        superDb.prepare(`
            INSERT INTO support_tickets (workshop_slug, workshop_name, user_name, subject, message)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.slug, workshop?.name || req.slug, req.user.username, subject, message);

        res.json({ message: 'Reporte enviado con éxito. El equipo técnico lo revisará pronto.' });

        const { logActivity } = require('../lib/auditLogger');
        logActivity(req.slug, req.user, 'CREATE_SUPPORT_TICKET', 'ticket', 0, { subject }, req);
    } catch (err) {
        console.error('[report] Error saving ticket:', err.message);
        res.status(500).json({ message: 'Error al enviar el reporte: ' + err.message });
    }
});

// @route   PUT api/config/reports/:id/status
router.put('/reports/:id/status', auth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['open', 'resolved'].includes(status)) return res.status(400).json({ message: 'Estado inválido' });

    try {
        const superDb = require('../superDb');
        // Ensure the ticket belongs to the workshop
        const ticket = superDb.prepare('SELECT id FROM support_tickets WHERE id = ? AND workshop_slug = ?').get(id, req.slug);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado o no pertenece a este taller' });

        superDb.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
        res.json({ message: `Reporte marcado como ${status === 'resolved' ? 'solucionado' : 'sin solucionar'}` });

        const { logActivity } = require('../lib/auditLogger');
        logActivity(req.slug, req.user, 'UPDATE_TICKET_STATUS', 'ticket', id, { status }, req);
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el estado del reporte' });
    }
});

// @route   GET api/config/reports
router.get('/reports', auth, (req, res) => {
    try {
        const superDb = require('../superDb');
        const tickets = superDb.prepare(`
            SELECT * FROM support_tickets 
            WHERE workshop_slug = ? 
            ORDER BY created_at DESC
        `).all(req.slug);
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener reportes' });
    }
});

module.exports = router;
