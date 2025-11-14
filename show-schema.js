const Database = require("better-sqlite3");
const db = new Database("crm.sqlite");

const rows = db.prepare("SELECT sql FROM sqlite_master WHERE name='companies'").get();

console.log(rows ? rows.sql : "NO TABLE FOUND");
