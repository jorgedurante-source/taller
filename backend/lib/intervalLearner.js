/**
 * intervalLearner.js
 * Analyzes a vehicle's order history and calculates/updates
 * predicted service intervals in the service_intervals table.
 */

function recalculateIntervals(db, vehicleId) {
    try {
        // 1. Get all unique services ever done on this vehicle (delivered orders only)
        const services = db.prepare(`
            SELECT DISTINCT oi.description
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.vehicle_id = ? AND o.status = 'delivered'
        `).all(vehicleId);

        for (const svc of services) {
            // 2. Get all occurrences of this service with km and date
            // We use the vehicle_km_history to find the mileage recorded at the time of the order
            const occurrences = db.prepare(`
                SELECT o.delivered_at, 
                    (SELECT kh.km FROM vehicle_km_history kh 
                     WHERE kh.vehicle_id = v.id AND kh.recorded_at <= o.delivered_at 
                     ORDER BY kh.recorded_at DESC LIMIT 1) as km_at_delivery
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE o.vehicle_id = ? AND oi.description = ? AND o.status = 'delivered'
                ORDER BY o.delivered_at ASC
            `).all(vehicleId, svc.description);

            if (occurrences.length === 0) continue;

            const last = occurrences[occurrences.length - 1];

            if (occurrences.length < 2) {
                // Not enough data to predict — store with confidence 0
                db.prepare(`
                    INSERT INTO service_intervals
                        (vehicle_id, service_description, last_done_at, last_done_km, confidence)
                    VALUES (?, ?, ?, ?, 0)
                    ON CONFLICT(vehicle_id, service_description)
                    DO UPDATE SET
                        last_done_at = excluded.last_done_at,
                        last_done_km = excluded.last_done_km,
                        confidence = 0,
                        updated_at = CURRENT_TIMESTAMP
                `).run(vehicleId, svc.description, last.delivered_at, last.km_at_delivery);
                continue;
            }

            // 3. Calculate intervals between consecutive occurrences
            const kmIntervals = [];
            const dayIntervals = [];

            for (let i = 1; i < occurrences.length; i++) {
                const prev = occurrences[i - 1];
                const curr = occurrences[i];

                if (curr.km_at_delivery && prev.km_at_delivery) {
                    const diff = curr.km_at_delivery - prev.km_at_delivery;
                    if (diff > 0) kmIntervals.push(diff);
                }
                if (curr.delivered_at && prev.delivered_at) {
                    const days = Math.round(
                        (new Date(curr.delivered_at) - new Date(prev.delivered_at)) / 86400000
                    );
                    if (days > 0) dayIntervals.push(days);
                }
            }

            const avgKm = kmIntervals.length
                ? Math.round(kmIntervals.reduce((a, b) => a + b, 0) / kmIntervals.length)
                : null;
            const avgDays = dayIntervals.length
                ? Math.round(dayIntervals.reduce((a, b) => a + b, 0) / dayIntervals.length)
                : null;

            const confidence = Math.min(occurrences.length * 25, 100);

            // 4. Calculate predictions
            let predictedNextDate = null;
            let predictedNextKm = null;

            if (avgDays && last.delivered_at) {
                const d = new Date(last.delivered_at);
                d.setDate(d.getDate() + avgDays);
                predictedNextDate = d.toISOString().split('T')[0];
            }
            if (avgKm && last.km_at_delivery) {
                predictedNextKm = last.km_at_delivery + avgKm;
            }

            // 5. Upsert
            db.prepare(`
                INSERT INTO service_intervals
                    (vehicle_id, service_description, last_done_at, last_done_km,
                     avg_km_interval, avg_day_interval, predicted_next_date,
                     predicted_next_km, confidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(vehicle_id, service_description)
                DO UPDATE SET
                    last_done_at = excluded.last_done_at,
                    last_done_km = excluded.last_done_km,
                    avg_km_interval = excluded.avg_km_interval,
                    avg_day_interval = excluded.avg_day_interval,
                    predicted_next_date = excluded.predicted_next_date,
                    predicted_next_km = excluded.predicted_next_km,
                    confidence = excluded.confidence,
                    updated_at = CURRENT_TIMESTAMP
            `).run(
                vehicleId, svc.description,
                last.delivered_at, last.km_at_delivery,
                avgKm, avgDays,
                predictedNextDate, predictedNextKm,
                confidence
            );
        }
    } catch (err) {
        console.error(`[intervalLearner] Error for vehicle ${vehicleId}:`, err.message);
    }
}

module.exports = { recalculateIntervals };
