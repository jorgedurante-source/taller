const bcrypt = require('bcrypt');

const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Laura', 'Carlos', 'Elena', 'Miguel', 'Sofia', 'Diego', 'Lucia', 'Ricardo', 'Valentina', 'Gabriel', 'Martina', 'Fernando', 'Camila', 'Roberto', 'Isabel'];
const lastNames = ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Gonzalez', 'Perez', 'Sanchez', 'Romero', 'Torres', 'Fernandez', 'Ruiz', 'Diaz', 'Alvarez', 'Jimenez', 'Moreno', 'Munoz', 'Alonso', 'Gutierrez', 'Castillo', 'Blanco'];
const brands = ['Toyota', 'Ford', 'Chevrolet', 'Volkswagen', 'Honda', 'Fiat', 'Renault', 'Peugeot', 'Nissan', 'Hyundai', 'Jeep', 'Audi', 'BMW', 'Mercedes-Benz'];
const models = ['Corolla', 'Fiesta', 'Cruze', 'Golf', 'Civic', 'Cronos', 'Clio', '208', 'Sentra', 'Tucson', 'Hilux', 'Ranger', 'Amarok', 'Onix', 'Polo', 'Tracker', 'Compass', 'A3', '320i', 'C200'];

const carReferenceList = [
    { brand: 'Toyota', model: 'Hilux', version: 'SRV 4x4' },
    { brand: 'Toyota', model: 'Hilux', version: 'SRX' },
    { brand: 'Toyota', model: 'Hilux', version: 'DX' },
    { brand: 'Toyota', model: 'Corolla', version: 'XEI' },
    { brand: 'Toyota', model: 'Corolla', version: 'SEG Hybrid' },
    { brand: 'Toyota', model: 'Etios', version: 'XLS' },
    { brand: 'Toyota', model: 'Yaris', version: 'XLS Pack' },
    { brand: 'Ford', model: 'Ranger', version: 'XLT' },
    { brand: 'Ford', model: 'Ranger', version: 'Limited' },
    { brand: 'Ford', model: 'F-150', version: 'Lariat' },
    { brand: 'Ford', model: 'EcoSport', version: 'Titanium' },
    { brand: 'Ford', model: 'Focus', version: 'Titanum' },
    { brand: 'Volkswagen', model: 'Amarok', version: 'V6 Extreme' },
    { brand: 'Volkswagen', model: 'Amarok', version: 'Highline' },
    { brand: 'Volkswagen', model: 'Golf', version: 'GTI' },
    { brand: 'Volkswagen', model: 'Golf', version: 'Highline' },
    { brand: 'Volkswagen', model: 'Polo', version: 'Highline' },
    { brand: 'Volkswagen', model: 'Vento', version: 'GLI' },
    { brand: 'Chevrolet', model: 'Onix', version: 'Premier' },
    { brand: 'Chevrolet', model: 'Cruze', version: 'LTZ' },
    { brand: 'Chevrolet', model: 'Tracker', version: 'Premier' },
    { brand: 'Chevrolet', model: 'S10', version: 'High Country' },
    { brand: 'Fiat', model: 'Cronos', version: 'Precision' },
    { brand: 'Fiat', model: 'Toro', version: 'Volcano' },
    { brand: 'Fiat', model: 'Strada', version: 'Volcano' },
    { brand: 'Peugeot', model: '208', version: 'Feline' },
    { brand: 'Peugeot', model: '3008', version: 'GT Pack' },
    { brand: 'Renault', model: 'Alaskan', version: 'Iconic' },
    { brand: 'Renault', model: 'Sandero', version: 'Stepway' },
    { brand: 'Nissan', model: 'Frontier', version: 'PRO-4X' },
    { brand: 'Nissan', model: 'Kicks', version: 'Exclusive' },
    { brand: 'Jeep', model: 'Compass', version: 'Limited' },
    { brand: 'Jeep', model: 'Renegade', version: 'Trailhawk' }
];
const orderStatuses = ['pending', 'appointment', 'quoted', 'approved', 'ready', 'delivered', 'cancelled'];
const paymentStatuses = ['unpaid', 'paid', 'partial'];
const descriptions = ['Cambio de aceite y filtro', 'Inspección técnica general', 'Frenos delanteros', 'Alineación y balanceo', 'Reemplazo de correa de distribución', 'Reparación de embrague', 'Luz de check engine encendida', 'Ruido en la suspensión', 'Recarga de aire acondicionado', 'Reemplazo de batería'];

