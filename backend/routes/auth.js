const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin } = require('../middleware/auth');

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Try staff users table first
        const user = req.db.prepare(`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.username = ?
        `).get(username);

        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                let permissions = [];
                try { permissions = JSON.parse(user.permissions || '[]') || []; } catch (e) { }
                const roleName = user.role_name || user.role || 'staff';

                const token = jwt.sign(
                    { id: user.id, username: user.username, role: roleName, permissions },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' }
                );
                return res.json({ token, user: { id: user.id, username: user.username, role: roleName, permissions } });
            }
            // If staff password doesn't match, fall through to try client login
            // if the username looks like an email
            if (!user.client_id && !username.includes('@')) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }
        }

        // 2. Try clients table (portal login)
        const client = req.db.prepare(`
            SELECT id, first_name, last_name, email, password 
            FROM clients 
            WHERE email = ?
        `).get(username);

        if (!client || !client.password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isClientMatch = await bcrypt.compare(password, client.password);
        if (!isClientMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const clientToken = jwt.sign(
            { id: client.id, username: client.email, role: 'client', permissions: [], clientId: client.id },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token: clientToken,
            user: {
                id: client.id,
                username: client.email,
                role: 'client',
                permissions: [],
                name: `${client.first_name} ${client.last_name}`.trim()
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/register
// @desc    Register a new user (Admin only)
router.post('/register', auth, isAdmin, async (req, res) => {
    const { username, password, role_id } = req.body;

    try {
        const userExists = req.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const role = req.db.prepare('SELECT name FROM roles WHERE id = ?').get(role_id);
        const roleName = role ? role.name.toLowerCase() : 'mecánico';

        let legacyRole = 'mechanic';
        if (roleName === 'admin') legacyRole = 'admin';
        else if (roleName === 'mecánico' || roleName === 'mechanic') legacyRole = 'mechanic';

        const result = req.db.prepare('INSERT INTO users (username, password, role_id, role) VALUES (?, ?, ?, ?)').run(
            username,
            hashedPassword,
            role_id,
            legacyRole
        );

        res.json({ id: result.lastInsertRowid, username, role_id });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/me
// @desc    Get current user data
router.get('/me', auth, (req, res) => {
    res.json(req.user);
});

module.exports = router;
