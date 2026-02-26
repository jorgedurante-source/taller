const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');

// @route   GET api/users
router.get('/', auth, hasPermission('usuarios'), (req, res) => {
    try {
        // Hide the master 'admin' user from the list
        const users = req.db.prepare(`
            SELECT u.id, u.username, u.first_name, u.last_name, r.name as role_name, u.role_id, u.client_id
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.client_id IS NULL AND u.username != 'admin'
        `).all();
        res.json(users);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/users
router.post('/', auth, hasPermission('usuarios'), async (req, res) => {

    const { username, password, role_id, first_name, last_name } = req.body;
    if (!username || !password || !role_id) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Reserved usernames check
    const reserved = ['admin', 'superuser', 'superadmin'];
    if (reserved.includes(username.toLowerCase())) {
        return res.status(400).json({ message: 'Nombre de usuario reservado' });
    }

    try {
        const normalizedRoleId = role_id === '' ? null : Number(role_id);
        const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));

        const targetRole = req.db.prepare('SELECT * FROM roles WHERE id = ?').get(normalizedRoleId);
        if (targetRole && (targetRole.name.toLowerCase() === 'admin' || targetRole.name.toLowerCase() === 'administrador') && !isAdminUser) {
            return res.status(403).json({ message: 'Solo un Administrador puede crear otros usuarios Administradores' });
        }

        // Check if non-admin is assigning a role with more permissions than they have
        if (targetRole && !isAdminUser) {
            const rolePerms = JSON.parse(targetRole.permissions || '[]');
            const userPerms = req.user.permissions || [];
            if (!rolePerms.every(p => userPerms.includes(p))) {
                return res.status(403).json({ message: 'No puedes asignar un rol con más permisos que los tuyos' });
            }
        }

        const userExists = req.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (userExists) return res.status(400).json({ message: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const roleName = targetRole ? targetRole.name.toLowerCase() : 'mecánico';

        // Map to legacy role names (now in Spanish)
        let legacyRole = 'mecanico';
        if (roleName === 'admin' || roleName === 'administrador') legacyRole = 'administrador';
        else if (roleName === 'mecánico' || roleName === 'mecanico' || roleName === 'mechanic') legacyRole = 'mecanico';
        else if (roleName === 'cliente' || roleName === 'client') legacyRole = 'cliente';
        else if (roleName === 'empleado' || roleName === 'staff') legacyRole = 'empleado';

        const result = req.db.prepare('INSERT INTO users (username, password, first_name, last_name, role_id, role) VALUES (?, ?, ?, ?, ?, ?)').run(
            username, hashedPassword, first_name || null, last_name || null, normalizedRoleId, legacyRole
        );
        res.json({ id: result.lastInsertRowid, username, role_id: normalizedRoleId });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ message: 'Error interno: ' + err.message });
    }
});

// @route   PUT api/users/:id
router.put('/:id', auth, hasPermission('usuarios'), async (req, res) => {

    const { role_id, username, password, first_name, last_name } = req.body;
    try {
        const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Cannot edit 'admin' from here if it's the master admin
        if (user.username === 'admin' && !req.user.isSuperuser) {
            return res.status(403).json({ message: 'No se puede editar el usuario administrador principal' });
        }

        const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));

        // Enforce: Only Admin can promote someone to Admin or edit an Admin
        const targetRole = req.db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id || user.role_id);
        if (targetRole && (targetRole.name.toLowerCase() === 'admin' || targetRole.name.toLowerCase() === 'administrador') && !isAdminUser) {
            return res.status(403).json({ message: 'Solo un Administrador puede asignar el rol de Administrador' });
        }

        // Check if non-admin is assigning a role with more permissions than they have
        if (targetRole && !isAdminUser) {
            const rolePerms = JSON.parse(targetRole.permissions || '[]');
            const userPerms = req.user.permissions || [];
            if (!rolePerms.every(p => userPerms.includes(p))) {
                return res.status(403).json({ message: 'No puedes asignar un rol con más permisos que los tuyos' });
            }
        }

        const roleName = targetRole ? targetRole.name.toLowerCase() : 'mecánico';

        // Map to legacy role names (now in Spanish)
        let legacyRole = 'mecanico';
        if (roleName === 'admin' || roleName === 'administrador') legacyRole = 'administrador';
        else if (roleName === 'mecánico' || roleName === 'mecanico' || roleName === 'mechanic') legacyRole = 'mecanico';
        else if (roleName === 'cliente' || roleName === 'client') legacyRole = 'cliente';
        else if (roleName === 'empleado' || roleName === 'staff') legacyRole = 'empleado';

        let query = 'UPDATE users SET role_id = ?, username = ?, first_name = ?, last_name = ?, role = ?';
        let params = [
            role_id || user.role_id,
            username || user.username,
            first_name !== undefined ? first_name : user.first_name,
            last_name !== undefined ? last_name : user.last_name,
            legacyRole
        ];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(req.params.id);

        req.db.prepare(query).run(...params);
        res.json({ message: 'Usuario actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/users/:id
router.delete('/:id', auth, hasPermission('usuarios'), (req, res) => {

    try {
        const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        if (user.username === 'admin') {
            return res.status(403).json({ message: 'El usuario admin principal no se puede eliminar' });
        }

        const isAdminUser = req.user.isSuperuser || (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'administrador'));
        const targetRole = req.db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);

        if (targetRole && targetRole.name.toLowerCase() === 'admin' && !isAdminUser) {
            return res.status(403).json({ message: 'Solo un Administrador puede eliminar a otro Administrador' });
        }

        req.db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
