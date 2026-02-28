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
        if (!member) return;

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
    } catch (e) {
        console.warn('[chainSync] enqueue error:', e.message);
    }
}

// ── Process sync queue (called by worker) ────────────────────────────────────
function processSyncQueue() {
    const pending = superDb.prepare(`
        SELECT * FROM sync_queue
        WHERE status = 'pending' AND attempts < 3
        ORDER BY created_at ASC LIMIT 50
    `).all();

    for (const job of pending) {
        try {
            const payload = JSON.parse(job.payload);
            const db = getDb(job.target_slug);

            if (job.operation === 'upsert_client') {
                const existing = db.prepare('SELECT id FROM clients WHERE uuid = ?').get(payload.uuid);
                if (existing) {
                    // Only update if source_tenant owns this client
                    db.prepare(`
                        UPDATE clients SET first_name=?, last_name=?, email=?, phone=?,
                        address=?, notes=?, nickname=? WHERE uuid=? AND source_tenant=?
                    `).run(payload.first_name, payload.last_name, payload.email, payload.phone,
                        payload.address, payload.notes, payload.nickname,
                        payload.uuid, payload.source_tenant);
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
                const existing = db.prepare('SELECT id FROM vehicles WHERE uuid = ?').get(payload.uuid);
                if (existing) {
                    db.prepare(`
                        UPDATE vehicles SET plate=?, brand=?, model=?, version=?,
                        year=?, source_tenant=? WHERE uuid=?
                    `).run(payload.plate, payload.brand, payload.model, payload.version,
                        payload.year, payload.source_tenant, payload.uuid);
                } else {
                    db.prepare(`
                        INSERT INTO vehicles (uuid, client_id, plate, brand, model,
                        version, year, source_tenant, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?)
                    `).run(payload.uuid, clientInTarget.id, payload.plate,
                        payload.brand, payload.model, payload.version, payload.year,
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

// ── Start worker ──────────────────────────────────────────────────────────────
function startSyncWorker() {
    setInterval(() => {
        try { processSyncQueue(); } catch (e) { console.error('[syncWorker]', e.message); }
    }, 30000);
    console.log('[chainSync] Sync worker started (30s interval)');
}

module.exports = { router, enqueueSyncToChain, startSyncWorker, processSyncQueue };
