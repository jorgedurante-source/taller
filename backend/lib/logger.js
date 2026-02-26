const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'logs');

// Ensure global logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Logs an error to the tenant database and fallbacks to a file if DB fails.
 */
async function logError(db, slug, error, req = null) {
    const timestamp = new Date().toISOString();
    const message = error.message || String(error);
    const stack = error.stack || '';
    const method = req ? req.method : null;
    const pathParsed = req ? req.path : null;
    const userId = req && req.user ? req.user.id : null;

    console.error(`[ERROR][${slug}] ${message}`);

    // 1. Try to log to DB
    if (db) {
        try {
            db.prepare(`
                INSERT INTO system_logs (level, message, stack_trace, path, method, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('error', message, stack, pathParsed, method, userId);
            return; // Successfully logged to DB
        } catch (dbErr) {
            console.error('CRITICAL: Failed to log error to database:', dbErr.message);
            // Fall through to file logging
        }
    }

    // 2. Fallback to file logging if DB is unavailable or insertion fails
    const logEntry = JSON.stringify({
        timestamp,
        slug,
        level: 'error',
        message,
        stack,
        path: pathParsed,
        method,
        userId
    }) + '\n';

    const fileName = slug ? `error_${slug}.log` : 'error_system.log';
    fs.appendFileSync(path.join(LOGS_DIR, fileName), logEntry);
}

/**
 * Logs general system events (non-errors)
 */
async function logInfo(db, message, req = null) {
    if (!db) return;
    try {
        const method = req ? req.method : null;
        const pathParsed = req ? req.path : null;
        const userId = req && req.user ? req.user.id : null;

        db.prepare(`
            INSERT INTO system_logs (level, message, path, method, user_id)
            VALUES (?, ?, ?, ?, ?)
        `).run('info', message, pathParsed, method, userId);
    } catch (e) {
        // Silent fail for info logs
    }
}

module.exports = { logError, logInfo, LOGS_DIR };
