const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');

const db = new Database('crm.sqlite');

// Helper function to get or create "Unknown" category
function getOrCreateUnknownCategory() {
    const existing = db
        .prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)")
        .get("unknown");

    if (existing) return existing.id;

    const info = db
        .prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
        .run("Unknown", "unknown");

    return info.lastInsertRowid;
}

// Helper function to get category ID by name
function getCategoryIdForName(name) {
    if (!name || name.trim() === '') return getOrCreateUnknownCategory();

    const found = db
        .prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)")
        .get(name.trim());

    return found ? found.id : getOrCreateUnknownCategory();
}

// Function to import Excel file
async function importExcelFile(filePath) {
    console.log(`\n📂 Importing file: ${path.basename(filePath)}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
        console.log('❌ No sheet found in Excel file');
        return { imported: 0, skipped: 0 };
    }

    // Get headers from first row
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = (cell.text || '').trim();
    });

    console.log(`📋 Headers found: ${headers.filter(h => h).join(', ')}`);

    const rowsToInsert = [];
    let skipped = 0;

    // Process each row
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const obj = {};
        row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
                obj[header] = (cell.text || '').toString().trim();
            }
        });

        // Handle case-insensitive headers
        if (!obj.businessName && obj.businessname) obj.businessName = obj.businessname;
        if (!obj.businessName && obj.BusinessName) obj.businessName = obj.BusinessName;
        if (!obj.state && obj.State) obj.state = obj.State;
        if (!obj.state && obj.STATE) obj.state = obj.STATE;

        // Check required fields
        if (!obj.businessName || !obj.state) {
            skipped++;
            return;
        }

        rowsToInsert.push({
            ...obj,
            category_id: getCategoryIdForName(obj.category || obj.Category)
        });
    });

    console.log(`✅ Valid rows to import: ${rowsToInsert.length}`);
    console.log(`⚠️  Skipped rows (missing required fields): ${skipped}`);

    // Insert data
    const insertStmt = db.prepare(`
    INSERT INTO companies (
      businessName, ownerName, category, category_id,
      state, contactNumber, whatsappNumber, email,
      website, gstNo, capacity, description,
      images, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

    const insertMany = db.transaction(() => {
        const now = new Date().toISOString();
        rowsToInsert.forEach(r => {
            insertStmt.run(
                r.businessName || '',
                r.ownerName || r.OwnerName || '',
                r.category || r.Category || '',
                r.category_id,
                r.state || r.State || '',
                r.contactNumber || r.ContactNumber || r.contact || '',
                r.whatsappNumber || r.WhatsappNumber || r.whatsapp || '',
                r.email || r.Email || '',
                r.website || r.Website || '',
                r.gstNo || r.GstNo || r.GST || '',
                r.capacity || r.Capacity || '',
                r.description || r.Description || '',
                JSON.stringify([]),
                now
            );
        });
    });

    insertMany();

    console.log(`🎉 Successfully imported ${rowsToInsert.length} companies!`);

    return { imported: rowsToInsert.length, skipped };
}

// Main function
async function main() {
    console.log('🚀 Starting data import...\n');

    const files = [
        'uploads/1763031941141_Owner_List_1_.xlsx',
        'uploads/Owner_List (1).xlsx'
    ];

    let totalImported = 0;
    let totalSkipped = 0;

    for (const file of files) {
        try {
            const result = await importExcelFile(file);
            totalImported += result.imported;
            totalSkipped += result.skipped;
        } catch (error) {
            console.error(`❌ Error importing ${file}:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Total Imported: ${totalImported}`);
    console.log(`⚠️  Total Skipped: ${totalSkipped}`);
    console.log('='.repeat(50));

    // Show sample of imported data
    console.log('\n📋 Sample of imported companies:');
    const sample = db.prepare('SELECT businessName, ownerName, state, category FROM companies ORDER BY id DESC LIMIT 5').all();
    sample.forEach((row, i) => {
        console.log(`${i + 1}. ${row.businessName} - ${row.ownerName || 'N/A'} (${row.state}) [${row.category || 'Unknown'}]`);
    });

    db.close();
    console.log('\n✅ Import complete!');
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
