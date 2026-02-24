const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'tenants', 'kabul', 'db.sqlite');
const db = new Database(dbPath);

const templates = [
    {
        name: 'Recepción de Vehículo',
        content: 'Hola [apodo], te damos la bienvenida a [taller]. Ya registramos el ingreso de tu [vehiculo]. Te avisaremos en cuanto tengamos el presupuesto listo. Orden de trabajo: #[orden_id].',
        trigger_status: 'Pendiente',
        include_pdf: 0,
        send_email: 1,
        send_whatsapp: 1
    },
    {
        name: 'Presupuesto para Revisión',
        content: 'Hola [apodo], el presupuesto para tu [vehiculo] ya se encuentra disponible para tu revisión. Podés verlo adjunto en este mensaje o desde el portal de clientes. Avisanos si estás de acuerdo para comenzar con el trabajo.',
        trigger_status: 'Presupuestado',
        include_pdf: 1,
        send_email: 1,
        send_whatsapp: 1
    },
    {
        name: 'Trabajo en Marcha',
        content: '¡Hola [apodo]! Te confirmamos que ya aprobaste el presupuesto y nos pusimos manos a la obra con tu [vehiculo]. Estaremos haciendo: [items]. Te avisamos en cuanto esté finalizado.',
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
        send_whatsapp: 1
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

try {
    console.log('--- Reseteando plantillas para KABUL ---');

    db.prepare('DELETE FROM templates').run();
    console.log('✔ Plantillas antiguas eliminadas.');

    const insert = db.prepare(`
        INSERT INTO templates (name, content, trigger_status, include_pdf, send_email, send_whatsapp)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const t of templates) {
        insert.run(t.name, t.content, t.trigger_status, t.include_pdf, t.send_email, t.send_whatsapp);
    }

    console.log(`✔ ${templates.length} plantillas creadas exitosamente.`);
    console.log('--- Proceso completado ---');

} catch (err) {
    console.error('Error durante el reseed:', err);
} finally {
    db.close();
}
