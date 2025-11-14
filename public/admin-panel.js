/* ========================
      WhatsApp Icon SVG
======================== */
const wpIcon = `
  <svg class="wp-icon" viewBox="0 0 32 32" fill="#25D366">
    <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.83.74 5.58 2.14 8.02L.5 31.5l7.73-2.03A15.36 15.36 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5Zm0 28.2c-2.44 0-4.83-.65-6.92-1.88l-.5-.29-4.58 1.2 1.22-4.46-.32-.57A13.08 13.08 0 0 1 2.8 16c0-7.27 5.93-13.2 13.2-13.2 7.27 0 13.2 5.93 13.2 13.2S23.27 28.7 16 28.7Zm7.33-10.08c-.4-.2-2.36-1.17-2.73-1.31-.36-.13-.63-.2-.9.2-.27.4-1.03 1.31-1.27 1.58-.23.27-.47.3-.87.1-.4-.2-1.68-.62-3.2-2-.12-.1-1.1-.97-1.32-1.88-.23-.9.14-1.35.35-1.57.18-.18.4-.47.6-.7.2-.23.27-.4.4-.67.13-.27.07-.5 0-.7-.07-.2-.9-2.17-1.23-2.97-.33-.8-.67-.7-.9-.7h-.77c-.27 0-.7.1-1.06.5-.36.4-1.4 1.36-1.4 3.32 0 1.96 1.43 3.85 1.63 4.12.2.27 2.8 4.27 6.82 5.98 4.02 1.71 4.02 1.14 4.74 1.07.72-.07 2.36-.96 2.7-1.9.33-.93.33-1.73.23-1.9-.1-.17-.36-.27-.77-.47Z"/>
  </svg>
`;

/* SHORTCUT */
const $ = id => document.getElementById(id);

/* TOKEN HELPERS */
const tokenKey = "admin_token";
const getToken = () => localStorage.getItem(tokenKey) || "";
const setToken = v =>
  v ? localStorage.setItem(tokenKey, v) : localStorage.removeItem(tokenKey);

/* BASIC API */
async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  const token = getToken();
  if (token) opts.headers["Authorization"] = "Bearer " + token;

  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, opts);
  if (res.status === 401) {
    setToken(null);
    throw new Error("401 Unauthorized");
  }

  const txt = await res.text().catch(() => null);
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return txt;
  }
}

/* DOM */
const catsDiv = $("cats");
const categoryFilter = $("categoryFilter");
const filterText = $("filterText");
const listEl = $("list");

const btnNewCategory = $("btnNewCategory");
const btnShowLogin = $("btnShowLogin");
const btnLogout = $("btnLogout");
const btnRefresh = $("btnRefresh");
const btnExport = $("btnExport");
const btnListAdmins = $("btnListAdmins");
const btnDeleteSelected = $("btnDeleteSelected");

const importFile = $("importFile");
const btnImport = $("btnImport");
const importStatus = $("importStatus");
const importLog = $("importLog");

const infoEl = $("info");

/* Edit modal */
const editModal = $("editModal");
const editName = $("editName");
const editOwner = $("editOwner");
const editState = $("editState");
const editPhone = $("editPhone");
const editWhatsapp = $("editWhatsapp");
const editEmail = $("editEmail");
const editWebsite = $("editWebsite");
const editGst = $("editGst");
const editCategory = $("editCategory");
const editDescription = $("editDescription");
const editSave = $("editSave");
const editCancel = $("editCancel");

/* Delete modal */
const deleteModal = $("deleteModal");
const deleteConfirm = $("deleteConfirm");
const deleteCancel = $("deleteCancel");

/* Premium modal */
const premiumModal = $("premiumModal");
const premiumStart = $("premiumStart");
const premiumEnd = $("premiumEnd");
const premiumSave = $("premiumSave");
const premiumCancel = $("premiumCancel");

