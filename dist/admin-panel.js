/* ============================================================
   SHORTCUTS & GLOBALS
============================================================ */
const $ = id => document.getElementById(id);
const API_URL = window.API_CONFIG?.API_BASE_URL || 'http://localhost:3000';
const tokenKey = "admin_token";
const getToken = () => localStorage.getItem(tokenKey);
const setToken = v =>
  v ? localStorage.setItem(tokenKey, v) : localStorage.removeItem(tokenKey);

/* ============================================================
   API WRAPPER
============================================================ */
async function api(path, opts = {}) {
  // Prepend API_URL if path doesn't start with http
  const fullPath = path.startsWith('http') ? path : (API_URL + path);
  
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

  const res = await fetch(fullPath, opts);
  if (res.status === 401) {
    setToken(null);
    window.location.href = "/admin.html";
    return;
  }

  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/* ============================================================
   DOM ELEMENTS
============================================================ */
const catsDiv = $("cats");
const catSearch = $("categorySearch");
const filterText = $("filterText");
const listEl = $("list");
const sidebar = $("sidebar");
const mobileSidebarToggle = $("mobileSidebarToggle");
const layout = $("layout");

const btnRefresh = $("btnRefresh");
const btnLogout = $("btnLogout");
const btnExport = $("btnExport");
const btnListAdmins = $("btnListAdmins");
const btnDeleteSelected = $("btnDeleteSelected");

const btnPrevPage = $("btnPrevPage");
const btnNextPage = $("btnNextPage");
const btnGoTop = $("btnGoTop");
const pageInfo = $("pageInfo");

/* IMPORT */
const importFile = $("importFile");
const btnImport = $("btnImport");
const importStatus = $("importStatus");
const importLog = $("importLog");

const infoEl = $("info");

/* EDIT MODAL */
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

/* DELETE MODAL */
const deleteModal = $("deleteModal");
const deleteConfirm = $("deleteConfirm");
const deleteCancel = $("deleteCancel");

/* PREMIUM MODAL */
const premiumModal = $("premiumModal");
const premiumStart = $("premiumStart");
const premiumEnd = $("premiumEnd");
const premiumSave = $("premiumSave");
const premiumCancel = $("premiumCancel");

/* DROPDOWN ELEMENTS (CUSTOM CATEGORY DROPDOWN) */
const categoryDropdown = $("categoryDropdown");
const categorySelected = $("categorySelected");
const categoryMenu = $("categoryMenu");
const categorySearchInput = $("categorySearchInput");
const categoryOptions = $("categoryOptions");

/* ============================================================
   STATE
============================================================ */
let categories = [];
let lastRows = [];
let currentCategory = null;     // null = All categories
let selectedIds = new Set();
let editingId = null;
let deletingId = null;
let premiumForId = null;

/* PAGINATION */
let currentPage = 1;
let totalPages = 1;
const pageSize = 10; // 10 items per page

/* ============================================================
   UTILS
============================================================ */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ============================================================
   LOAD CATEGORIES
============================================================ */
async function loadCategories() {
  const res = await fetch("/categories");
  categories = await res.json();

  // Sidebar categories
  if (catsDiv) {
    catsDiv.innerHTML = "";
    categories.forEach(c => {
      const div = document.createElement("div");
      div.className = "cat";
      div.textContent = c.name;

      div.onclick = () => {
        currentCategory = currentCategory === c.id ? null : c.id;
        currentPage = 1;
        syncCategoryUI();
        refresh();
      };

      catsDiv.appendChild(div);
    });
  }

  // Edit modal dropdown
  if (editCategory) {
    editCategory.innerHTML = `<option value="">Select category</option>`;
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      editCategory.appendChild(opt);
    });
  }

  // Custom dropdown options
  setupCategoryDropdownOptions();

  syncCategoryUI();
}

/* ============================================================
   SIDEBAR CATEGORY SEARCH
============================================================ */
if (catSearch) {
  catSearch.oninput = () => {
    const q = catSearch.value.toLowerCase().trim();
    Array.from(catsDiv.children).forEach(div => {
      const name = div.textContent.toLowerCase();
      div.style.display = name.includes(q) ? "block" : "none";
    });
  };
}

