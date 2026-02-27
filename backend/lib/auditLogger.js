const { getDb } = require('../tenantManager');
const superDb = require('../superDb');

/**
 * Logs an activity within a specific tenant workshop.
 */
function logActivity(slug, user, action, entityType, entityId, details, req = null) {
    try {
        const db = getDb(slug);
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        // If it's a superuser, we don't save the ID because it doesn't exist in the tenant's users table (FK would fail)
        const userId = (user && !user.isSuperuser) ? user.id : null;
        const userName = user ? (user.username || user.first_name || 'System') : 'System';

        db.prepare(`
            INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            userName,
            action,
            entityType,
            entityId ? String(entityId) : null,
            typeof details === 'object' ? JSON.stringify(details) : details,
            ip
        );
        console.log(`[audit] Tenant ${slug}: ${action} by ${userName}`);
    } catch (e) {
        console.error(`[audit] Error logging tenant activity:`, e.message);
    }
}

/**
 * Logs a high-level system activity in the super database.
 */
function logSystemActivity(superUser, action, entityType, entityId, details, req = null) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        const userId = superUser ? superUser.id : null;
        const userName = superUser ? superUser.username : 'System';

        superDb.prepare(`
            INSERT INTO system_audit_logs (super_user_id, super_user_name, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            userName,
            action,
            entityType,
            entityId ? String(entityId) : null,
            typeof details === 'object' ? JSON.stringify(details) : details,
            ip
        );
        console.log(`[audit] System: ${action} by ${userName}`);
    } catch (e) {
        console.error(`[audit] Error logging system activity:`, e.message);
    }
}

module.exports = { logActivity, logSystemActivity };
