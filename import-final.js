const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');

console.log('='.repeat(70));
console.log('  MANUAL IMPORT - EXTRACTING STATE FROM ADDRESS');
console.log('='.repeat(70));

const db = new Database('crm.sqlite');

// Get or create Unknown category
function getOrCreateUnknownCategory() {
    const existing = db.prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)").get("unknown");
    if (existing) return existing.id;
    const info = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("Unknown", "unknown");
    return info.lastInsertRowid;
}

// Extract state from address
function extractStateFromAddress(address) {
    if (!address) return 'India';

    const states = [
        'Delhi', 'Mumbai', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat',
        'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Punjab', 'Haryana',
        'Andhra Pradesh', 'Telangana', 'Kerala', 'Madhya Pradesh', 'Bihar',
        'Odisha', 'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand',
        'Himachal Pradesh', 'Goa', 'Jammu', 'Kashmir', 'Chandigarh',
        'Puducherry', 'Sikkim', 'Meghalaya', 'Manipur', 'Nagaland',
        'Tripura', 'Mizoram', 'Arunachal Pradesh'
    ];

    const addressLower = address.toLowerCase();

    for (const state of states) {
        if (addressLower.includes(state.toLowerCase())) {
            return state;
        }
    }

    // Check for common city-state mappings
    if (addressLower.includes('bangalore') || addressLower.includes('bengaluru')) return 'Karnataka';
    if (addressLower.includes('chennai')) return 'Tamil Nadu';
    if (addressLower.includes('hyderabad')) return 'Telangana';
    if (addressLower.includes('pune')) return 'Maharashtra';
    if (addressLower.includes('ahmedabad')) return 'Gujarat';
    if (addressLower.includes('kolkata')) return 'West Bengal';
    if (addressLower.includes('jaipur')) return 'Rajasthan';
    if (addressLower.includes('lucknow')) return 'Uttar Pradesh';
    if (addressLower.includes('chandigarh')) return 'Chandigarh';
    if (addressLower.includes('kochi') || addressLower.includes('cochin')) return 'Kerala';
    if (addressLower.includes('indore')) return 'Madhya Pradesh';
    if (addressLower.includes('bhopal')) return 'Madhya Pradesh';
    if (addressLower.includes('patna')) return 'Bihar';
    if (addressLower.includes('gurgaon') || addressLower.includes('gurugram')) return 'Haryana';
    if (addressLower.includes('noida') || addressLower.includes('ghaziabad')) return 'Uttar Pradesh';

    return 'India'; // Default
}

// Extract text from cell
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

async function importFile(filePath) {
    console.log(`\n📂 Processing: ${path.basename(filePath)}`);
    console.log('-'.repeat(70));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    console.log(`Total Rows: ${sheet.rowCount}`);

    const rows = [];

    sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // Skip header

        const ownerName = getCellText(row.getCell(1)).trim(); // Name
        const email = getCellText(row.getCell(2)).trim(); // Email
        const contactNumber = getCellText(row.getCell(3)).trim(); // Contact
        const whatsappNumber = getCellText(row.getCell(4)).trim(); // WhatsApp
        const businessName = getCellText(row.getCell(5)).trim(); // Company Name
        const website = getCellText(row.getCell(6)).trim(); // Company URL
        const address = getCellText(row.getCell(7)).trim(); // Company Address
        const gstNo = getCellText(row.getCell(8)).trim(); // GST No

        if (businessName) {
            const state = extractStateFromAddress(address);

            rows.push({
                businessName,
                ownerName,
                email,
                contactNumber,
                whatsappNumber,
                website,
                gstNo,
                state,
                description: address // Store full address in description
            });
        }
    });

    console.log(`✓ Valid rows: ${rows.length}`);

    // Insert
    const insertStmt = db.prepare(`
    INSERT INTO companies (
      businessName, ownerName, category, category_id,
      state, contactNumber, whatsappNumber, email,
      website, gstNo, capacity, description,
      images, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

    const now = new Date().toISOString();
    const unknownCatId = getOrCreateUnknownCategory();
    let imported = 0;

    console.log('💾 Inserting into database...');

    for (const row of rows) {
        try {
            insertStmt.run(
                row.businessName,
                row.ownerName,
                '',
                unknownCatId,
                row.state,
                row.contactNumber,
                row.whatsappNumber,
                row.email,
                row.website,
                row.gstNo,
                '',
                row.description,
                JSON.stringify([]),
                now
            );
            imported++;

            if (imported % 100 === 0) {
                console.log(`  ... ${imported} rows inserted`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log(`✅ Imported: ${imported} companies`);
    return { imported };
}

async function main() {
    const files = [
        'uploads/1763031941141_Owner_List_1_.xlsx',
        'uploads/Owner_List (1).xlsx'
    ];

    let totalImported = 0;

    for (const file of files) {
        try {
            const result = await importFile(file);
            totalImported += result.imported;
        } catch (error) {
            console.log(`\n❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✅ TOTAL IMPORTED: ${totalImported} companies`);
    console.log('='.repeat(70));

    // Show sample
    console.log('\n📋 Sample of imported data:\n');
    const sample = db.prepare(`
    SELECT businessName, ownerName, state, contactNumber
    FROM companies 
    ORDER BY id DESC 
    LIMIT 5
  `).all();

    sample.forEach((row, i) => {
        console.log(`${i + 1}. ${row.businessName}`);
        console.log(`   Owner: ${row.ownerName || 'N/A'}`);
        console.log(`   State: ${row.state}`);
        console.log(`   Contact: ${row.contactNumber || 'N/A'}`);
        console.log('');
    });

    const total = db.prepare('SELECT COUNT(*) as count FROM companies').get();
    console.log(`📊 Total companies in database: ${total.count}\n`);

    db.close();
}

main().catch(console.error);
