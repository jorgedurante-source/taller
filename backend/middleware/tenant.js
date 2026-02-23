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
        const workshop = superDb.prepare("SELECT status FROM workshops WHERE slug = ?").get(slug);

        if (workshop && workshop.status === 'inactive') {
            return res.status(403).json({
                message: 'Taller desactivado',
                status: 'inactive',
                details: 'El acceso a este taller ha sido suspendido por el administrador.'
            });
        }

        req.db = getDb(slug);
        req.slug = slug;
        next();
    } catch (err) {
        console.error(`[tenant] Error loading DB for ${slug}:`, err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
}

module.exports = tenantMiddleware;
