const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('tenants/kabul/db.sqlite');
const content = 'Hola [apodo], te damos la bienvenida a [taller]. Ya registramos el ingreso de tu [vehiculo]. Podés seguir el progreso en tiempo real aquí: [link]. Te avisaremos en cuanto tengamos el presupuesto listo. Orden de trabajo: #[orden_id].';

db.prepare("UPDATE templates SET content = ? WHERE name = 'Recepción de Vehículo'").run(content);
console.log('Template updated for kabul');
db.close();
