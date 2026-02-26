const { listTenants, getDb } = require('../tenantManager');
const { checkEmails } = require('../lib/imapReader');

async function syncAllEmails() {
    console.log('[cron:imap] Starting email sync for all tenants...');
    const tenants = listTenants();

    for (const tenant of tenants) {
        try {
            const db = getDb(tenant.slug);
            await checkEmails(db, tenant.slug);
        } catch (err) {
            console.error(`[cron:imap] Error syncing ${tenant.slug}:`, err.message);
        }
    }
    console.log('[cron:imap] Email sync completed.');
}

module.exports = { syncAllEmails };
