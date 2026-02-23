const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'tenants', 'kabul', 'db.sqlite');
const db = new Database(dbPath);

const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Laura', 'Carlos', 'Elena', 'Miguel', 'Sofia', 'Diego', 'Lucia', 'Ricardo', 'Valentina', 'Gabriel', 'Martina', 'Fernando', 'Camila', 'Roberto', 'Isabel'];
const lastNames = ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Gonzalez', 'Perez', 'Sanchez', 'Romero', 'Torres', 'Fernandez', 'Ruiz', 'Diaz', 'Alvarez', 'Jimenez', 'Moreno', 'Munoz', 'Alonso', 'Gutierrez', 'Castillo', 'Blanco'];
const brands = ['Toyota', 'Ford', 'Chevrolet', 'Volkswagen', 'Honda', 'Fiat', 'Renault', 'Peugeot', 'Nissan', 'Hyundai'];
const models = ['Corolla', 'Fiesta', 'Cruze', 'Golf', 'Civic', 'Cronos', 'Clio', '208', 'Sentra', 'Tucson'];
const orderStatuses = ['Pendiente', 'En proceso', 'Presupuestado', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'];
const paymentStatuses = ['sin_cobrar', 'cobrado', 'parcial'];
const descriptions = ['Cambio de aceite y filtro', 'Revisión técnica general', 'Frenos delanteros', 'Alineación y balanceo', 'Cambio de correa de distribución', 'Reparación de embrague', 'Check engine encendido', 'Ruidos en la suspensión', 'Carga de aire acondicionado', 'Cambio de batería'];

console.log('--- Iniciando carga de datos de prueba para KABUL ---');

try {
    const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    const adminId = adminUser ? adminUser.id : null;

    const insertClient = db.prepare('INSERT INTO clients (first_name, last_name, nickname, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)');
    const insertVehicle = db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, year, km) VALUES (?, ?, ?, ?, ?, ?)');
    const insertOrder = db.prepare('INSERT INTO orders (client_id, vehicle_id, description, status, payment_status, payment_amount, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO order_items (order_id, description, labor_price, parts_price, subtotal) VALUES (?, ?, ?, ?, ?)');

    const transaction = db.transaction(() => {
        const clientIds = [];
        // 1. Insert 50 Clients
        for (let i = 0; i < 50; i++) {
            const first = firstNames[Math.floor(Math.random() * firstNames.length)];
            const last = lastNames[Math.floor(Math.random() * lastNames.length)];
            const res = insertClient.run(
                first,
                last,
                first.toLowerCase() + i,
                '11' + (Math.floor(10000000 + Math.random() * 90000000)),
                `${first.toLowerCase()}.${last.toLowerCase()}${i}@test.com`,
                `Calle Falsa ${100 + i}`
            );
            clientIds.push(res.lastInsertRowid);
        }
        console.log('✔ 50 Clientes insertados.');

        // 2. Insert at least one vehicle per client
        const vehicleIds = [];
        for (const clientId of clientIds) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const model = models[Math.floor(Math.random() * models.length)];
            const plate = (String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                Math.floor(100 + Math.random() * 900)).toUpperCase();

            const res = insertVehicle.run(
                clientId,
                plate,
                brand,
                model,
                2000 + Math.floor(Math.random() * 24),
                Math.floor(Math.random() * 200000)
            );
            vehicleIds.push({ id: res.lastInsertRowid, clientId });
        }
        console.log('✔ 50 Vehículos insertados.');

        // 3. Insert 80 Orders
        for (let i = 0; i < 80; i++) {
            const v = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
            const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
            const payStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
            const desc = descriptions[Math.floor(Math.random() * descriptions.length)];

            // Generate total based on items later, but we need a placeholder for payment_amount if cobrado
            const res = insertOrder.run(
                v.clientId,
                v.id,
                desc,
                status,
                payStatus,
                0, // will update or leave as 0
                adminId
            );
            const orderId = res.lastInsertRowid;

            // 4. Insert 1-3 items per order
            let orderTotal = 0;
            const numItems = 1 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numItems; j++) {
                const labor = Math.floor(5000 + Math.random() * 20000);
                const parts = Math.floor(Math.random() * 50000);
                const subtotal = labor + parts;
                orderTotal += subtotal;
                insertItem.run(orderId, descriptions[Math.floor(Math.random() * descriptions.length)], labor, parts, subtotal);
            }

            // Update order payment_amount if it's 'cobrado' or 'parcial'
            if (payStatus === 'cobrado') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(orderTotal, orderId);
            } else if (payStatus === 'parcial') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(Math.floor(orderTotal / 2), orderId);
            }
        }
        console.log('✔ 80 Órdenes insertadas con sus respectivos items.');
    });

    transaction();
    console.log('--- Carga completada con éxito ---');

} catch (error) {
    console.error('Error durante la carga:', error);
} finally {
    db.close();
}