const defaultTemplates = [
    {
        name: 'Recepción de Vehículo',
        content: 'Hola [apodo], bienvenido a [taller]. Registramos el ingreso de tu [vehiculo]. Te avisaremos en cuanto el presupuesto esté listo. Orden de trabajo: #[orden_id]. Seguí el estado aquí: [link]\n\n[datos_contacto_taller]',
        trigger_status: 'pending',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Turno Asignado',
        content: 'Hola [apodo], te confirmamos que tu turno para el [vehiculo] en [taller] fue programado para el [turno_fecha]. ¡Te esperamos! Podés seguir el estado de tu orden aquí: [link]\n\n[datos_contacto_taller]\n\nSaludos, [usuario]',
        trigger_status: 'appointment',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Presupuesto para Revisión',
        content: 'Hola [apodo], ya está disponible el presupuesto de tu [vehiculo] para tu revisión. Podés verlo adjunto a este mensaje o desde el portal de clientes aquí: [link]. Avisanos si estás de acuerdo para comenzar el trabajo.\n\n[datos_contacto_taller]',
        trigger_status: 'quoted',
        include_pdf: 1,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Trabajo en Progreso',
        content: '¡Hola [apodo]! Te confirmamos que aprobaste el presupuesto y comenzamos a trabajar en tu [vehiculo]. Realizaremos: [servicios]. Seguí el avance en vivo: [link]\n\nCualquier duda, nuestro contacto es:\n[datos_contacto_taller]',
        trigger_status: 'approved',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Vehículo Listo',
        content: '¡Buenas noticias [apodo]! Tu [vehiculo] ya está listo para retirar. Podés pasar por [taller] en nuestros horarios de atención. ¡Te esperamos!\n\n[datos_contacto_taller]',
        trigger_status: 'ready',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Agradecimiento y Entrega',
        content: 'Gracias [apodo] por confiar en [taller]. Acabamos de registrar la entrega de tu [vehiculo] con [km] km. Esperamos que disfrutes el viaje y cualquier duda quedamos a tu disposición.\n\n[datos_contacto_taller]\n\nSaludos, [usuario]',
        trigger_status: 'delivered',
        include_pdf: 1,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Seguimiento Preventivo',
        content: 'Hola [apodo], hace unos meses realizamos el servicio de [servicios] en tu [vehiculo] (registrado con [km] km). Te escribimos de [taller] para recordarte que podría ser un buen momento para una revisión preventiva para asegurar que todo siga funcionando perfecto. ¡Te esperamos!\n\n[datos_contacto_taller]',
        trigger_status: 'reminder',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Envío de Documento',
        content: 'Hola [apodo], te enviamos el documento solicitado relacionado con tu [vehiculo] de [taller]. Quedamos a tu disposición por cualquier consulta.\n\n[datos_contacto_taller]',
        trigger_status: null,
        include_pdf: 1,
        send_email: 1,
        send_whatsapp: 0
    },
    {
        name: 'Consulta de Repuesto (Proveedor)',
        content: 'Hola [proveedor], te consultamos por el presupuesto de: [repuesto] para el vehículo [vehiculo].\n\nQuedamos a la espera de tu respuesta.\n\n[datos_contacto_taller]\n\nSaludos, [usuario]',
        trigger_status: 'supplier_inquiry',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 0
    }
];

