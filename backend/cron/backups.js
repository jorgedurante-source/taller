const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const superDb = require('../superDb');
const { listTenants, getTenantDir } = require('../tenantManager');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

async function performBackup(slug) {
    const workshopBackupsDir = path.join(BACKUPS_DIR, slug);
    if (!fs.existsSync(workshopBackupsDir)) fs.mkdirSync(workshopBackupsDir, { recursive: true });

    const tenantDir = getTenantDir(slug);

    // Force WAL checkpoint before backup
    try {
        const { getDb } = require('../tenantManager');
        const db = getDb(slug);
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
        console.error(`[backup-cron] Checkpoint failed for ${slug}:`, e.message);
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-${date}.zip`;
    const destPath = path.join(workshopBackupsDir, filename);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(destPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(filename));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        const dbPath = path.join(tenantDir, 'db.sqlite');
        if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'db.sqlite' });
        const uploadsPath = path.join(tenantDir, 'uploads');
        if (fs.existsSync(uploadsPath)) archive.directory(uploadsPath, 'uploads');

        archive.finalize();
    });
}

function rotateBackups(slug, retention) {
    const workshopBackupsDir = path.join(BACKUPS_DIR, slug);
    if (!fs.existsSync(workshopBackupsDir)) return;

    const files = fs.readdirSync(workshopBackupsDir)
        .filter(f => f.startsWith('auto-') && f.endsWith('.zip'))
        .map(f => {
            return {
                name: f,
                path: path.join(workshopBackupsDir, f),
                created_at: fs.statSync(path.join(workshopBackupsDir, f)).birthtime
            };
        })
        .sort((a, b) => b.created_at - a.created_at);

    if (files.length > retention) {
        const toDelete = files.slice(retention);
        toDelete.forEach(f => {
            fs.unlinkSync(f.path);
            console.log(`[backup-cron] Deleted old backup: ${f.name}`);
        });
    }
}

// Scheduled task
// This runs once an hour to check if it's time to backup based on setting
// For simplicity, we can run it daily at 3 AM or check frequency
cron.schedule('0 3 * * *', async () => {
    const enabled = superDb.prepare("SELECT value FROM global_settings WHERE key = 'backup_enabled'").get()?.value === 'true';
    if (!enabled) return;

    const retention = parseInt(superDb.prepare("SELECT value FROM global_settings WHERE key = 'backup_retention'").get()?.value || '7');
    const tenants = listTenants();

    console.log(`[backup-cron] Starting daily backups for ${tenants.length} tenants...`);

    for (const tenant of tenants) {
        try {
            await performBackup(tenant.slug);
            rotateBackups(tenant.slug, retention);
            console.log(`[backup-cron] Backup successful for: ${tenant.slug}`);
        } catch (err) {
            console.error(`[backup-cron] Backup failed for ${tenant.slug}:`, err);
        }
    }
});

console.log('[backup-cron] Task scheduled (Daily at 3 AM)');

module.exports = { performBackup };
