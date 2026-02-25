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
router.put('/', auth, hasPermission('configuracion'), (req, res) => {
    const {
        workshop_name, footer_text, logo_path,
        address, phone, email, whatsapp, instagram, business_hours,
        tax_percentage, income_include_parts, parts_profit_percentage,
        smtp_host, smtp_port, smtp_user, smtp_pass, theme_id,
        reminder_enabled, reminder_time, mail_provider, resend_api_key,
        messages_enabled
    } = req.body;

    try {
        const port = (smtp_port === '' || smtp_port === null || isNaN(parseInt(smtp_port))) ? null : parseInt(smtp_port);

        req.db.prepare(`
            UPDATE config 
            SET workshop_name = ?, footer_text = ?, logo_path = ?,
                address = ?, phone = ?, email = ?, whatsapp = ?, instagram = ?, 
                business_hours = ?, tax_percentage = ?, income_include_parts = ?, 
                parts_profit_percentage = ?, smtp_host = ?, smtp_port = ?, 
                smtp_user = ?, smtp_pass = ?, theme_id = ?,
                reminder_enabled = ?, reminder_time = ?, mail_provider = ?, resend_api_key = ?,
                messages_enabled = ?
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
            messages_enabled === undefined ? 1 : messages_enabled
        );
        res.json({ message: 'Configuración actualizada correctamente' });
    } catch (err) {
        console.error('Error updating config:', err);
        res.status(500).json({ message: 'Error al actualizar configuración: ' + err.message });
    }
});

// @route   POST api/config/logo
router.post('/logo', auth, hasPermission('configuracion'), upload.single('logo'), (req, res) => {
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

module.exports = router;
