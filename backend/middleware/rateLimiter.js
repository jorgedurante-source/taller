/**
 * Rate Limiter Middleware
 * 
 * Protects the system from excessive requests by limiting the number of calls
 * a client can make within a specific time window.
 */

const requestCounts = new Map();

// Configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 100;    // Max requests per window
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup every 5 minutes

/**
 * Custom Rate Limiter
 * @param {Object} options - { windowMs, max, message }
 */
const rateLimiter = (options = {}) => {
    const windowMs = options.windowMs || WINDOW_MS;
    const max = options.max || MAX_REQUESTS;
    const message = options.message || 'Demasiadas peticiones. Por favor, intenta de nuevo más tarde.';

    return (req, res, next) => {
        // Use IP + Slug (if available) as key to identify the client context
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const slug = req.params.slug || 'global';
        const key = `${ip}:${slug}`;

        const now = Date.now();
        const record = requestCounts.get(key);

        if (!record) {
            // First request for this key
            requestCounts.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }

        if (now > record.resetTime) {
            // Window expired, reset counter
            record.count = 1;
            record.resetTime = now + windowMs;
            return next();
        }

        // Increment count
        record.count++;

        // Add headers for the client to know their status
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

        if (record.count > max) {
            console.warn(`[rate-limit] Blocked ${key}: ${record.count} requests in current window`);
            return res.status(429).json({
                message,
                retryAfter: Math.ceil((record.resetTime - now) / 1000)
            });
        }

        next();
    };
};

// Cleanup task to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts.entries()) {
        if (now > record.resetTime) {
            requestCounts.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

module.exports = rateLimiter;