function seedWorkshop(db) {
    const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    const adminId = adminUser ? adminUser.id : null;

    // Seed vehicle references first
    seedVehicleReference(db);

    const insertClient = db.prepare('INSERT INTO clients (first_name, last_name, nickname, phone, email, address, password) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertVehicle = db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, version, year, km) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertOrder = db.prepare('INSERT INTO orders (client_id, vehicle_id, description, status, payment_status, payment_amount, created_at, updated_at, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO order_items (order_id, description, labor_price, parts_price, parts_profit, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
    const insertService = db.prepare('INSERT INTO service_catalog (name, base_price) VALUES (?, ?)');

    const transaction = db.transaction(() => {
        const clientIds = [];
        // 1. Insert 20 Clients
        const timestamp = Date.now();
        const hashedClientPass = bcrypt.hashSync('123456', 10);
        for (let i = 0; i < 20; i++) {
            const first = firstNames[Math.floor(Math.random() * firstNames.length)];
            const last = lastNames[Math.floor(Math.random() * lastNames.length)];
            const res = insertClient.run(
                first,
                last,
                first.toLowerCase() + timestamp + i,
                '11' + (Math.floor(10000000 + Math.random() * 90000000)),
                `${first.toLowerCase()}.${last.toLowerCase()}${timestamp}${i}@test.com`,
                `Calle Falsa ${100 + i}`,
                hashedClientPass
            );
            clientIds.push(res.lastInsertRowid);
        }

        // 2. Insert one vehicle per client
        const vehicleIds = [];
        for (const clientId of clientIds) {
            const carRef = carReferenceList[Math.floor(Math.random() * carReferenceList.length)];
            const brand = carRef.brand;
            const model = carRef.model;
            const version = carRef.version;
            const plate = (String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                Math.floor(100 + Math.random() * 900)).toUpperCase() + '-' + clientId;

            const initialKm = Math.floor(Math.random() * 50000); // Start with lower KM so we can grow
            const res = insertVehicle.run(
                clientId,
                plate,
                brand,
                model,
                version,
                2000 + Math.floor(Math.random() * 24),
                initialKm
            );
            const vehicleId = res.lastInsertRowid;
            vehicleIds.push({ id: vehicleId, clientId, currentKm: initialKm });

            // Create multiple history entries to simulate visits
            const numVisits = 1 + Math.floor(Math.random() * 3); // 1 to 3 visits
            let lastKm = initialKm;
            let lastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365); // Start 1 year ago

            for (let v = 0; v < numVisits; v++) {
                db.prepare('INSERT INTO vehicle_km_history (vehicle_id, km, notes, recorded_at) VALUES (?, ?, ?, ?)').run(
                    vehicleId,
                    lastKm,
                    v === 0 ? 'Registro inicial' : `Mantenimiento preventivo ${v}`,
                    lastDate.toISOString()
                );

                // Advance KM and Date for next visit
                lastKm += 7000 + Math.floor(Math.random() * 8000); // 7k to 15k km between visits
                lastDate = new Date(lastDate.getTime() + 1000 * 60 * 60 * 24 * 90); // ~3 months later
            }
            // Update vehicle current KM to the last visit
            db.prepare('UPDATE vehicles SET km = ? WHERE id = ?').run(lastKm, vehicleId);
        }

        // 3. Insert 10 Services (only if catalog is small)
        const existingServices = db.prepare("SELECT COUNT(*) as c FROM service_catalog").get().c;
        if (existingServices < 5) {
            const serviceNames = ['Cambio de Aceite', 'Frenos', 'Alineación', 'Balanceo', 'Escaneo Computarizado', 'Carga de Aire', 'Revisión General', 'Limpieza de Inyectores', 'Cambio de Batería', 'Suspensión'];
            for (const sName of serviceNames) {
                insertService.run(sName, Math.floor(5000 + Math.random() * 25000));
            }
        }

        // 4. Insert 50 Orders with historical dates for reports
        for (let i = 0; i < 50; i++) {
            const v = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
            const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
            const payStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
            const desc = descriptions[Math.floor(Math.random() * descriptions.length)];

            // Random date in the last 6 months
            const monthsAgo = Math.floor(Math.random() * 6);
            const daysAgo = Math.floor(Math.random() * 28);
            const orderDate = new Date();
            orderDate.setMonth(orderDate.getMonth() - monthsAgo);
            orderDate.setDate(orderDate.getDate() - daysAgo);
            const dateStr = orderDate.toISOString();

            const res = insertOrder.run(
                v.clientId,
                v.id,
                desc,
                status,
                payStatus,
                0,
                dateStr,
                dateStr,
                adminId
            );
            const orderId = res.lastInsertRowid;

            let orderTotal = 0;
            const numItems = 1 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numItems; j++) {
                const labor = Math.floor(8000 + Math.random() * 30000);
                const parts = Math.floor(Math.random() * 60000);
                const profit = Math.floor(parts * 0.3); // 30% profit markup
                const subtotal = labor + parts + profit;
                orderTotal += subtotal;
                insertItem.run(orderId, descriptions[Math.floor(Math.random() * descriptions.length)], labor, parts, profit, subtotal);
            }

            if (payStatus === 'paid') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(orderTotal, orderId);
            } else if (payStatus === 'partial') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(Math.floor(orderTotal / 2), orderId);
            }
        }

        // 5. Insert 5 Suppliers (only if none exist)
        const supplierCount = db.prepare("SELECT COUNT(*) as c FROM suppliers").get().c;
        if (supplierCount === 0) {
            const suppliersArr = [
                { name: 'Repuestos Directos', email: 'ventas@repuestosdirectos.com', phone: '11 4567-8901', notes: 'Especialistas en Ford y Chevrolet' },
                { name: 'Todo Frenos', email: 'contacto@todofrenos.com', phone: '11 2345-6789', notes: 'Mejores precios en pastillas y discos' },
                { name: 'Embragues del Sur', email: 'info@embraguessur.com', phone: '11 9876-5432', notes: 'Entrega en el día' },
                { name: 'Baterías Lucas', email: 'lucas@baterias.com', phone: '11 3210-4567', notes: 'Garantía oficial' },
                { name: 'General Repuestos', email: 'warnes@repuestos.com', phone: '11 5555-1234', notes: 'Stock integral Warnes' }
            ];

            const insertSupplier = db.prepare('INSERT INTO suppliers (name, email, phone, notes) VALUES (?, ?, ?, ?)');
            for (const s of suppliersArr) {
                insertSupplier.run(s.name, s.email, s.phone, s.notes);
            }
        }
    });

    transaction();
}

