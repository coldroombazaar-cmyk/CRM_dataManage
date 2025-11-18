/* ============================================================
   WhatsApp Icon (SVG)
============================================================ */
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

/* BASIC API WRAPPER */
async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  const token = getToken();

  if (!token) {
    window.location.href = "/admin.html";
    return;
  }

  opts.headers["Authorization"] = "Bearer " + token;

  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, opts);

  if (res.status === 401) {
    setToken(null);
    alert("Session expired. Please login again.");
    window.location.href = "/admin.html";
    return;
  }

  const txt = await res.text().catch(() => null);
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return txt;
  }
}

/* DOM ELEMENTS */
const catsDiv = $("cats");
const categoryFilter = $("categoryFilter");
const filterText = $("filterText");
const listEl = $("list");

const btnLogout = $("btnLogout");
const btnRefresh = $("btnRefresh");
const btnExport = $("btnExport");
const btnListAdmins = $("btnListAdmins");
const btnDeleteSelected = $("btnDeleteSelected");

/* pagination controls (may be null if HTML-এ নাই) */
const btnPrevPage = $("btnPrevPage");
const btnNextPage = $("btnNextPage");
const pageInfo = $("pageInfo");

const importFile = $("importFile");
const btnImport = $("btnImport");
const importStatus = $("importStatus");
const importLog = $("importLog");

const infoEl = $("info") || { textContent: "" };

/* Modals */
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

const deleteModal = $("deleteModal");
const deleteConfirm = $("deleteConfirm");
const deleteCancel = $("deleteCancel");

const premiumModal = $("premiumModal");
const premiumStart = $("premiumStart");
const premiumEnd = $("premiumEnd");
const premiumSave = $("premiumSave");
const premiumCancel = $("premiumCancel");

let categories = [];
let lastRows = [];
let currentCategory = null;
let selectedIds = new Set();
let editingId = null;
let deletingId = null;
let premiumForId = null;

/* pagination state */
let currentPage = 1;
let totalPages = 1;
const pageSize = 25;

/* ============================================================
   LOAD CATEGORIES
============================================================ */
async function loadCategories() {
  try {
    const res = await fetch("/categories");
    categories = await res.json();

    catsDiv.innerHTML = "";
    categoryFilter.innerHTML = `<option value="">All categories</option>`;
    editCategory.innerHTML = `<option value="">No category</option>`;

    categories.forEach(c => {
      // sidebar item
      const div = document.createElement("div");
      div.className = "cat";
      div.textContent = c.name;
      div.onclick = () => {
        currentCategory = currentCategory === c.id ? null : c.id;
        syncCategoryUI();
        currentPage = 1;
        refresh();
      };
      catsDiv.appendChild(div);

      // top filter
      const opt1 = document.createElement("option");
      opt1.value = c.id;
      opt1.textContent = c.name;
      categoryFilter.appendChild(opt1);

      // edit modal category
      const opt2 = document.createElement("option");
      opt2.value = c.id;
      opt2.textContent = c.name;
      editCategory.appendChild(opt2);
    });

    syncCategoryUI();
  } catch (err) {
    console.error("Failed to load categories", err);
  }
}

function syncCategoryUI() {
  // sidebar highlight
  Array.from(catsDiv.children).forEach((node, idx) => {
    const c = categories[idx];
    node.classList.toggle("active", c && c.id === currentCategory);
  });
  // top dropdown
  if (categoryFilter) {
    categoryFilter.value = currentCategory ? String(currentCategory) : "";
  }
}

/* category dropdown change */
if (categoryFilter) {
  categoryFilter.onchange = () => {
    const val = categoryFilter.value;
    currentCategory = val ? Number(val) : null;
    currentPage = 1;
    syncCategoryUI();
    refresh();
  };
}

/* ============================================================
   LOGOUT
============================================================ */
if (btnLogout) {
  btnLogout.onclick = () => {
    setToken(null);
    window.location.href = "/admin.html";
  };
}

