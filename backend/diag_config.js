const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'tenants/kabul/db.sqlite');
const db = new Database(dbPath);
const info = db.prepare("PRAGMA table_info('config')").all();
console.log('Config info for kabul:', info.map(c => c.name));
db.close();
