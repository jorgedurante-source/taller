const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = 'c:/Users/jorge/OneDrive/Documentos/Taller/backend/tenants/kabul/db.sqlite';
const db = new sqlite3(dbPath);
const res = db.prepare("UPDATE config SET mail_provider = 'smtp' WHERE id = 1").run();
console.log('Update result:', res);
const row = db.prepare('SELECT mail_provider FROM config WHERE id = 1').get();
console.log('Current value:', row);
db.close();