/* ============================================================
   PAGINATION BUTTONS (safe)
============================================================ */
if (btnPrevPage) {
  btnPrevPage.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      refresh();
    }
  };
}
if (btnNextPage) {
  btnNextPage.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      refresh();
    }
  };
}

/* ============================================================
   REFRESH LIST
============================================================ */
if (btnRefresh) {
  btnRefresh.onclick = () => {
    currentPage = 1;
    refresh();
  };
}

async function refresh() {
  if (!listEl) return;

  listEl.innerHTML = "<div class='small'>Loading…</div>";
  selectedIds.clear();

  const params = [];
  if (currentCategory) params.push(`categoryId=${encodeURIComponent(currentCategory)}`);
  params.push(`page=${currentPage}`);
  params.push(`limit=${pageSize}`);

  const query = "?" + params.join("&");
  const data = await api("/admin/companies" + query);
  if (!data || !Array.isArray(data.rows)) {
    listEl.innerHTML = "<div class='small'>Error loading companies.</div>";
    return;
  }

  lastRows = data.rows;
  const total = data.total || data.rows.length;
  totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  }
  if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
  if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;

  const text = filterText ? filterText.value.trim().toLowerCase() : "";
  const filtered = text
    ? lastRows.filter(r => (r.businessName || "").toLowerCase().includes(text))
    : lastRows;

  if (!filtered.length) {
    listEl.innerHTML = "<div class='small'>No companies found.</div>";
    return;
  }

  listEl.innerHTML = filtered.map(renderItem).join("");

  listEl.querySelectorAll(".item").forEach(el => {
    const id = el.dataset.id;
    const btnE = el.querySelector("[data-edit]");
    const btnD = el.querySelector("[data-del]");
    const btnP = el.querySelector("[data-premium]");
    const chk = el.querySelector(".row-check");

    if (btnE) btnE.onclick = () => openEdit(id);
    if (btnD) btnD.onclick = () => openDelete(id);
    if (btnP) btnP.onclick = () => openPremium(id);
    if (chk) {
      chk.onchange = e => {
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
      };
    }
  });
}