let categories = [];
let currentCategory = null;
let editingId = null;
let deletingId = null;
let premiumForId = null;
let lastRows = [];
let selectedIds = new Set();

/* ============================
   LOAD CATEGORIES
============================ */
async function loadCategories() {
  try {
    const res = await fetch("/categories");
    categories = await res.json();
    if (!Array.isArray(categories)) categories = [];
  } catch (err) {
    console.error("Failed to load categories", err);
    categories = [];
  }

  catsDiv.innerHTML = "";
  categoryFilter.innerHTML = `<option value="">— All categories —</option>`;
  editCategory.innerHTML = `<option value="">— No category —</option>`;

  categories.forEach(c => {
    const d = document.createElement("div");
    d.className = "cat";
    d.textContent = c.name;
    d.onclick = () => {
      currentCategory = currentCategory === c.id ? null : c.id;
      renderCats();
      refresh();
    };
    catsDiv.appendChild(d);

    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    categoryFilter.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = c.id;
    opt2.textContent = c.name;
    editCategory.appendChild(opt2);
  });

  renderCats();
}

function renderCats() {
  Array.from(catsDiv.children).forEach((n, i) => {
    const c = categories[i];
    n.classList.toggle("active", String(c.id) === String(currentCategory));
  });
  categoryFilter.value = currentCategory || "";
}

categoryFilter.onchange = () => {
  currentCategory = categoryFilter.value ? Number(categoryFilter.value) : null;
  renderCats();
  refresh();
};

/* ============================
   LOGIN
============================ */
btnShowLogin.onclick = async () => {
  const u = prompt("Username", "admin");
  const p = prompt("Password", "change_me_123");
  if (!u || !p) return;

  try {
    const r = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await r.json();
    if (r.ok && data.token) {
      setToken(data.token);
      if (infoEl) infoEl.textContent = "Logged in";
      refresh();
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error("Login error", err);
    alert("Login error (see console)");
  }
};

btnLogout.onclick = () => {
  setToken(null);
  if (infoEl) infoEl.textContent = "Logged out";
  listEl.innerHTML = "";
};

/* ============================
   REFRESH LIST
============================ */
btnRefresh.onclick = refresh;

async function refresh() {
  listEl.innerHTML = "<div class='small'>Loading…</div>";
  selectedIds.clear();

  try {
    const query = currentCategory ? `?categoryId=${currentCategory}` : "";
    const rows = await api("/admin/companies" + query);
    if (!Array.isArray(rows)) {
      console.error("Invalid /admin/companies response", rows);
      listEl.innerHTML = "<div class='small'>Error loading companies.</div>";
      return;
    }
    lastRows = rows;

    const text = (filterText.value || "").trim().toLowerCase();
    const filtered = text
      ? rows.filter(r => (r.businessName || "").toLowerCase().includes(text))
      : rows;

    if (!filtered.length) {
      listEl.innerHTML = "<div class='small'>No companies found.</div>";
      return;
    }

    listEl.innerHTML = filtered.map(renderItem).join("");

    listEl.querySelectorAll(".item").forEach(node => {
      const id = node.dataset.id;

      const editBtn = node.querySelector("[data-act='edit']");
      const delBtn = node.querySelector("[data-act='del']");
      const premiumBtn = node.querySelector("[data-act='premium']");
      const check = node.querySelector(".row-check");

      if (editBtn) editBtn.onclick = () => openEdit(id);
      if (delBtn) delBtn.onclick = () => openDelete(id);
      if (premiumBtn) premiumBtn.onclick = () => openPremium(id);
      if (check) {
        check.onchange = e => {
          if (e.target.checked) selectedIds.add(id);
          else selectedIds.delete(id);
        };
      }
    });
  } catch (err) {
    console.error("Refresh error", err);
    listEl.innerHTML = "<div class='small'>Failed to load companies (see console)</div>";
  }
}

function renderItem(it) {
  const catName =
    categories.find(c => c.id === it.category_id)?.name ||
    it.category ||
    "Unknown";

  return `
    <div class="item ${it.is_premium ? "premium" : ""}" data-id="${it.id}">
      <div>
        <div class="title">${escapeHtml(it.businessName)}</div>
        <div class="meta">${escapeHtml(it.ownerName || "")} • ${escapeHtml(catName)}</div>
        <div class="meta">${escapeHtml(it.description || "")}</div>
      </div>

      <div class="right">
        <div class="meta">
          <input type="checkbox" class="row-check">
        </div>

        ${it.is_premium ? `<div class="badge-premium">★ Premium</div>` : ""}

        <div class="meta contact">
          ${escapeHtml(it.contactNumber || "")}
          ${
            it.contactNumber
              ? `<a href="https://wa.me/${encodeURIComponent(
                  it.contactNumber
                )}" target="_blank" rel="noopener noreferrer">${wpIcon}</a>`
              : ""
          }
        </div>

        <div class="controls">
          <button class="ghost" data-act="edit">Edit</button>
          <button class="ghost" data-act="del">Delete</button>
          <button class="ghost" data-act="premium">${
            it.is_premium ? "Change Premium" : "Set Premium"
          }</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

