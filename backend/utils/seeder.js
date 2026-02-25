const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Laura', 'Carlos', 'Elena', 'Miguel', 'Sofia', 'Diego', 'Lucia', 'Ricardo', 'Valentina', 'Gabriel', 'Martina', 'Fernando', 'Camila', 'Roberto', 'Isabel'];
const lastNames = ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Gonzalez', 'Perez', 'Sanchez', 'Romero', 'Torres', 'Fernandez', 'Ruiz', 'Diaz', 'Alvarez', 'Jimenez', 'Moreno', 'Munoz', 'Alonso', 'Gutierrez', 'Castillo', 'Blanco'];
const brands = ['Toyota', 'Ford', 'Chevrolet', 'Volkswagen', 'Honda', 'Fiat', 'Renault', 'Peugeot', 'Nissan', 'Hyundai'];
const models = ['Corolla', 'Fiesta', 'Cruze', 'Golf', 'Civic', 'Cronos', 'Clio', '208', 'Sentra', 'Tucson'];
const orderStatuses = ['Pendiente', 'Turno asignado', 'En proceso', 'Presupuestado', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'];
const paymentStatuses = ['sin_cobrar', 'cobrado', 'parcial'];
const descriptions = ['Cambio de aceite y filtro', 'Revisión técnica general', 'Frenos delanteros', 'Alineación y balanceo', 'Cambio de correa de distribución', 'Reparación de embrague', 'Check engine encendido', 'Ruidos en la suspensión', 'Carga de aire acondicionado', 'Cambio de batería'];

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
        const serviceNames = ['Cambio de Aceite', 'Frenos', 'Alineación', 'Balanceo', 'Escaneo Computarizado', 'Carga de AC', 'Revisión General', 'Limpieza de Inyectores', 'Cambio de Batería', 'Suspensión'];
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

            if (payStatus === 'cobrado') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(orderTotal, orderId);
            } else if (payStatus === 'parcial') {
                db.prepare('UPDATE orders SET payment_amount = ? WHERE id = ?').run(Math.floor(orderTotal / 2), orderId);
            }
        }
    });

    transaction();
}

function clearWorkshop(db) {
    const transaction = db.transaction(() => {
        db.prepare("DELETE FROM order_history").run();
        db.prepare("DELETE FROM order_items").run();
        db.prepare("DELETE FROM orders").run();
        db.prepare("DELETE FROM vehicle_km_history").run();
        db.prepare("DELETE FROM vehicles").run();
        db.prepare("DELETE FROM clients").run();
        db.prepare("DELETE FROM service_catalog").run();
        db.prepare("DELETE FROM budgets").run();
    });
    transaction();
}

function reseedTemplates(db) {
    const defaultTemplates = [
        {
            name: 'Recepción de Vehículo',
            content: 'Hola [apodo], te damos la bienvenida a [taller]. Ya registramos el ingreso de tu [vehiculo]. Te avisaremos en cuanto tengamos el presupuesto listo. Orden de trabajo: #[orden_id]. Seguí el estado acá: [link]',
            trigger_status: 'Pendiente',
            include_pdf: 0,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Turno Asignado',
            content: 'Hola [apodo], te confirmamos que tu turno para el [vehiculo] en [taller] fue agendado para el [turno_fecha]. ¡Te esperamos! Podés seguir el estado de tu orden aquí: [link]\n\nSaludos,\n[usuario]',
            trigger_status: 'Turno asignado',
            include_pdf: 0,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Presupuesto para Revisión',
            content: 'Hola [apodo], el presupuesto para tu [vehiculo] ya se encuentra disponible para tu revisión. Podés verlo adjunto en este mensaje o desde el portal de clientes aquí: [link]. Avisanos si estás de acuerdo para comenzar con el trabajo.',
            trigger_status: 'Presupuestado',
            include_pdf: 1,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Trabajo en Marcha',
            content: '¡Hola [apodo]! Te confirmamos que ya aprobaste el presupuesto y nos pusimos manos a la obra con tu [vehiculo]. Estaremos haciendo: [items]. Seguí el avance en vivo: [link]',
            trigger_status: 'Aprobado',
            include_pdf: 0,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Vehículo Listo',
            content: '¡Buenas noticias [apodo]! Tu [vehiculo] ya está listo para ser retirado. Podés pasar por [taller] en nuestros horarios de atención. ¡Te esperamos!',
            trigger_status: 'Listo para entrega',
            include_pdf: 0,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Agradecimiento y Entrega',
            content: 'Muchas gracias [apodo] por confiar en [taller]. Acabamos de registrar la entrega de tu [vehiculo] con [km] km. Esperamos que disfrutes del andar y cualquier duda estamos a tu disposición.',
            trigger_status: 'Entregado',
            include_pdf: 1,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Seguimiento Preventivo',
            content: 'Hola [apodo], hace unos meses realizamos el servicio de [items] en tu [vehiculo] (registrado con [km] km). Te escribimos de [taller] para recordarte que podría ser un buen momento para una revisión preventiva y asegurar que todo siga funcionando perfecto. ¡Te esperamos!',
            trigger_status: 'Recordatorio',
            include_pdf: 0,
            send_email: 1,
            send_whatsapp: 0
        },
        {
            name: 'Envío de Documento',
            content: 'Hola [apodo], te enviamos adjunto el documento solicitado relacionado con tu [vehiculo] desde [taller]. Quedamos a tu disposición por cualquier consulta.',
            trigger_status: null,
            include_pdf: 1,
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