function renderItem(it) {
  const cat =
    categories.find(c => c.id === it.category_id)?.name ||
    it.category ||
    "Unknown";

  return `
    <div class="item ${it.is_premium ? "premium" : ""}" data-id="${it.id}">
      <div>
        <div class="title">${escapeHtml(it.businessName)}</div>
        <div class="meta">${escapeHtml(it.ownerName || "")} • ${escapeHtml(cat)}</div>
        <div class="meta">${escapeHtml(it.description || "")}</div>
      </div>

      <div class="right">
        <input type="checkbox" class="row-check" />
        ${it.is_premium ? `<div class="badge-premium">★ Premium</div>` : ""}

        <div class="meta contact">
          ${escapeHtml(it.contactNumber || "")}
          ${
            it.contactNumber
              ? `<a href="https://wa.me/${encodeURIComponent(it.contactNumber)}" target="_blank" rel="noopener noreferrer">${wpIcon}</a>`
              : ""
          }
        </div>

        <div class="controls">
          <button data-edit class="ghost">Edit</button>
          <button data-del class="ghost">Delete</button>
          <button data-premium class="ghost">${
            it.is_premium ? "Change Premium" : "Set Premium"
          }</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ============================================================
   EDIT MODAL
============================================================ */
function openEdit(id) {
  editingId = id;

  const it = lastRows.find(r => String(r.id) === String(id));
  if (!it) return;

  if (!editModal) return;

  editName.value = it.businessName || "";
  editOwner.value = it.ownerName || "";
  editState.value = it.state || "";
  editPhone.value = it.contactNumber || "";
  editWhatsapp.value = it.whatsappNumber || "";
  editEmail.value = it.email || "";
  editWebsite.value = it.website || "";
  editGst.value = it.gstNo || "";
  editDescription.value = it.description || "";
  editCategory.value = it.category_id || "";

  editModal.classList.remove("hidden");
}

if (editCancel) {
  editCancel.onclick = () => editModal.classList.add("hidden");
}

if (editSave) {
  editSave.onclick = async () => {
    await api(`/admin/companies/${editingId}`, {
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
        category_id: editCategory.value || null
      }
    });

    editModal.classList.add("hidden");
    refresh();
  };
}

/* ============================================================
   DELETE MODAL
============================================================ */
function openDelete(id) {
  deletingId = id;
  if (deleteModal) deleteModal.classList.remove("hidden");
}

if (deleteCancel) {
  deleteCancel.onclick = () => deleteModal.classList.add("hidden");
}

if (deleteConfirm) {
  deleteConfirm.onclick = async () => {
    await api(`/admin/companies/${deletingId}`, { method: "DELETE" });
    deleteModal.classList.add("hidden");
    refresh();
  };
}

/* ============================================================
   PREMIUM MODAL
============================================================ */
function openPremium(id) {
  premiumForId = id;
  if (!premiumModal) return;

  premiumStart.value = new Date().toISOString().slice(0, 10);
  premiumEnd.value = "";
  premiumModal.classList.remove("hidden");
}

if (premiumCancel) {
  premiumCancel.onclick = () => premiumModal.classList.add("hidden");
}

if (premiumSave) {
  premiumSave.onclick = async () => {
    await api(`/admin/companies/${premiumForId}/premium`, {
      method: "POST",
      body: {
        start: premiumStart.value,
        end: premiumEnd.value
      }
    });

    premiumModal.classList.add("hidden");
    refresh();
  };
}

/* ============================================================
   IMPORT
============================================================ */
if (btnImport) {
  btnImport.onclick = async () => {
    const file = importFile.files[0];

    if (!file) {
      importStatus.textContent = "No file selected.";
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    importStatus.textContent = "Uploading…";

    const res = await fetch("/admin/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + getToken() },
      body: fd
    });

    const txt = await res.text();
    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      data = txt;
    }

    importStatus.textContent = res.ok ? "Import successful!" : "Import failed!";
    importLog.textContent = JSON.stringify(data, null, 2);

    if (res.ok) {
      await loadCategories();
      refresh();
    }
  };
}

/* ============================================================
   EXPORT
============================================================ */
if (btnExport) {
  btnExport.onclick = async () => {
    const cat = currentCategory ? `&categoryId=${currentCategory}` : "";

    const res = await fetch(`/admin/export?format=xlsx${cat}`, {
      headers: { Authorization: "Bearer " + getToken() }
    });

    if (!res.ok) {
      alert("Export failed");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "companies.xlsx";
    a.click();
  };
}

/* ============================================================
   NOTIFICATIONS
============================================================ */
if (btnListAdmins) {
  btnListAdmins.onclick = async () => {
    const list = await api("/admin/notifications");

    if (!list?.length) {
      alert("No notifications.");
      return;
    }

    alert(
      list
        .slice(0, 20)
        .map(n => `${n.created_at} — ${n.type}: ${n.message}`)
        .join("\n\n")
    );
  };
}

/* ============================================================
   DELETE SELECTED
============================================================ */
if (btnDeleteSelected) {
  btnDeleteSelected.onclick = async () => {
    if (!selectedIds.size) {
      alert("No companies selected.");
      return;
    }

    if (!confirm(`Delete ${selectedIds.size} items?`)) return;

    await Promise.all(
      [...selectedIds].map(id =>
        api(`/admin/companies/${id}`, { method: "DELETE" })
      )
    );

    selectedIds.clear();
    refresh();
  };
}

/* ============================================================
   INIT
============================================================ */
(async function init() {
  if (!getToken()) {
    window.location.href = "/admin.html";
    return;
  }

  infoEl.textContent = "Logged in";

  await loadCategories();
  refresh();
})();
