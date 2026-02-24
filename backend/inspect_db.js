const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'tenants/linares/db.sqlite');
try {
    const db = new Database(dbPath);
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get();
    console.log(dbPath, row ? row.sql : "Table not found");
} catch (e) {
    console.error(e.message);
}
