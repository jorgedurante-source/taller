
/**
 * Ensures a service exists in the catalog and updates its price history if needed.
 * @param {import('better-sqlite3').Database} db 
 * @param {Object} item 
 * @param {number|null} userId 
 * @returns {number|null} The service_id
 */
function ensureService(db, item, userId) {
    const { description, labor_price, service_id } = item;
    const labor = parseFloat(labor_price) || 0;

    if (!description || description.trim() === '') return service_id || null;

    let finalServiceId = service_id;
    let service = null;

    // 1. Try to find by ID
    if (finalServiceId) {
        service = db.prepare('SELECT id, name, base_price FROM service_catalog WHERE id = ?').get(finalServiceId);
    }

    // 2. Try to find by name (case insensitive) if not found by ID
    if (!service) {
        service = db.prepare('SELECT id, name, base_price FROM service_catalog WHERE LOWER(name) = ?').get(description.trim().toLowerCase());
    }

    if (!service) {
        // 3. CREATE NEW service if it doesn't exist
        try {
            const res = db.prepare('INSERT INTO service_catalog (name, base_price) VALUES (?, ?)').run(description.trim(), labor);
            finalServiceId = res.lastInsertRowid;

            // Add Price History for new service
            db.prepare(`
                INSERT INTO service_price_history (service_id, old_price, new_price, changed_by_id)
                VALUES (?, NULL, ?, ?)
            `).run(finalServiceId, labor, userId);
        } catch (err) {
            console.error('[serviceManager] Error creating service:', err.message);
        }
    } else {
        // 4. Update existing service price if it changed
        finalServiceId = service.id;
        const oldPrice = parseFloat(service.base_price) || 0;

        if (oldPrice !== labor) {
            try {
                // Update base price in catalog
                db.prepare('UPDATE service_catalog SET base_price = ? WHERE id = ?').run(labor, finalServiceId);

                // Add Price History entry
                db.prepare(`
                    INSERT INTO service_price_history (service_id, old_price, new_price, changed_by_id)
                    VALUES (?, ?, ?, ?)
                `).run(finalServiceId, oldPrice, labor, userId);
            } catch (err) {
                console.error('[serviceManager] Error updating service price:', err.message);
            }
        }
    }

    return finalServiceId;
}

module.exports = { ensureService };
