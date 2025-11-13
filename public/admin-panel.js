/* ========================
      WhatsApp Icon SVG
======================== */
const wpIcon = `
  <svg class="wp-icon" viewBox="0 0 32 32" fill="#25D366">
    <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.83.74 5.58 2.14 8.02L.5 31.5l7.73-2.03A15.36 15.36 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5Zm0 28.2c-2.44 0-4.83-.65-6.92-1.88l-.5-.29-4.58 1.2 1.22-4.46-.32-.57A13.08 13.08 0 0 1 2.8 16c0-7.27 5.93-13.2 13.2-13.2 7.27 0 13.2 5.93 13.2 13.2S23.27 28.7 16 28.7Zm7.33-10.08c-.4-.2-2.36-1.17-2.73-1.31-.36-.13-.63-.2-.9.2-.27.4-1.03 1.31-1.27 1.58-.23.27-.47.3-.87.1-.4-.2-1.68-.62-3.2-2-.12-.1-1.1-.97-1.32-1.88-.23-.9.14-1.35.35-1.57.18-.18.4-.47.6-.7.2-.23.27-.4.4-.67.13-.27.07-.5 0-.7-.07-.2-.9-2.17-1.23-2.97-.33-.8-.67-.7-.9-.7h-.77c-.27 0-.7.1-1.06.5-.36.4-1.4 1.36-1.4 3.32 0 1.96 1.43 3.85 1.63 4.12.2.27 2.8 4.27 6.82 5.98 4.02 1.71 4.02 1.14 4.74 1.07.72-.07 2.36-.96 2.7-1.9.33-.93.33-1.73.23-1.9-.1-.17-.36-.27-.77-.47Z"/>
  </svg>
`;

/* ============================
   SHORTCUT
============================ */
const $ = id => document.getElementById(id);

/* TOKEN HELPERS */
const tokenKey = "admin_token";
const getToken = () => localStorage.getItem(tokenKey) || "";
const setToken = v => v ? localStorage.setItem(tokenKey, v) : localStorage.removeItem(tokenKey);

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
  if (res.status === 401) { setToken(null); throw new Error("401 Unauthorized"); }

  const txt = await res.text().catch(()=>null);
  try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
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

const importFile = $("importFile");
const btnImport = $("btnImport");
const importStatus = $("importStatus");
const importLog = $("importLog");

/* Modals */
const editModal = $("editModal");
const editName = $("editName");
const editOwner = $("editOwner");
const editSave = $("editSave");
const editCancel = $("editCancel");

const deleteModal = $("deleteModal");
const deleteConfirm = $("deleteConfirm");
const deleteCancel = $("deleteCancel");

let categories = [];
let currentCategory = null;
let editingId = null;
let deletingId = null;

/* ============================
   LOAD CATEGORIES
============================ */
async function loadCategories() {
  const res = await fetch("/categories");
  categories = await res.json();

  catsDiv.innerHTML = "";
  categoryFilter.innerHTML = `<option value="">— All categories —</option>`;

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
  });

  renderCats();
}

function renderCats() {
  Array.from(catsDiv.children).forEach((n,i) => {
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

  const r = await fetch("/admin/login", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:u,password:p})
  });

  const data = await r.json();
  if (r.ok && data.token) {
    setToken(data.token);
    $("info").textContent = "Logged in";
    refresh();
  } else {
    alert("Login failed");
  }
};

btnLogout.onclick = () => {
  setToken(null);
  $("info").textContent = "Logged out";
  listEl.innerHTML = "";
};

/* ============================
   REFRESH LIST
============================ */
btnRefresh.onclick = refresh;

async function refresh() {
  listEl.innerHTML = "<div class='small'>Loading…</div>";

  const query = currentCategory ? `?categoryId=${currentCategory}` : "";
  const rows = await api("/admin/companies" + query);

  const text = filterText.value.trim().toLowerCase();
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

    node.querySelector("[data-act='edit']").onclick = () => openEdit(id);
    node.querySelector("[data-act='del']").onclick = () => openDelete(id);
    node.querySelector("[data-act='premium']").onclick = () => setPremium(id);
  });
}

function renderItem(it) {
  const catName =
    categories.find(c => c.id === it.category_id)?.name ||
    it.category ||
    "Unknown";

  return `
    <div class="item ${it.is_premium ? "premium" : ""}" data-id="${it.id}">
      <div>
        <div class="title">${escape(it.businessName)}</div>
        <div class="meta">${escape(it.ownerName || "")} • ${escape(catName)}</div>
        <div class="meta">${escape(it.description || "")}</div>
      </div>

      <div class="right">
        ${it.is_premium ? `<div class="badge-premium">★ Premium</div>` : ""}

        <div class="meta contact">
          ${escape(it.contactNumber || "")}

          ${
            it.contactNumber
              ? `<a href="https://wa.me/${it.contactNumber}" target="_blank">${wpIcon}</a>`
              : ""
          }
        </div>

        <div class="controls">
          <button class="ghost" data-act="edit">Edit</button>
          <button class="ghost" data-act="del">Delete</button>
          <button class="ghost" data-act="premium">${it.is_premium ? "Change" : "Set"} Premium</button>
        </div>
      </div>
    </div>
  `;
}

function escape(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  })[c]);
}

/* ============================
   EDIT MODAL
============================ */
function openEdit(id) {
  editingId = id;

  api("/admin/companies")   // FIXED ❗ always load all companies
    .then(rows => {
      const item = rows.find(r => String(r.id) === String(id));
      if (!item) return;

      editName.value = item.businessName;
      editOwner.value = item.ownerName || "";

      editModal.classList.remove("hidden");
    });
}

editCancel.onclick = () => editModal.classList.add("hidden");

editSave.onclick = async () => {
  await api("/admin/companies/" + editingId, {
    method:"PUT",
    body:{
      businessName: editName.value,
      ownerName: editOwner.value
    }
  });

  editModal.classList.add("hidden");
  refresh();
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
  await api("/admin/companies/" + deletingId, {
    method:"DELETE"
  });

  deleteModal.classList.add("hidden");
  refresh();
};

/* ============================
   PREMIUM SET
============================ */
function setPremium(id) {
  const start = prompt("Premium start (YYYY-MM-DD)", new Date().toISOString().slice(0,10));
  if (!start) return;

  const end = prompt("Premium end (YYYY-MM-DD)");
  if (!end) return;

  if (new Date(end) <= new Date(start))
    return alert("Invalid end date");

  api("/admin/companies/" + id + "/premium", {
    method:"POST",
    body:{start,end}
  }).then(refresh);
}

/* ============================
   INIT
============================ */
(async function init() {
  await loadCategories();
  if (getToken()) $("info").textContent = "Logged in";
  refresh();
})();
