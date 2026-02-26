const { getDb, tenantExists } = require('../tenantManager');

/**
 * Middleware that reads :slug from the route, loads the tenant DB,
 * and attaches req.db and req.slug to the request.
 */
function tenantMiddleware(req, res, next) {
    const slug = req.params.slug;

    if (!slug) {
        return res.status(400).json({ message: 'Tenant slug is required' });
    }

    if (!tenantExists(slug)) {
        return res.status(404).json({ message: `Taller "${slug}" no encontrado` });
    }

    try {
        const superDb = require('../superDb');
        const workshop = superDb.prepare("SELECT status, api_token, enabled_modules FROM workshops WHERE slug = ?").get(slug);

        if (workshop) {
            req.tenantSecret = workshop.api_token;
            try {
                req.enabledModules = JSON.parse(workshop.enabled_modules || '[]');
            } catch (e) {
                req.enabledModules = [];
            }
        }

        if (workshop && workshop.status === 'inactive') {
            return res.status(403).json({
                message: 'Taller desactivado',
                status: 'inactive',
                details: 'El acceso a este taller ha sido suspendido por el administrador.'
            });
        }

        // Global Settings & Maintenance Mode Check
        const settings = superDb.prepare("SELECT * FROM global_settings").all();
        req.globalSettings = {};
        settings.forEach(s => req.globalSettings[s.key] = s.value);

        if (req.globalSettings.maintenance_mode === 'true') {
            req.maintenanceMode = true;
        }

        req.db = getDb(slug);
        req.slug = slug;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = tenantMiddleware;