/* ============================================================
   CUSTOM CATEGORY DROPDOWN (TOP BAR)
============================================================ */
function setupCategoryDropdownOptions(filterText = "") {
  if (!categoryOptions) return;

  const q = filterText.toLowerCase().trim();
  categoryOptions.innerHTML = "";

  // "All categories" option
  const allDiv = document.createElement("div");
  allDiv.className = "dropdown-option";
  allDiv.textContent = "All categories";
  allDiv.onclick = () => {
    currentCategory = null;
    currentPage = 1;
    syncCategoryUI();
    if (categoryMenu) categoryMenu.classList.add("hidden");
    refresh();
  };
  categoryOptions.appendChild(allDiv);

  // Category options
  categories.forEach(c => {
    if (q && !c.name.toLowerCase().includes(q)) return;

    const opt = document.createElement("div");
    opt.className = "dropdown-option";
    opt.textContent = c.name;
    opt.dataset.id = c.id;

    opt.onclick = () => {
      currentCategory = c.id;
      currentPage = 1;
      syncCategoryUI();
      if (categoryMenu) categoryMenu.classList.add("hidden");
      refresh();
    };

    categoryOptions.appendChild(opt);
  });
}

// Dropdown interactions
if (categorySelected && categoryMenu && categoryDropdown) {
  categorySelected.onclick = () => {
    categoryMenu.classList.toggle("hidden");
  };

  document.addEventListener("click", e => {
    if (!categoryDropdown.contains(e.target)) {
      categoryMenu.classList.add("hidden");
    }
  });
}

if (categorySearchInput) {
  categorySearchInput.oninput = () => {
    setupCategoryDropdownOptions(categorySearchInput.value);
  };
}

/* Keep sidebar + dropdown label in sync */
function syncCategoryUI() {
  // Sidebar highlights
  if (catsDiv) {
    Array.from(catsDiv.children).forEach((node, i) => {
      const c = categories[i];
      node.classList.toggle("active", c && c.id === currentCategory);
    });
  }

  // Dropdown label text
  if (categorySelected) {
    if (!currentCategory) {
      categorySelected.textContent = "All categories";
    } else {
      const c = categories.find(cat => cat.id === currentCategory);
      categorySelected.textContent = c ? c.name : "All categories";
    }
  }
}

/* ============================================================
   MOBILE MENU HANDLER
============================================================ */
if (mobileSidebarToggle && sidebar) {
  mobileSidebarToggle.onclick = () => {
    sidebar.classList.toggle("active");
  };

  // Close sidebar when clicking on a button in the sidebar
  sidebar.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
      }
    });
  });

  // Close sidebar when clicking main content on mobile
  if (layout) {
    layout.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
        sidebar.classList.remove("active");
      }
    });
  }
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
  if (currentCategory) params.push(`categoryId=${currentCategory}`);
  params.push(`page=${currentPage}`);
  params.push(`limit=${pageSize}`);

  const query = "?" + params.join("&");

  const data = await api("/admin/companies" + query);
  if (!data || !Array.isArray(data.rows)) {
    listEl.innerHTML = "<div class='small'>Error loading companies.</div>";
    return;
  }

  lastRows = data.rows;
  const total = data.total || 0;
  totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  // Update pagination UI
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
  if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;

  // Filter inside current page by company name text
  const t = (filterText?.value || "").toLowerCase().trim();
  const rows = t
    ? lastRows.filter(r => (r.businessName || "").toLowerCase().includes(t))
    : lastRows;

  if (!rows.length) {
    listEl.innerHTML = "<div class='small'>No companies found.</div>";
    return;
  }

  listEl.innerHTML = rows.map(renderItem).join("");

  // Attach row events
  listEl.querySelectorAll(".item").forEach(el => {
    const id = el.dataset.id;
    const editBtn = el.querySelector("[data-edit]");
    const delBtn = el.querySelector("[data-del]");
    const premBtn = el.querySelector("[data-premium]");
    const check = el.querySelector(".row-check");

    if (editBtn) editBtn.onclick = () => openEdit(id);
    if (delBtn) delBtn.onclick = () => openDelete(id);
    if (premBtn) premBtn.onclick = () => openPremium(id);
    if (check) {
      check.onchange = e => {
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
      };
    }
  });
}

