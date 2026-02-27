const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Laura', 'Carlos', 'Elena', 'Miguel', 'Sofia', 'Diego', 'Lucia', 'Ricardo', 'Valentina', 'Gabriel', 'Martina', 'Fernando', 'Camila', 'Roberto', 'Isabel'];
const lastNames = ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Gonzalez', 'Perez', 'Sanchez', 'Romero', 'Torres', 'Fernandez', 'Ruiz', 'Diaz', 'Alvarez', 'Jimenez', 'Moreno', 'Munoz', 'Alonso', 'Gutierrez', 'Castillo', 'Blanco'];
const brands = ['Toyota', 'Ford', 'Chevrolet', 'Volkswagen', 'Honda', 'Fiat', 'Renault', 'Peugeot', 'Nissan', 'Hyundai'];
const models = ['Corolla', 'Fiesta', 'Cruze', 'Golf', 'Civic', 'Cronos', 'Clio', '208', 'Sentra', 'Tucson'];
const orderStatuses = ['pending', 'appointment', 'quoted', 'approved', 'ready', 'delivered', 'cancelled'];
const paymentStatuses = ['unpaid', 'paid', 'partial'];
const descriptions = ['Cambio de aceite y filtro', 'Inspección técnica general', 'Frenos delanteros', 'Alineación y balanceo', 'Reemplazo de correa de distribución', 'Reparación de embrague', 'Luz de check engine encendida', 'Ruido en la suspensión', 'Recarga de aire acondicionado', 'Reemplazo de batería'];

function seedWorkshop(db) {
    const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    const adminId = adminUser ? adminUser.id : null;

    const insertClient = db.prepare('INSERT INTO clients (first_name, last_name, nickname, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)');
    const insertVehicle = db.prepare('INSERT INTO vehicles (client_id, plate, brand, model, year, km) VALUES (?, ?, ?, ?, ?, ?)');
    const insertOrder = db.prepare('INSERT INTO orders (client_id, vehicle_id, description, status, payment_status, payment_amount, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO order_items (order_id, description, labor_price, parts_price, subtotal) VALUES (?, ?, ?, ?, ?)');
    const insertService = db.prepare('INSERT INTO service_catalog (name, base_price) VALUES (?, ?)');

    const transaction = db.transaction(() => {
        const clientIds = [];
        // 1. Insert 20 Clients
        for (let i = 0; i < 20; i++) {
            const first = firstNames[Math.floor(Math.random() * firstNames.length)];
            const last = lastNames[Math.floor(Math.random() * lastNames.length)];
            const res = insertClient.run(
                first,
                last,
                first.toLowerCase() + Date.now() + i,
                '11' + (Math.floor(10000000 + Math.random() * 90000000)),
                `${first.toLowerCase()}.${last.toLowerCase()}${Date.now()}${i}@test.com`,
                `Calle Falsa ${100 + i}`
            );
            clientIds.push(res.lastInsertRowid);
        }

        // 2. Insert one vehicle per client
        const vehicleIds = [];
        for (const clientId of clientIds) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const model = models[Math.floor(Math.random() * models.length)];
            const plate = (String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                Math.floor(100 + Math.random() * 900)).toUpperCase() + '-' + clientId;

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

        // 3. Insert 10 Services
        const serviceNames = ['Cambio de Aceite', 'Frenos', 'Alineación', 'Balanceo', 'Escaneo Computarizado', 'Carga de Aire', 'Revisión General', 'Limpieza de Inyectores', 'Cambio de Batería', 'Suspensión'];
        for (const sName of serviceNames) {
            insertService.run(
                sName,
                Math.floor(5000 + Math.random() * 25000)
            );
        }

        // 4. Insert 30 Orders
        for (let i = 0; i < 30; i++) {
            const v = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
            const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
            const payStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
            const desc = descriptions[Math.floor(Math.random() * descriptions.length)];

            const res = insertOrder.run(
                v.clientId,
                v.id,
                desc,
                status,
                payStatus,
                0,
                adminId
            );
            const orderId = res.lastInsertRowid;

            let orderTotal = 0;
            const numItems = 1 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numItems; j++) {
                const labor = Math.floor(5000 + Math.random() * 20000);
                const parts = Math.floor(Math.random() * 50000);
                const subtotal = labor + parts;
                orderTotal += subtotal;
                insertItem.run(orderId, descriptions[Math.floor(Math.random() * descriptions.length)], labor, parts, subtotal);
            }

            if (payStatus === 'paid') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(orderTotal, orderId);
            } else if (payStatus === 'partial') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(Math.floor(orderTotal / 2), orderId);
            }
        }

        // 5. Insert 5 Suppliers
        const suppliers = [
            { name: 'Repuestos Directos', email: 'ventas@repuestosdirectos.com', phone: '11 4567-8901', notes: 'Especialistas en Ford y Chevrolet' },
            { name: 'Todo Frenos', email: 'contacto@todofrenos.com', phone: '11 2345-6789', notes: 'Mejores precios en pastillas y discos' },
            { name: 'Embragues del Sur', email: 'info@embraguessur.com', phone: '11 9876-5432', notes: 'Entrega en el día' },
            { name: 'Baterías Lucas', email: 'lucas@baterias.com', phone: '11 3210-4567', notes: 'Garantía oficial' },
            { name: 'General Repuestos', email: 'warnes@repuestos.com', phone: '11 5555-1234', notes: 'Stock integral Warnes' }
        ];

        const insertSupplier = db.prepare('INSERT INTO suppliers (name, email, phone, notes) VALUES (?, ?, ?, ?)');
        for (const s of suppliers) {
            insertSupplier.run(s.name, s.email, s.phone, s.notes);
        }
    });

    transaction();
}

function clearWorkshop(db) {
    // 1. Identify all tables EXCEPT config and internal ones
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT IN ('config', 'users', 'roles')
    `).all().map(t => t.name);

    // 2. Disable foreign keys OUTSIDE the transaction for it to take effect
    db.pragma('foreign_keys = OFF');

    try {
        const transaction = db.transaction(() => {
            for (const table of tables) {
                const res = db.prepare(`DELETE FROM "${table}"`).run();
                if (res.changes > 0) console.log(`[clear] Wiped table "${table}": Removed ${res.changes} rows`);
            }
            // Also reset all sequences
            try { db.prepare("DELETE FROM sqlite_sequence").run(); } catch (e) { }
        });
        transaction();
        console.log(`[clear] Workshop database wiped successfully (${tables.length} tables processed)`);
    } finally {
        db.pragma('foreign_keys = ON');
    }
}

function reseedTemplates(db) {
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


module.exports = { seedWorkshop, clearWorkshop, reseedTemplates };
