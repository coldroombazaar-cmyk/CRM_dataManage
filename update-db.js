// update-db.js
const Database = require('better-sqlite3');
const db = new Database('crm.sqlite');

// Create categories table
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Add category_id column to companies (ignore error if exists)
try {
  db.prepare('ALTER TABLE companies ADD COLUMN category_id INTEGER;').run();
  console.log("✅ Added column 'category_id' in companies.");
} catch {
  console.log("⚠️ Column 'category_id' already exists (ok).");
}

// Insert some default categories
const defaults = ['PUF Panels', 'Cold Rooms', 'Insulation'];
for (const name of defaults) {
  try {
    db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, name.toLowerCase().replace(/\s+/g,'-'));
    console.log("Added category:", name);
  } catch {}
}

db.close();
console.log("✅ Categories setup complete!");