/* ============================================================
   RENDER ITEM
============================================================ */
function renderItem(it) {
  const catName =
    categories.find(c => c.id === it.category_id)?.name || "Unknown";

  return `
    <div class="item ${it.is_premium ? "premium" : ""}" data-id="${it.id}">
      <div>
        <div class="title">${escapeHtml(it.businessName)}</div>
        <div class="meta">${escapeHtml(it.ownerName || "")} • ${escapeHtml(catName)}</div>
        <div class="meta">${escapeHtml(it.description || "")}</div>
      </div>

      <div class="right">
        <input type="checkbox" class="row-check" />

        ${it.is_premium ? `<div class="badge-premium">★ Premium</div>` : ""}

        <div class="meta contact">
            ${escapeHtml(it.contactNumber || "")}
            ${
              it.contactNumber
                ? `<a href="https://wa.me/${encodeURIComponent(it.contactNumber)}"
                      target="_blank" 
                      rel="noopener noreferrer" 
                      class="wa-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                          viewBox="0 0 24 24" fill="#25D366">
                          <path d="M20.52 3.48A11.76 11.76 0 0 0 12 0C5.37 0 .27 5.1.27 11.73a11.66 11.66 0 0 0 1.59 5.88L0 24l6.62-1.73a11.73 11.73 0 0 0 5.38 1.33h.01c6.63 0 11.73-5.1 11.73-11.73a11.67 11.67 0 0 0-3.22-8.39zM12 21.5c-1.71 0-3.38-.45-4.84-1.31l-.35-.2-3.93 1.03 1.05-3.83-.23-.39A9.83 9.83 0 0 1 2.17 11.7C2.17 6.38 6.68 1.88 12 1.88c2.61 0 5.07 1.02 6.92 2.87A9.74 9.74 0 0 1 21.83 11.7c0 5.32-4.51 9.8-9.83 9.8zm5.12-7.39c-.28-.14-1.65-.82-1.9-.91-.25-.09-.43-.14-.61.14-.18.27-.7.91-.86 1.1-.16.18-.32.2-.6.07a8.43 8.43 0 0 1-2.47-1.53 9.38 9.38 0 0 1-1.76-2.19c-.18-.32-.02-.49.13-.64.14-.14.32-.37.48-.55.16-.18.21-.32.32-.54.11-.23.07-.41-.04-.55-.11-.14-.61-1.47-.83-2.01-.22-.54-.46-.47-.61-.48-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.97.95-.97 2.32 0 1.37.99 2.69 1.13 2.88.14.18 1.94 3.06 4.77 4.29.66.28 1.18.45 1.58.58.66.21 1.25.18 1.72.11.53-.08 1.65-.67 1.88-1.32.23-.64.23-1.19.16-1.32-.07-.13-.25-.2-.53-.34z"/>
                      </svg>
                  </a>`
                : ""
            }
          </div>

        <div class="controls">
          <button data-edit class="ghost">Edit</button>
          <button data-del class="ghost">Delete</button>
          <button data-premium class="ghost">
            ${it.is_premium ? "Change Premium" : "Set Premium"}
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   PAGINATION BUTTONS
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

if (btnGoTop) {
  btnGoTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   EDIT MODAL
============================================================ */
function openEdit(id) {
  editingId = id;
  const it = lastRows.find(r => String(r.id) === String(id));
  if (!it || !editModal) return;

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

if (editCancel && editModal) {
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

    if (editModal) editModal.classList.add("hidden");
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

if (deleteCancel && deleteModal) {
  deleteCancel.onclick = () => deleteModal.classList.add("hidden");
}

if (deleteConfirm) {
  deleteConfirm.onclick = async () => {
    await api(`/admin/companies/${deletingId}`, { method: "DELETE" });
    if (deleteModal) deleteModal.classList.add("hidden");
    refresh();
  };
}

/* ============================================================
   PREMIUM MODAL
============================================================ */
function openPremium(id) {
  premiumForId = id;
  if (!premiumModal) return;

  if (premiumStart) premiumStart.value = new Date().toISOString().slice(0, 10);
  if (premiumEnd) premiumEnd.value = "";
  premiumModal.classList.remove("hidden");
}

if (premiumCancel && premiumModal) {
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

    if (premiumModal) premiumModal.classList.add("hidden");
    refresh();
  };
}

/* ============================================================
   IMPORT
============================================================ */
if (btnImport) {
  btnImport.onclick = async () => {
    const file = importFile?.files?.[0];
    if (!file) {
      if (importStatus) importStatus.textContent = "No file selected.";
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    if (importStatus) importStatus.textContent = "Uploading…";

    const res = await fetch("/admin/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + getToken() },
      body: fd
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (importStatus)
      importStatus.textContent = res.ok ? "Import successful!" : "Import failed!";
    if (importLog)
      importLog.textContent = typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

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
        .slice(0, 30)
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
   LOGOUT
============================================================ */
if (btnLogout) {
  btnLogout.onclick = () => {
    setToken(null);
    window.location.href = "/admin.html";
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

  if (infoEl) infoEl.textContent = "Logged in";

  await loadCategories();
  refresh();
})();
