const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

console.log('Starting import process...');

const db = new Database('crm.sqlite');

// Get or create Unknown category
function getOrCreateUnknownCategory() {
    const existing = db.prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)").get("unknown");
    if (existing) return existing.id;
    const info = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("Unknown", "unknown");
    return info.lastInsertRowid;
}

// Get category ID by name
function getCategoryIdForName(name) {
    if (!name || name.trim() === '') return getOrCreateUnknownCategory();
    const found = db.prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)").get(name.trim());
    return found ? found.id : getOrCreateUnknownCategory();
}

async function importFile(filePath) {
    console.log(`\nProcessing: ${path.basename(filePath)}`);

    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return { imported: 0, skipped: 0 };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
        console.log('No worksheet found');
        return { imported: 0, skipped: 0 };
    }

    const rows = [];
    const headerRow = sheet.getRow(1);
    const headers = [];

    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
    });

    console.log('Headers:', headers.filter(h => h).join(', '));

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const data = {};
        row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
                data[header] = String(cell.value || '').trim();
            }
        });

        // Handle different header variations
        const businessName = data.businessName || data.BusinessName || data.businessname || data['Business Name'] || '';
        const state = data.state || data.State || data.STATE || '';

        if (businessName && state) {
            rows.push({
                businessName,
                ownerName: data.ownerName || data.OwnerName || data['Owner Name'] || '',
                category: data.category || data.Category || '',
                state,
                contactNumber: data.contactNumber || data.ContactNumber || data.contact || data.Contact || data.Phone || data.phone || '',
                whatsappNumber: data.whatsappNumber || data.WhatsappNumber || data.whatsapp || data.Whatsapp || '',
                email: data.email || data.Email || data.EMAIL || '',
                website: data.website || data.Website || '',
                gstNo: data.gstNo || data.GstNo || data.GST || data.gst || '',
                capacity: data.capacity || data.Capacity || '',
                description: data.description || data.Description || ''
            });
        }
    });

    console.log(`Found ${rows.length} valid rows`);

    const insertStmt = db.prepare(`
    INSERT INTO companies (
      businessName, ownerName, category, category_id,
      state, contactNumber, whatsappNumber, email,
      website, gstNo, capacity, description,
      images, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

    const now = new Date().toISOString();
    let imported = 0;

    for (const row of rows) {
        try {
            const categoryId = getCategoryIdForName(row.category);
            insertStmt.run(
                row.businessName,
                row.ownerName,
                row.category,
                categoryId,
                row.state,
                row.contactNumber,
                row.whatsappNumber,
                row.email,
                row.website,
                row.gstNo,
                row.capacity,
                row.description,
                JSON.stringify([]),
                now
            );
            imported++;
        } catch (error) {
            console.log(`Error inserting row: ${error.message}`);
        }
    }

    console.log(`Imported: ${imported} companies`);
    return { imported, skipped: rows.length - imported };
}

async function main() {
    const files = [
        'uploads/1763031941141_Owner_List_1_.xlsx',
        'uploads/Owner_List (1).xlsx'
    ];

    let totalImported = 0;

    for (const file of files) {
        const result = await importFile(file);
        totalImported += result.imported;
    }

    console.log(`\n=== TOTAL IMPORTED: ${totalImported} ===`);

    // Show sample
    const sample = db.prepare('SELECT businessName, state FROM companies LIMIT 5').all();
    console.log('\nSample data:');
    sample.forEach((r, i) => console.log(`${i + 1}. ${r.businessName} (${r.state})`));

    db.close();
}

main().catch(console.error);
