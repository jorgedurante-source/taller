const { logError } = require('../lib/logger');

/**
 * Global error handling middleware for Express.
 */
function errorHandler(err, req, res, next) {
    const slug = req.params.slug || req.user?.slug || 'system';
    const db = req.db || null;

    // Log the error
    logError(db, slug, err, req);

    // Respond to client
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
        message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

module.exports = errorHandler;
