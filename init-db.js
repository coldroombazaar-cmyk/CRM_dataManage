// init-db.js
// Usage: node init-db.js
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');

const DB_FILE = 'crm.sqlite';
if (fs.existsSync(DB_FILE)) {
  console.log(DB_FILE + ' already exists — it will be reused (no destructive changes).');
}

const db = new Database(DB_FILE);

// helper to run many sql statements safely
function run(sql) {
  db.exec(sql);
}

// Create tables if not exists
run(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  businessName TEXT NOT NULL,
  ownerName TEXT,
  officeAddress TEXT,
  businessAddress TEXT,
  gstNo TEXT,
  category TEXT,
  category_id INTEGER,
  state TEXT NOT NULL,
  contactNumber TEXT,
  whatsappNumber TEXT,
  email TEXT,
  website TEXT,
  capacity TEXT,
  description TEXT,
  uploaderMobile TEXT,
  images TEXT,
  is_premium INTEGER DEFAULT 0,
  premium_start TEXT,
  premium_end TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_business ON companies(businessName);
CREATE INDEX IF NOT EXISTS idx_companies_category_id ON companies(category_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  type TEXT,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
`);

// ensure at least one admin exists (username: admin, password: change_me_123)
(async () => {
  const row = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!row) {
    const pass = 'change_me_123';
    const hash = await bcrypt.hash(pass, 10);
    const info = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('Admin created: username=admin password=' + pass);
  } else {
    console.log('Admin "admin" already exists (id=' + row.id + ')');
  }

  // add an "Unknown" category if missing
  const cat = db.prepare('SELECT id FROM categories WHERE LOWER(name)=LOWER(?)').get('unknown');
  if (!cat) {
    const res = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Unknown', 'unknown');
    console.log('Added Unknown category id=' + res.lastInsertRowid);
  } else {
    console.log('Unknown category exists id=' + cat.id);
  }

  db.close();
})();
