// sync-categories.js (debug-friendly)
const Database = require('better-sqlite3');
const db = new Database('crm.sqlite');

function logErr(e){
  console.error('SYNC ERROR:', e && (e.stack || e.message || e));
}

(async ()=>{
  try {
    console.log('Opening crm.sqlite...');
    const mustAdd = ['Cold Rooms','Insulation','PUF Panels'];
    const insertIfMissing = db.prepare("INSERT INTO categories(name,slug) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM categories WHERE LOWER(name)=LOWER(?))");

    let added = 0;
    for (const n of mustAdd) {
      const slug = n.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
      const info = insertIfMissing.run(n, slug, n);
      if (info.changes) { added++; console.log('Added category:', n); }
    }
    console.log('Explicit added:', added);

    // distinct categories from companies
    const rows = db.prepare("SELECT DISTINCT TRIM(category) AS category FROM companies WHERE category IS NOT NULL AND TRIM(category)<>''").all();
    let added2 = 0;
    for (const r of rows) {
      const name = r.category;
      if (!name) continue;
      const slug = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
      const info = insertIfMissing.run(name, slug, name);
      if (info.changes) { added2++; console.log('Added from companies:', name); }
    }
    console.log('Added from companies:', added2);

    // map category -> category_id
    const res = db.prepare("UPDATE companies SET category_id = (SELECT id FROM categories WHERE LOWER(categories.name)=LOWER(companies.category)) WHERE TRIM(IFNULL(companies.category,''))<>''").run();
    console.log('Updated companies.category_id count:', res.changes);

    console.log('Sample categories:');
    console.log(db.prepare('SELECT id,name FROM categories ORDER BY id').all());

    console.log('Sample companies (latest 15):');
    console.log(db.prepare('SELECT id,businessName,category,category_id,state FROM companies ORDER BY id DESC LIMIT 15').all());

    db.close();
    console.log('Done.');
  } catch (e) {
    logErr(e);
    try{ db.close(); }catch(_){} 
    process.exit(1);
  }
})();
