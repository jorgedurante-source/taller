const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');
const { logActivity } = require('../lib/auditLogger');

// @route   GET api/roles
router.get('/', auth, (req, res, next) => {
    const roles = req.db.prepare('SELECT * FROM roles').all();
    const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));
    const userPermissions = req.user.permissions || [];

    const filteredRoles = roles.map(r => {
        try {
            r.permissions = JSON.parse(r.permissions);
            return r;
        } catch (e) {
            r.permissions = [];
            return r;
        }
    }).filter(r => {
        if (isAdminUser) return true;
        // A non-admin user can only see roles that have a subset of their own permissions
        return r.permissions.every(p => userPermissions.includes(p));
    });

    // Further filter permissions based on enabled modules
    filteredRoles.forEach(r => {
        if (req.enabledModules) {
            r.permissions = r.permissions.filter(p => req.enabledModules.includes(p));
        }
    });

    res.json(filteredRoles);
});

// @route   POST api/roles
router.post('/', auth, hasPermission('roles'), (req, res, next) => {
    const { name, permissions } = req.body;
    const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));
    const userPermissions = req.user.permissions || [];

    if (!isAdminUser) {
        if (!permissions.every(p => userPermissions.includes(p))) {
            return res.status(403).json({ message: 'No puedes asignar permisos que no tienes' });
        }
    }

    const result = req.db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run(
        name,
        JSON.stringify(permissions || [])
    );
    res.json({ id: result.lastInsertRowid, name, permissions });
    logActivity(req.slug, req.user, 'CREATE_ROLE', 'role', result.lastInsertRowid, { name, permissions }, req);
});

// @route   PUT api/roles/:id
router.put('/:id', auth, hasPermission('roles'), (req, res, next) => {
    const { name, permissions } = req.body;
    const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));
    const userPermissions = req.user.permissions || [];

    if (permissions && !isAdminUser) {
        if (!permissions.every(p => userPermissions.includes(p))) {
            return res.status(403).json({ message: 'No puedes asignar permisos que no tienes' });
        }
    }

    try {
        const role = req.db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
        if (!role) return res.status(404).json({ message: 'Rol no encontrado' });

        // Admin role cannot be edited
        if (role.name.toLowerCase() === 'admin') {
            return res.status(403).json({ message: 'El rol Admin es del sistema y no se puede editar' });
        }

        req.db.prepare('UPDATE roles SET name = ?, permissions = ? WHERE id = ?').run(
            name || role.name,
            JSON.stringify(permissions || JSON.parse(role.permissions)),
            req.params.id
        );
        res.json({ message: 'Rol actualizado correctamente' });
        logActivity(req.slug, req.user, 'UPDATE_ROLE', 'role', req.params.id, { name, permissions }, req);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/roles/:id
router.delete('/:id', auth, hasPermission('roles'), (req, res, next) => {
    try {
        const role = req.db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
        if (!role) return res.status(404).json({ message: 'Rol no encontrado' });

        if (role.name.toLowerCase() === 'admin') {
            return res.status(403).json({ message: 'El rol Admin no se puede eliminar' });
        }

        // Check if any user is using this role
        const usersWithRole = req.db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(req.params.id);
        if (usersWithRole.count > 0) {
            return res.status(400).json({ message: 'No se puede eliminar un rol que está siendo usado por usuarios' });
        }

        req.db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
        res.json({ message: 'Rol eliminado' });
        logActivity(req.slug, req.user, 'DELETE_ROLE', 'role', req.params.id, { name: role.name }, req);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
