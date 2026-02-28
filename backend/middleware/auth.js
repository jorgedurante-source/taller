const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const secret = req.tenantSecret || process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';
        const decoded = jwt.verify(token, secret);

        // --- Security Isolation Fix ---
        // If we are in a tenant context (req.slug exists), verify the token belongs to this tenant
        // Superusers can bypass this check (they have isSuperuser: true and potentially a different slug)
        if (req.slug && !decoded.isSuperuser && decoded.slug !== req.slug) {
            return res.status(403).json({ message: 'Acceso denegado: El token no pertenece a este taller' });
        }

        req.user = decoded;

        // --- Session Timeout Check & Activity Update ---
        try {
            const superDb = require('../superDb');
            const now = new Date();

            if (decoded.isSuperuser && decoded.superId) {
                const sUser = superDb.prepare('SELECT last_activity FROM super_users WHERE id = ?').get(decoded.superId);
                if (sUser && sUser.last_activity) {
                    const timeout = parseInt(superDb.prepare("SELECT value FROM global_settings WHERE key = 'superadmin_session_timeout'").get()?.value || '120');
                    const lastActivity = new Date(sUser.last_activity.replace(' ', 'T') + 'Z');
                    const diffMins = (now - lastActivity) / (1000 * 60);

                    if (diffMins > timeout) {
                        return res.status(401).json({ message: 'Sesión de Superusuario expirada por inactividad', timeout: true });
                    }
                }
                superDb.prepare('UPDATE super_users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(decoded.superId);
            } else if (req.db && decoded.id && decoded.role !== 'client' && decoded.role !== 'cliente') {
                const uRec = req.db.prepare('SELECT last_activity FROM users WHERE id = ?').get(decoded.id);
                if (uRec && uRec.last_activity) {
                    const timeout = parseInt(superDb.prepare("SELECT value FROM global_settings WHERE key = 'user_session_timeout'").get()?.value || '60');
                    const lastActivity = new Date(uRec.last_activity.replace(' ', 'T') + 'Z');
                    const diffMins = (now - lastActivity) / (1000 * 60);

                    if (diffMins > timeout) {
                        return res.status(401).json({ message: 'Sesión expirada por inactividad', timeout: true });
                    }
                }
                req.db.prepare('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(decoded.id);
            }
        } catch (e) {
            console.error('[authMiddleware] Timeout check error:', e.message);
        }

        // --- Maintenance Mode Enforcement ---
        if (req.maintenanceMode && !req.user.isSuperuser) {
            return res.status(503).json({
                message: 'Sistema en mantenimiento',
                status: 'maintenance',
                details: 'El sistema se encuentra en mantenimiento programado. Por favor, intenta de nuevo más tarde.'
            });
        }

        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const isAdmin = (req, res, next) => {
    // Superuser always has admin access
    const role = req.user?.role?.toLowerCase();
    if (req.user && (req.user.isSuperuser || role === 'administrador' || role === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado: Se requiere rol de Administrador o acceso de Superusuario' });
    }
};

const hasPermission = (permission) => {
    return (req, res, next) => {
        // Superuser bypasses all individual permissions
        if (req.user && (req.user.isSuperuser || (req.user.permissions && req.user.permissions.includes(permission)))) {
            // Even if the user has the permission, check if the module is enabled globally for this tenant
            if (req.user.isSuperuser || (req.enabledModules && req.enabledModules.includes(permission))) {
                next();
            } else {
                res.status(403).json({ message: 'Módulo no habilitado' });
            }
        } else {
            res.status(403).json({ message: `Acceso denegado: Se requiere permiso de ${permission}` });
        }
    };
};

module.exports = { auth, isAdmin, hasPermission };
