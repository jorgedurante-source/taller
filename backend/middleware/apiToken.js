const superDb = require('../superDb');

/**
 * Middleware to authenticate requests via the workshop's unique API token.
 * This looks for 'x-api-token' in headers.
 */
function apiTokenAuth(req, res, next) {
    const token = req.header('x-api-token');
    const { slug } = req.params;

    if (!token) {
        return res.status(401).json({ message: 'API Token missing' });
    }

    try {
        const workshop = superDb.prepare("SELECT api_token FROM workshops WHERE slug = ?").get(slug);

        if (!workshop || workshop.api_token !== token) {
            return res.status(401).json({ message: 'Invalid API Token' });
        }

        // Token is valid
        next();
    } catch (err) {
        console.error('API Token Auth Error:', err);
        res.status(500).json({ message: 'Internal Server Error during token validation' });
    }
}

module.exports = { apiTokenAuth };