function clearOperationalData(db) {
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT IN ('config', 'users', 'roles', 'templates')
    `).all().map(t => t.name);

    db.pragma('foreign_keys = OFF');
    try {
        const transaction = db.transaction(() => {
            for (const table of tables) {
                const res = db.prepare(`DELETE FROM "${table}"`).run();
                if (res.changes > 0) console.log(`[clear] Wiped table "${table}": Removed ${res.changes} rows`);
            }
            try { db.prepare("DELETE FROM sqlite_sequence").run(); } catch (e) { }
        });
        transaction();
        console.log(`[clear] Operational data wiped successfully (${tables.length} tables processed)`);
    } finally {
        db.pragma('foreign_keys = ON');
    }
}

function clearUsersAndRoles(db) {
    db.pragma('foreign_keys = OFF');
    try {
        const transaction = db.transaction(() => {
            // Delete all except admin
            const resUsers = db.prepare("DELETE FROM users WHERE username != 'admin'").run();
            // Delete roles except Admin
            const resRoles = db.prepare("DELETE FROM roles WHERE name != 'Admin'").run();
            console.log(`[clear] Wiped users (${resUsers.changes} rows) and roles (${resRoles.changes} rows)`);
        });
        transaction();
    } finally {
        db.pragma('foreign_keys = ON');
    }
}

function seedUsers(db) {
    const transaction = db.transaction(() => {
        // Find existing technician role or create it
        let mechanicRole = db.prepare("SELECT id FROM roles WHERE name = 'Mecánico'").get();
        if (!mechanicRole) {
            const perms = ['dashboard', 'clients', 'vehicles', 'orders', 'income', 'reports', 'settings', 'users', 'roles', 'reminders', 'appointments', 'suppliers'];
            const res = db.prepare("INSERT INTO roles (name, permissions) VALUES (?, ?)").run('Mecánico', JSON.stringify(perms));
            mechanicRole = { id: res.lastInsertRowid };
        }

        // Ensure user doesn't already exist
        const existing = db.prepare("SELECT id FROM users WHERE username = 'mecanico'").get();
        if (!existing) {
            const hashed = bcrypt.hashSync('mecanico', 10);
            db.prepare("INSERT INTO users (username, password, first_name, last_name, language, role_id, role) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
                'mecanico', hashed, 'Técnico', 'Mecánico', 'es', mechanicRole.id, 'technician'
            );
            console.log('[seeder] Seeded mechanic user.');
        }
    });
    transaction();
}

function reseedTemplates(db) {
    const transaction = db.transaction(() => {
        db.prepare("DELETE FROM templates").run();

        const insertStmt = db.prepare(`
            INSERT INTO templates (name, content, trigger_status, include_pdf, send_email, send_whatsapp) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const t of defaultTemplates) {
            insertStmt.run(t.name, t.content, t.trigger_status, t.include_pdf, t.send_email, t.send_whatsapp);
        }
    });
    transaction();
}

function seedVehicleReference(db) {
    const transaction = db.transaction(() => {
        const count = db.prepare("SELECT COUNT(*) as c FROM vehicle_reference").get().c;
        if (count === 0) {
            const insert = db.prepare('INSERT OR IGNORE INTO vehicle_reference (brand, model, version) VALUES (?, ?, ?)');
            for (const car of carReferenceList) {
                insert.run(car.brand, car.model, car.version);
            }
            console.log(`[seeder] Seeded ${carReferenceList.length} vehicle references.`);
        }
    });
    transaction();
}

module.exports = { seedWorkshop, clearOperationalData, clearUsersAndRoles, seedUsers, reseedTemplates, seedVehicleReference };
