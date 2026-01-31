const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');

console.log('='.repeat(70));
console.log('  MANUAL EXCEL IMPORT SCRIPT');
console.log('='.repeat(70));

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

// Extract text from Excel cell (handles rich text)
function getCellText(cell) {
    if (!cell || !cell.value) return '';

    if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(t => t.text).join('');
    }

    if (typeof cell.value === 'object' && cell.value.result !== undefined) {
        return String(cell.value.result);
    }

    return String(cell.value);
}

async function importExcelFile(filePath) {
    console.log(`\n📂 Processing: ${path.basename(filePath)}`);
    console.log('-'.repeat(70));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
        console.log('❌ No worksheet found');
        return { imported: 0, skipped: 0 };
    }

    // Read headers
    const headerRow = sheet.getRow(1);
    const headers = [];
    const headerMap = {};

    headerRow.eachCell((cell, colNum) => {
        const headerText = getCellText(cell).trim();
        headers[colNum] = headerText;
        const lower = headerText.toLowerCase();

        // Map headers to field names
        if (lower.includes('business') || lower.includes('company') || lower === 'name') {
            headerMap[colNum] = 'businessName';
        } else if (lower.includes('owner')) {
            headerMap[colNum] = 'ownerName';
        } else if (lower.includes('state') || lower.includes('location')) {
            headerMap[colNum] = 'state';
        } else if (lower.includes('category') || lower.includes('type')) {
            headerMap[colNum] = 'category';
        } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('mobile')) {
            headerMap[colNum] = 'contactNumber';
        } else if (lower.includes('whatsapp')) {
            headerMap[colNum] = 'whatsappNumber';
        } else if (lower.includes('email')) {
            headerMap[colNum] = 'email';
        } else if (lower.includes('website') || lower.includes('web')) {
            headerMap[colNum] = 'website';
        } else if (lower.includes('gst')) {
            headerMap[colNum] = 'gstNo';
        } else if (lower.includes('capacity')) {
            headerMap[colNum] = 'capacity';
        } else if (lower.includes('description') || lower.includes('details')) {
            headerMap[colNum] = 'description';
        } else if (lower.includes('address')) {
            headerMap[colNum] = 'address';
        }
    });

    console.log(`📋 Found ${Object.keys(headers).length} columns`);
    console.log(`✓ Mapped fields:`, Object.values(headerMap).filter((v, i, a) => a.indexOf(v) === i).join(', '));

    // Check required fields
    const hasBusinessName = Object.values(headerMap).includes('businessName');
    const hasState = Object.values(headerMap).includes('state');

    if (!hasBusinessName) {
        console.log('❌ Missing Business/Company Name column');
        console.log('   Found headers:', headers.filter(h => h).join(', '));
        return { imported: 0, skipped: 0 };
    }

    if (!hasState) {
        console.log('❌ Missing State/Location column');
        console.log('   Found headers:', headers.filter(h => h).join(', '));
        return { imported: 0, skipped: 0 };
    }

    // Read data rows
    const rows = [];
    let skipped = 0;

    sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // Skip header

        const data = {};
        row.eachCell((cell, colNum) => {
            const fieldName = headerMap[colNum];
            if (fieldName) {
                data[fieldName] = getCellText(cell).trim();
            }
        });

        if (data.businessName && data.state) {
            rows.push(data);
        } else {
            skipped++;
        }
    });

    console.log(`✓ Valid rows: ${rows.length}`);
    if (skipped > 0) {
        console.log(`⚠ Skipped rows (missing required fields): ${skipped}`);
    }

    // Insert into database
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

    console.log('\n💾 Inserting into database...');

    for (const row of rows) {
        try {
            const categoryId = getCategoryIdForName(row.category);
            insertStmt.run(
                row.businessName || '',
                row.ownerName || '',
                row.category || '',
                categoryId,
                row.state || '',
                row.contactNumber || '',
                row.whatsappNumber || '',
                row.email || '',
                row.website || '',
                row.gstNo || '',
                row.capacity || '',
                row.description || '',
                JSON.stringify([]),
                now
            );
            imported++;

            // Show progress every 50 rows
            if (imported % 50 === 0) {
                console.log(`  ... ${imported} rows inserted`);
            }
        } catch (error) {
            console.log(`❌ Error inserting row: ${error.message}`);
        }
    }

    console.log(`✅ Successfully imported: ${imported} companies`);

    return { imported, skipped };
}

async function main() {
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
            console.log(`\n❌ Error processing ${file}:`);
            console.log(`   ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('  IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total Imported: ${totalImported}`);
    console.log(`⚠  Total Skipped: ${totalSkipped}`);
    console.log('='.repeat(70));

    // Show sample of imported data
    if (totalImported > 0) {
        console.log('\n📋 Sample of imported companies:\n');
        const sample = db.prepare(`
      SELECT businessName, ownerName, state, category 
      FROM companies 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

        sample.forEach((row, i) => {
            console.log(`${i + 1}. ${row.businessName}`);
            console.log(`   Owner: ${row.ownerName || 'N/A'}`);
            console.log(`   State: ${row.state}`);
            console.log(`   Category: ${row.category || 'Unknown'}`);
            console.log('');
        });
    }

    // Show total count
    const total = db.prepare('SELECT COUNT(*) as count FROM companies').get();
    console.log(`📊 Total companies in database: ${total.count}`);

    db.close();
    console.log('\n✅ Import complete!\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    db.close();
    process.exit(1);
});
