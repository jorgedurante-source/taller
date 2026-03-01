const express = require('express');
const router = express.Router();
const superDb = require('../superDb');
const { getDb } = require('../tenantManager');
const { randomUUID } = require('crypto');

// ── Enqueue sync to all chain peers ──────────────────────────────────────────
function enqueueSyncToChain(sourceSlug, operation, payload) {
    try {
        const member = superDb.prepare(`
            SELECT cm.chain_id FROM chain_members cm WHERE cm.tenant_slug = ?
        `).get(sourceSlug);

        if (!member) {
            console.debug(`[chainSync] ${sourceSlug} not in any chain, skipping sync`);
            return;
        }

        const peers = superDb.prepare(`
            SELECT tenant_slug FROM chain_members
            WHERE chain_id = ? AND tenant_slug != ?
        `).all(member.chain_id, sourceSlug);

        for (const peer of peers) {
            superDb.prepare(`
                INSERT INTO sync_queue (chain_id, source_slug, target_slug, operation, payload)
                VALUES (?, ?, ?, ?, ?)
            `).run(member.chain_id, sourceSlug, peer.tenant_slug, operation, JSON.stringify(payload));
        }

        // Fast sync: trigger queue processing immediately
        setImmediate(() => {
            try { processSyncQueue(); } catch (e) { }
        });

    } catch (e) {
        console.warn('[chainSync] enqueue error:', e.message);
    }
}

// ── Process sync queue (called by worker) ────────────────────────────────────
function processSyncQueue() {
    const pending = superDb.prepare(`
        SELECT * FROM sync_queue
        WHERE status = 'pending' AND attempts < 3
        ORDER BY CASE WHEN operation = 'upsert_client' THEN 0 ELSE 1 END ASC, created_at ASC 
        LIMIT 50
    `).all();

    for (const job of pending) {
        try {
            const payload = JSON.parse(job.payload);
            const db = getDb(job.target_slug);

            if (job.operation === 'upsert_client') {
                const existing = db.prepare('SELECT id, uuid, source_tenant FROM clients WHERE uuid = ?').get(payload.uuid)
                    || (payload.email ? db.prepare('SELECT id, uuid, source_tenant FROM clients WHERE email = ? AND email != ""').get(payload.email) : null);

                if (existing) {
                    // Update if:
                    // 1. Source tenant owns it
                    // 2. OR the record has no source_tenant (adoption)
                    // 3. OR it was found by email but has no UUID
                    if (existing.source_tenant === payload.source_tenant || !existing.source_tenant || !existing.uuid) {
                        db.prepare(`
                            UPDATE clients SET first_name=?, last_name=?, email=?, phone=?,
                            address=?, notes=?, nickname=?, uuid=?, source_tenant=?
                            WHERE id=?
                        `).run(payload.first_name, payload.last_name, payload.email, payload.phone,
                            payload.address, payload.notes, payload.nickname,
                            payload.uuid, payload.source_tenant, existing.id);
                    }
                } else {
                    db.prepare(`
                        INSERT INTO clients (uuid, first_name, last_name, email, phone,
                        address, notes, nickname, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(payload.uuid, payload.first_name, payload.last_name,
                        payload.email, payload.phone, payload.address, payload.notes,
                        payload.nickname, payload.source_tenant, payload.created_at);
                }
            }

            if (job.operation === 'upsert_vehicle') {
                const clientInTarget = db.prepare('SELECT id FROM clients WHERE uuid = ?').get(payload.client_uuid);
                if (!clientInTarget) {
                    // Client not synced yet — requeue
                    throw new Error('Client not yet synced to target');
                }
                const existing = db.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE uuid = ?').get(payload.uuid)
                    || db.prepare('SELECT id, uuid, source_tenant FROM vehicles WHERE plate = ?').get(payload.plate);

                if (existing) {
                    if (existing.source_tenant === payload.source_tenant || !existing.source_tenant || !existing.uuid) {
                        db.prepare(`
                            UPDATE vehicles SET plate=?, brand=?, model=?, version=?,
                            year=?, km=?, source_tenant=?, uuid=?, client_id=? WHERE id=?
                        `).run(payload.plate, payload.brand, payload.model, payload.version,
                            payload.year, payload.km, payload.source_tenant, payload.uuid, clientInTarget.id, existing.id);
                    }
                } else {
                    db.prepare(`
                        INSERT INTO vehicles (uuid, client_id, plate, brand, model,
                        version, year, km, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                    `).run(payload.uuid, clientInTarget.id, payload.plate,
                        payload.brand, payload.model, payload.version, payload.year, payload.km,
                        payload.source_tenant, payload.created_at);
                }
            }

            superDb.prepare(`
                UPDATE sync_queue SET status='done', processed_at=CURRENT_TIMESTAMP WHERE id=?
            `).run(job.id);

        } catch (e) {
            superDb.prepare(`
                UPDATE sync_queue SET attempts = attempts + 1, error_message = ?,
                status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END
                WHERE id = ?
            `).run(e.message, job.id);
        }
    }
}

// ── Retry handler for stuck jobs ─────────────────────────────────────────────
function retrySyncJobs() {
    try {
        // Find failed jobs whose error was exactly about missing clients
        const res = superDb.prepare(`
            UPDATE sync_queue 
            SET status = 'pending', attempts = 0
            WHERE status = 'failed' 
              AND error_message = 'Client not yet synced to target'
        `).run();
        if (res.changes > 0) {
            console.log(`[chainSync] Recovered ${res.changes} stuck sync jobs`);
            processSyncQueue();
        }
    } catch (e) {
        console.warn('[chainSync] retry error:', e.message);
    }
}

// ── Start worker ──────────────────────────────────────────────────────────────
function startSyncWorker() {
    // Run queue processing every 30s
    setInterval(() => {
        try { processSyncQueue(); } catch (e) { console.error('[syncWorker]', e.message); }
    }, 30000);

    // Run recovery job every 5 minutes to reset stuck 'failed' jobs
    setInterval(() => {
        retrySyncJobs();
    }, 5 * 60000);

    console.log('[chainSync] Sync worker started (30s interval, 5m recovery)');
}

module.exports = { router, enqueueSyncToChain, startSyncWorker, processSyncQueue };
