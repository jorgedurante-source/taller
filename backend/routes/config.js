const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auth middlewares
const { auth, isAdmin } = require('../middleware/auth');

// Multer storage for logo
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const slug = req.params.slug || req.baseUrl.split('/')[2]; // Extract slug from URL if needed
        const dir = path.resolve(__dirname, `../tenants/${req.user.slug}/uploads/site`);
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
    const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
    res.json(config);
});

// @route   PUT api/config
router.put('/', auth, isAdmin, (req, res) => {
    const {
        workshop_name, footer_text, logo_path,
        address, phone, email, whatsapp, instagram, business_hours,
        tax_percentage, income_include_parts, parts_profit_percentage,
        smtp_host, smtp_port, smtp_user, smtp_pass, theme_id
    } = req.body;

    try {
        const port = (smtp_port === '' || smtp_port === null || isNaN(parseInt(smtp_port))) ? null : parseInt(smtp_port);

        req.db.prepare(`
            UPDATE config 
            SET workshop_name = ?, footer_text = ?, logo_path = ?,
                address = ?, phone = ?, email = ?, whatsapp = ?, instagram = ?, 
                business_hours = ?, tax_percentage = ?, income_include_parts = ?, 
                parts_profit_percentage = ?, smtp_host = ?, smtp_port = ?, 
                smtp_user = ?, smtp_pass = ?, theme_id = ?
            WHERE id = 1
        `).run(
            workshop_name, footer_text, logo_path,
            address, phone, email, whatsapp, instagram,
            typeof business_hours === 'string' ? business_hours : JSON.stringify(business_hours),
            tax_percentage, income_include_parts, parts_profit_percentage,
            smtp_host, port, smtp_user, smtp_pass, theme_id || 'default'
        );
        res.json({ message: 'Configuration updated successfully' });
    } catch (err) {
        console.error('Error updating config:', err);
        res.status(500).json({ message: 'Error al actualizar configuración: ' + err.message });
    }
});

// @route   POST api/config/logo
router.post('/logo', auth, isAdmin, upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Logo file required' });
    try {
        const logoPath = `/uploads/${req.user.slug}/site/${req.file.filename}`;
        req.db.prepare("UPDATE config SET logo_path = ? WHERE id = 1").run(logoPath);
        res.json({ logo_path: logoPath });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al subir logo' });
    }
});

module.exports = router;