/* ============================
   EDIT MODAL (FULL FIELDS)
============================ */
function openEdit(id) {
  editingId = id;

  const item = lastRows.find(r => String(r.id) === String(id));
  if (!item) return;

  editName.value = item.businessName || "";
  editOwner.value = item.ownerName || "";
  editState.value = item.state || "";
  editPhone.value = item.contactNumber || "";
  editWhatsapp.value = item.whatsappNumber || "";
  editEmail.value = item.email || "";
  editWebsite.value = item.website || "";
  editGst.value = item.gstNo || "";
  editDescription.value = item.description || "";
  editCategory.value = item.category_id || "";

  editModal.classList.remove("hidden");
}

editCancel.onclick = () => editModal.classList.add("hidden");

editSave.onclick = async () => {
  if (!editingId) return;

  try {
    await api("/admin/companies/" + editingId, {
      method: "PUT",
      body: {
        businessName: editName.value,
        ownerName: editOwner.value,
        state: editState.value,
        contactNumber: editPhone.value,
        whatsappNumber: editWhatsapp.value,
        email: editEmail.value,
        website: editWebsite.value,
        gstNo: editGst.value,
        description: editDescription.value,
        categoryId: editCategory.value || null
      }
    });

    editModal.classList.add("hidden");
    refresh();
  } catch (err) {
    console.error("Save edit failed", err);
    alert("Save failed (see console)");
  }
};

/* ============================
   DELETE CONFIRM MODAL
============================ */
function openDelete(id) {
  deletingId = id;
  deleteModal.classList.remove("hidden");
}

deleteCancel.onclick = () => deleteModal.classList.add("hidden");

deleteConfirm.onclick = async () => {
  if (!deletingId) return;
  try {
    await api("/admin/companies/" + deletingId, { method: "DELETE" });
    deleteModal.classList.add("hidden");
    refresh();
  } catch (err) {
    console.error("Delete failed", err);
    alert("Delete failed (see console).");
  }
};

/* ============================
   BULK DELETE
============================ */
btnDeleteSelected.onclick = async () => {
  if (!selectedIds.size) {
    alert("No companies selected.");
    return;
  }

  if (!confirm(`Delete ${selectedIds.size} selected companies?`)) return;

  try {
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map(id =>
        api("/admin/companies/" + id, { method: "DELETE" }).catch(err => {
          console.error("Failed to delete id=", id, err);
        })
      )
    );
    selectedIds.clear();
    refresh();
  } catch (err) {
    console.error("Bulk delete error", err);
    alert("Bulk delete failed (see console).");
  }
};

/* ============================
   PREMIUM MODAL (DATE PICKER)
============================ */
function openPremium(id) {
  premiumForId = id;
  premiumStart.value = new Date().toISOString().slice(0, 10);
  premiumEnd.value = "";
  premiumModal.classList.remove("hidden");
}

