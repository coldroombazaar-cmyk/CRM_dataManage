/**************************************************************************
 * CLEAN, FORMATTED, FULLY-FIXED server.js
 * CSV + XLSX Auto Import + Category optional + unknown fallback
 * + Admin list pagination
 **************************************************************************/

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const multer = require("multer");
const ExcelJS = require("exceljs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "my_secret_key";
const db = new Database("crm.sqlite");

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow devtools in localhost
app.use((req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
});

// Static hosting
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

/* -------------------- Multer config -------------------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname.replace(/[^\w.-]+/g, "_")),
});
const upload = multer({ storage });

/* -------------------- Helpers -------------------- */
function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token" });

    const token = auth.split(" ")[1];
    const user = jwt.verify(token, JWT_SECRET);

    req.adminId = user.adminId;
    next();
  } catch (err) {
    console.error("Auth error", err && err.stack ? err.stack : err);
    res.status(401).json({ error: "Invalid token" });
  }
}

function normalizeCompanyRow(r) {
  try {
    return { ...r, images: r.images ? JSON.parse(r.images) : [] };
  } catch {
    return { ...r, images: [] };
  }
}

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

/* =====================================================
   PUBLIC: ADD COMPANY (Category optional)
===================================================== */
app.post("/api/companies", upload.array("images", 10), (req, res) => {
  try {
    const b = req.body;
    if (!b.businessName || !b.state)
      return res
        .status(400)
        .json({ error: "businessName & state are required" });

    /* ------------ CATEGORY HANDLING ------------ */
    let categoryId = null;

    if (b.categoryId) {
      categoryId = Number(b.categoryId);
    } else if (b.category && b.category.trim() !== "") {
      const row = db
        .prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)")
        .get(b.category.trim());
      if (row) categoryId = row.id;
    }

    if (!categoryId) categoryId = getOrCreateUnknownCategory();

    /* ------------ Images ------------ */
    const files = (req.files || []).map((f) => "/uploads/" + f.filename);
    const imagesJson = JSON.stringify(files);

    /* ------------ Insert ------------ */
    const stmt = db.prepare(`
      INSERT INTO companies (
        businessName, ownerName, officeAddress, businessAddress,
        gstNo, category, state, contactNumber,
        whatsappNumber, email, website, capacity,
        description, uploaderMobile, images,
        is_premium, premium_start, premium_end,
        created_at, updated_at, category_id
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const now = new Date().toISOString();

    const info = stmt.run(
      b.businessName,
      b.ownerName || "",
      b.officeAddress || "",
      b.businessAddress || "",
      b.gstNo || "",
      b.category || "",
      b.state || "",
      b.contactNumber || "",
      b.whatsappNumber || "",
      b.email || "",
      b.website || "",
      b.capacity || "",
      b.description || "",
      b.uploaderMobile || "",
      imagesJson,
      0, // is_premium
      null, // premium_start
      null, // premium_end
      now, // created_at
      now, // updated_at
      categoryId
    );

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error("Add company error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   PUBLIC: GET CATEGORIES
===================================================== */
app.get("/categories", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT id, name, slug FROM categories ORDER BY name ASC")
      .all();
    res.json(rows);
  } catch (err) {
    console.error("Category load error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: LOGIN
===================================================== */
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ error: "username and password required" });

    const row = db
      .prepare("SELECT * FROM admins WHERE username = ?")
      .get(username);

    if (!row) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { adminId: row.id, username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Admin login error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: LIST COMPANIES (Filter + Pagination)
===================================================== */
app.get("/admin/companies", requireAdmin, (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

    // pagination
    const page = req.query.page ? Math.max(parseInt(req.query.page, 10) || 1, 1) : 1;
    const pageSize = req.query.limit
      ? Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100)
      : 25;
    const offset = (page - 1) * pageSize;

    let where = "";
    const params = [];

    if (categoryId) {
      where = "WHERE category_id = ?";
      params.push(categoryId);
    }

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM companies ${where}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT * FROM companies
         ${where}
         ORDER BY is_premium DESC, premium_end ASC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset);

    res.json({
      rows: rows.map(normalizeCompanyRow),
      total: totalRow.cnt || 0,
      page,
      pageSize
    });
  } catch (err) {
    console.error("Admin list companies error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: UPDATE COMPANY
===================================================== */
app.put("/admin/companies/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const fields = req.body || {};

    const allowed = [
      "businessName", "ownerName", "officeAddress", "businessAddress",
      "gstNo", "category", "category_id", "state", "contactNumber",
      "whatsappNumber", "email", "website", "capacity", "description",
      "uploaderMobile", "is_premium", "premium_start", "premium_end"
    ];

    const sets = [];
    const vals = [];

    allowed.forEach((key) => {
      if (key in fields) {
        sets.push(`${key} = ?`);
        vals.push(fields[key]);
      }
    });

    if (!sets.length)
      return res.status(400).json({ error: "Nothing to update" });

    vals.push(new Date().toISOString());
    vals.push(id);

    const sql =
      `UPDATE companies SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`;
    db.prepare(sql).run(...vals);

    res.json({ ok: true });
  } catch (err) {
    console.error("Admin update company error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: DELETE COMPANY
===================================================== */
app.delete("/admin/companies/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    const info = db
      .prepare("DELETE FROM companies WHERE id = ?")
      .run(id);

    if (info.changes === 0)
      return res.status(404).json({ error: "Not found" });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: SET / CHANGE PREMIUM
===================================================== */
app.post("/admin/companies/:id/premium", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { start, end } = req.body || {};

    if (!start || !end)
      return res.status(400).json({ error: "start and end required" });

    db.prepare(`
      UPDATE companies
      SET is_premium = 1,
          premium_start = ?,
          premium_end = ?,
          updated_at = ?
      WHERE id = ?
    `).run(start, end, new Date().toISOString(), id);

    res.json({ ok: true });
  } catch (err) {
    console.error("Set premium error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN: NOTIFICATIONS
===================================================== */
app.get("/admin/notifications", requireAdmin, (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200")
      .all();

    res.json(rows);
  } catch (err) {
    console.error("Notification error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   PREMIUM EXPIRY CRON (Runs every 1 min)
===================================================== */
setInterval(() => {
  try {
    // Expired premiums
    const expired = db.prepare(`
      SELECT id, businessName FROM companies
      WHERE is_premium = 1 AND datetime(premium_end) <= datetime('now')
    `).all();

    expired.forEach(r => {
      db.prepare(`
        UPDATE companies
        SET is_premium = 0, updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), r.id);

      db.prepare(`
        INSERT INTO notifications (company_id, type, message)
        VALUES (?, ?, ?)
      `).run(r.id, "premium_expired", `Premium expired for ${r.businessName}`);
    });

    // Premium expiring soon (within 3 days)
    const near = db.prepare(`
      SELECT id, businessName, premium_end FROM companies
      WHERE is_premium = 1
      AND julianday(premium_end) - julianday('now') <= 3
      AND julianday(premium_end) - julianday('now') > 0
    `).all();

    near.forEach(r => {
      db.prepare(`
        INSERT INTO notifications (company_id, type, message)
        VALUES (?, ?, ?)
      `).run(
        r.id,
        "premium_expiring",
        `Premium for ${r.businessName} expires on ${r.premium_end}`
      );
    });
  } catch (err) {
    console.error("Premium cron error:", err && err.stack ? err.stack : err);
  }
}, 60 * 1000);

