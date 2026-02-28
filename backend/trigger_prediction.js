const Database = require('better-sqlite3');
const { recalculateIntervals } = require('./lib/intervalLearner');

const db = new Database('tenants/kabul/db.sqlite');

try {
    const client = db.prepare('SELECT id FROM clients WHERE email = ?').get('sofia.torres17722579613290@test.com');
    if (!client) {
        console.log('Sofia not found');
        process.exit(1);
    }

    const vehicle = db.prepare('SELECT id, km FROM vehicles WHERE client_id = ? LIMIT 1').get(client.id);
    if (!vehicle) {
        console.log('Vehicle not found');
        process.exit(1);
    }

    console.log(`Working with Client: ${client.id}, Vehicle: ${vehicle.id}, Initial KM: ${vehicle.km}`);

    // Insert 3 orders to create a pattern
    // Order 1: 5 months ago, at 5000km
    // Order 2: 2 months ago, at 9000km (interval = 4000km)
    // Current state (Initial KM) is set in seeder? Let's say it's 12000 now.

    const dates = [
        new Date(Date.now() - 150 * 24 * 3600 * 1000).toISOString(), // -150 days
        new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()   // -60 days
    ];
    const kms = [5000, 9000];

    for (let i = 0; i < 2; i++) {
        const res = db.prepare('INSERT INTO orders (client_id, vehicle_id, description, status, delivered_at) VALUES (?, ?, ?, ?, ?)')
            .run(client.id, vehicle.id, 'Prueba de Predicción', 'delivered', dates[i]);

        db.prepare('INSERT INTO order_items (order_id, description, labor_price, subtotal) VALUES (?, ?, ?, ?)')
            .run(res.lastInsertRowid, 'Cambio de Aceite y Filtro', 50, 50);

        // Record KM history for these dates
        db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, recorded_at) VALUES (?, ?, ?)')
            .run(vehicle.id, kms[i], dates[i]);
    }

    // Update current vehicle KM to be closer to next prediction (9000 + 4000 = 13000)
    db.prepare('UPDATE vehicles SET km = ? WHERE id = ?').run(12500, vehicle.id);
    db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, recorded_at) VALUES (?, ?, ?)')
        .run(vehicle.id, 12500, new Date().toISOString());

    console.log('Orders inserted. Recalculating...');
    recalculateIntervals(db, vehicle.id);

    const prediction = db.prepare('SELECT * FROM service_intervals WHERE vehicle_id = ?').get(vehicle.id);
    console.log('PREDICTION RESULT:', prediction);

} catch (err) {
    console.error('ERROR:', err.message);
} finally {
    db.close();
}
