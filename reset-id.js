const Database = require('better-sqlite3');
const db = new Database('crm.sqlite');

// Delete all companies
db.exec("DELETE FROM companies");

// Reset autoincrement
db.exec("DELETE FROM sqlite_sequence WHERE name='companies'");

console.log("✔ ID reset complete. Next ID = 1");