/* =====================================================
   EXPORT XLSX + CSV
===================================================== */
app.get("/admin/export", requireAdmin, async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const format = (req.query.format || "xlsx").toLowerCase();

    let rows = [];

    if (categoryId) {
      rows = db.prepare(`
        SELECT c.*, cat.name AS category_name
        FROM companies c
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE c.category_id = ?
        ORDER BY c.id ASC
      `).all(categoryId);
    } else {
      rows = db.prepare(`
        SELECT c.*, cat.name AS category_name
        FROM companies c
        LEFT JOIN categories cat ON c.category_id = cat.id
        ORDER BY c.id ASC
      `).all();
    }

    if (!rows.length)
      return res.status(404).json({ error: "No records" });

    const data = rows.map(r => ({
      id: r.id,
      businessName: r.businessName,
      ownerName: r.ownerName,
      category: r.category_name || r.category || "",
      state: r.state,
      contactNumber: r.contactNumber,
      whatsappNumber: r.whatsappNumber,
      email: r.email,
      website: r.website,
      gstNo: r.gstNo,
      capacity: r.capacity,
      description: r.description,
      is_premium: r.is_premium,
      premium_start: r.premium_start,
      premium_end: r.premium_end,
      created_at: r.created_at
    }));

    /* ---------- CSV Export ---------- */
    if (format === "csv") {
      const header = Object.keys(data[0]);
      const csvRows = [header.join(",")];

      data.forEach(row => {
        csvRows.push(
          header
            .map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
            .join(",")
        );
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="companies_${categoryId || "all"}.csv"`
      );
      return res.send(csvRows.join("\n"));
    }

    /* ---------- XLSX Export ---------- */
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Companies");

    ws.addRow(Object.keys(data[0]));
    data.forEach(row => ws.addRow(Object.values(row)));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="companies_${categoryId || "all"}.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   IMPORT (Auto detect CSV + XLSX)
===================================================== */
app.post("/admin/import", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let rowsToInsert = [];

    // helper to get/create category id
    const getCategoryIdForName = (name) => {
      if (!name) return getOrCreateUnknownCategory();
      const found = db
        .prepare("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)")
        .get(name.trim());
      return found ? found.id : getOrCreateUnknownCategory();
    };

    /* ------------- CASE 1: CSV IMPORT ------------- */
    if (ext === ".csv") {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split(/\r?\n/).filter(x => x.trim() !== "");
      if (lines.length < 2) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "CSV has no data rows" });
      }

      const headers = lines[0].split(",").map(h => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        const obj = {};

        headers.forEach((h, idx) => {
          obj[h] = (parts[idx] || "").replace(/^"|"$/g, "").trim();
        });

        if (!obj.businessName || !obj.state) continue;

        rowsToInsert.push({
          ...obj,
          category_id: getCategoryIdForName(obj.category)
        });
      }
    }

    /* ------------- CASE 2: XLSX IMPORT ------------- */
    else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "No sheet found in xlsx" });
      }

      const headerRow = sheet.getRow(1);
      const headers = [];
      const headerMap = {};

      headerRow.eachCell((cell, n) => {
        let headerText = '';

        // Handle rich text
        if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
          headerText = cell.value.richText.map(t => t.text).join('');
        } else {
          headerText = String(cell.value || '');
        }

        headers[n] = headerText.trim();
        const lower = headerText.trim().toLowerCase();

        // Map common variations to standard field names
        if (lower.includes('business') || lower.includes('company') || lower === 'name') {
          headerMap[n] = 'businessName';
        } else if (lower.includes('owner')) {
          headerMap[n] = 'ownerName';
        } else if (lower.includes('state') || lower.includes('location')) {
          headerMap[n] = 'state';
        } else if (lower.includes('category') || lower.includes('type')) {
          headerMap[n] = 'category';
        } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('mobile')) {
          headerMap[n] = 'contactNumber';
        } else if (lower.includes('whatsapp')) {
          headerMap[n] = 'whatsappNumber';
        } else if (lower.includes('email')) {
          headerMap[n] = 'email';
        } else if (lower.includes('website') || lower.includes('web')) {
          headerMap[n] = 'website';
        } else if (lower.includes('gst')) {
          headerMap[n] = 'gstNo';
        } else if (lower.includes('capacity')) {
          headerMap[n] = 'capacity';
        } else if (lower.includes('description') || lower.includes('details')) {
          headerMap[n] = 'description';
        }
      });

      // Check if we have required fields
      const hasBusinessName = Object.values(headerMap).includes('businessName');
      const hasState = Object.values(headerMap).includes('state');

      if (!hasBusinessName || !hasState) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          error: "Missing required columns. Need: Business/Company Name and State/Location",
          foundHeaders: headers.filter(h => h)
        });
      }

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;

        const obj = {};
        row.eachCell((cell, col) => {
          const fieldName = headerMap[col];
          if (!fieldName) return;

          let cellValue = '';

          // Handle rich text
          if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
            cellValue = cell.value.richText.map(t => t.text).join('');
          } else if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
            cellValue = String(cell.value.result);
          } else {
            cellValue = String(cell.value || '');
          }

          obj[fieldName] = cellValue.trim();
        });

        if (!obj.businessName || !obj.state) return;

        rowsToInsert.push({
          ...obj,
          category_id: getCategoryIdForName(obj.category)
        });
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!rowsToInsert.length) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "No valid rows to import" });
    }

    /* ------------- BULK INSERT ------------- */
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
          r.businessName || "",
          r.ownerName || "",
          r.category || "",
          r.category_id,
          r.state || "",
          r.contactNumber || "",
          r.whatsappNumber || "",
          r.email || "",
          r.website || "",
          r.gstNo || "",
          r.capacity || "",
          r.description || "",
          JSON.stringify([]),
          now
        );
      });
    });

    insertMany();
    fs.unlinkSync(filePath);

    // Return only 2-3 sample rows for frontend display
    const sampleRows = rowsToInsert.slice(0, 3).map(r => ({
      businessName: r.businessName,
      ownerName: r.ownerName,
      category: r.category || "Unknown",
      state: r.state,
      contactNumber: r.contactNumber
    }));

    res.json({
      success: true,
      imported: rowsToInsert.length,
      sampleData: sampleRows,
      message: `Successfully imported ${rowsToInsert.length} companies. Showing ${sampleRows.length} sample records.`
    });
  } catch (err) {
    console.error("Import error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      error: "Import failed",
      detail: err && err.message ? err.message : String(err)
    });
  }
});

/* =====================================================
   PUBLIC SEARCH / LIST COMPANIES (front-end)
===================================================== */
app.get("/api/companies", (req, res) => {
  const q = req.query.q ? req.query.q.trim() : "";

  // No search → return all rows
  if (!q) {
    const rows = db.prepare("SELECT * FROM companies ORDER BY id DESC").all();
    return res.json(rows);
  }

  const search = `%${q}%`;

  const sql = `
    SELECT * FROM companies
    WHERE 
      businessName LIKE ? OR
      ownerName LIKE ? OR
      category LIKE ? OR
      state LIKE ? OR
      contactNumber LIKE ? OR
      description LIKE ? OR
      gstNo LIKE ?
    ORDER BY id DESC
  `;

  const params = [search, search, search, search, search, search, search];

  const rows = db.prepare(sql).all(...params);
  return res.json(rows);
});

/* =====================================================
   START SERVER
===================================================== */
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