premiumCancel.onclick = () => {
  premiumModal.classList.add("hidden");
  premiumForId = null;
};

premiumSave.onclick = async () => {
  if (!premiumForId) return;

  const start = premiumStart.value;
  const end = premiumEnd.value;

  if (!start || !end) {
    alert("Please select both start and end date.");
    return;
  }

  if (new Date(end) <= new Date(start)) {
    alert("End date must be after start date.");
    return;
  }

  try {
    await api("/admin/companies/" + premiumForId + "/premium", {
      method: "POST",
      body: { start, end }
    });
    premiumModal.classList.add("hidden");
    premiumForId = null;
    refresh();
  } catch (err) {
    console.error("Set premium failed", err);
    alert("Set premium failed (see console).");
  }
};

/* ============================
   IMPORT HANDLER
============================ */
btnImport.onclick = async () => {
  importStatus.textContent = "";
  importLog.textContent = "";

  const f = importFile.files[0];
  if (!f) {
    importStatus.textContent = "No file selected.";
    return;
  }

  const allowed = [".xlsx", ".xls", ".csv"];
  const idx = f.name.lastIndexOf(".");
  const ext = idx >= 0 ? f.name.slice(idx).toLowerCase() : "";
  if (!allowed.includes(ext)) {
    importStatus.textContent = "Only .csv, .xls, .xlsx allowed.";
    return;
  }

  const fd = new FormData();
  fd.append("file", f);

  importStatus.textContent = "Uploading...";

  try {
    const token = getToken();
    const headers = token ? { Authorization: "Bearer " + token } : {};

    const res = await fetch("/admin/import", {
      method: "POST",
      headers,
      body: fd
    });

    const text = await res.text().catch(() => null);
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      importStatus.textContent = `Import failed (${res.status})`;
      importLog.textContent =
        typeof body === "string" ? body : JSON.stringify(body, null, 2);
      console.error("Import failed:", res.status, body);
      return;
    }

    importStatus.textContent = "Import succeeded ✅";
    importLog.textContent =
      typeof body === "string" ? body : JSON.stringify(body, null, 2);

    await loadCategories();
    refresh();
  } catch (err) {
    importStatus.textContent = "Import error (see console)";
    importLog.textContent = String(err.stack || err);
    console.error("Import error:", err);
  }
};

/* ============================
   EXPORT BUTTON
============================ */
btnExport.onclick = async () => {
  try {
    const cat = currentCategory
      ? `&categoryId=${encodeURIComponent(currentCategory)}`
      : "";
    const url = `/admin/export?format=xlsx${cat}`;

    const token = getToken();
    if (!token) {
      alert("Please login as admin to export.");
      return;
    }

    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Export failed", res.status, txt);
      alert("Export failed (see console).");
      return;
    }

    const blob = await res.blob();
    const filename =
      res.headers
        .get("content-disposition")
        ?.match(/filename="(.+)"/)?.[1] ||
      `companies_${currentCategory || "all"}.xlsx`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("Export error", err);
    alert("Export failed (see console).");
  }
};

/* ============================
   LIST ADMINS / NOTIFICATIONS
============================ */
btnListAdmins.onclick = async () => {
  try {
    const token = getToken();
    if (!token) {
      alert("Login required");
      return;
    }

    const notes = await api("/admin/notifications");
    if (!notes || !notes.length) {
      alert("No notifications.");
      return;
    }

    const msg = notes
      .slice(0, 20)
      .map(n => `${n.created_at} • ${n.type} • ${n.message}`)
      .join("\n");
    alert(msg);
  } catch (err) {
    console.error("List admins/notifications error", err);
    alert("Failed to fetch notifications (see console).");
  }
};

/* ============================
   INIT
============================ */
(async function init() {
  await loadCategories();
  if (getToken() && infoEl) infoEl.textContent = "Logged in";
  refresh();
})();
