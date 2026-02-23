const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const secret = process.env.MECH_SECRET || process.env.JWT_SECRET || process.env.AUTH_KEY || 'mech_default_secret_321';
        const decoded = jwt.verify(token, secret);

        // --- Security Isolation Fix ---
        // If we are in a tenant context (req.slug exists), verify the token belongs to this tenant
        // Superusers can bypass this check (they have isSuperuser: true and potentially a different slug)
        if (req.slug && !decoded.isSuperuser && decoded.slug !== req.slug) {
            return res.status(403).json({ message: 'Acceso denegado: El token no pertenece a este taller' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const isAdmin = (req, res, next) => {
    // Superuser always has admin access
    if (req.user && (req.user.isSuperuser || (req.user.role && req.user.role.toLowerCase() === 'admin'))) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Requires Admin role or Superuser access' });
    }
};

const hasPermission = (permission) => {
    return (req, res, next) => {
        // Superuser bypasses all individual permissions
        if (req.user && (req.user.isSuperuser || (req.user.permissions && req.user.permissions.includes(permission)))) {
            next();
        } else {
            res.status(403).json({ message: `Access denied: Requires permission ${permission}` });
        }
    };
};

module.exports = { auth, isAdmin, hasPermission };
