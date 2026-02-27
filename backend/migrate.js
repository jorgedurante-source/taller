const db = require("better-sqlite3")("tenants/demo/db.sqlite");
try {
    db.exec("ALTER TABLE config ADD COLUMN client_portal_language TEXT DEFAULT 'es'");
    console.log("added properly");
} catch (e) {
    console.log("error", e.message);
}
