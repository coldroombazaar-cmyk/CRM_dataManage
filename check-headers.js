const ExcelJS = require('exceljs');

async function checkHeaders(filePath) {
    console.log(`\nChecking: ${filePath}\n`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    const headerRow = sheet.getRow(1);
    const headers = [];

    headerRow.eachCell((cell, colNumber) => {
        const value = cell.value;
        let headerText = '';

        if (value && typeof value === 'object' && value.richText) {
            headerText = value.richText.map(t => t.text).join('');
        } else {
            headerText = String(value || '');
        }

        headers.push({
            col: colNumber,
            value: headerText.trim()
        });
    });

    console.log('Headers found:');
    headers.forEach(h => {
        if (h.value) {
            console.log(`  Column ${h.col}: "${h.value}"`);
        }
    });

    console.log('\nFirst data row:');
    const row2 = sheet.getRow(2);
    row2.eachCell((cell, colNumber) => {
        const value = cell.value;
        let cellText = '';

        if (value && typeof value === 'object' && value.richText) {
            cellText = value.richText.map(t => t.text).join('');
        } else {
            cellText = String(value || '');
        }

        console.log(`  Column ${colNumber}: "${cellText}"`);
    });
}

async function main() {
    await checkHeaders('uploads/1763031941141_Owner_List_1_.xlsx');
    console.log('\n' + '='.repeat(70) + '\n');
    await checkHeaders('uploads/Owner_List (1).xlsx');
}

main().catch(console.error);
