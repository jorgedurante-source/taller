const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');

// @route   GET api/roles
router.get('/', auth, (req, res) => {
    try {
        const roles = req.db.prepare('SELECT * FROM roles').all();
        roles.forEach(r => {
            try {
                r.permissions = JSON.parse(r.permissions);
                // Filter permissions based on enabled modules
                if (req.enabledModules) {
                    r.permissions = r.permissions.filter(p => req.enabledModules.includes(p));
                }
            } catch (e) {
                r.permissions = [];
            }
        });
        res.json(roles);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/roles
router.post('/', auth, hasPermission('roles'), (req, res) => {
    const { name, permissions } = req.body;
    try {
        const result = req.db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run(
            name,
            JSON.stringify(permissions || [])
        );
        res.json({ id: result.lastInsertRowid, name, permissions });
    } catch (err) {
        res.status(400).json({ message: 'Error al crear rol (posible nombre duplicado)' });
    }
});

// @route   PUT api/roles/:id
router.put('/:id', auth, hasPermission('roles'), (req, res) => {
    const { name, permissions } = req.body;
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
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/roles/:id
router.delete('/:id', auth, hasPermission('roles'), (req, res) => {
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
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
