const Database = require('better-sqlite3');
const path = require('path');

const kabulDb = new Database('tenants/kabul/db.sqlite');
const linaresDb = new Database('tenants/linares/db.sqlite');

const vehiclesInKabul = kabulDb.prepare('SELECT v.plate, v.uuid, COUNT(o.id) as order_count FROM vehicles v JOIN orders o ON v.id = o.vehicle_id GROUP BY v.id HAVING order_count > 0').all();

console.log(`Found ${vehiclesInKabul.length} vehicles with orders in kabul`);

for (const vk of vehiclesInKabul) {
    const inLinares = linaresDb.prepare('SELECT id, plate FROM vehicles WHERE uuid = ?').get(vk.uuid);
    if (inLinares) {
        console.log(`MATCH FOUND! Plate: ${vk.plate}, UUID: ${vk.uuid}, Orders in Kabul: ${vk.order_count}`);
        console.log(`  Linares VID: ${inLinares.id}`);
    }
}
