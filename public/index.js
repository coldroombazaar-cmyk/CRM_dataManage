const $ = id => document.getElementById(id);

const addForm = $("addForm");
const imagesInput = $("images");
const preview = $("preview");
const msg = $("msg");

const categorySelect = $("categorySelect");
const searchCategory = $("searchCategory");
const searchBox = $("searchBox");
const searchBtn = $("searchBtn");
const results = $("results");
const suggestBox = $("suggestBox");

/* ===============================================
   Load Categories
=============================================== */
async function loadCategories() {
  const r = await fetch("/categories");
  const cats = await r.json();

  categorySelect.innerHTML = `<option value="">— No category — (Unknown)</option>`;
  searchCategory.innerHTML = `<option value="">All</option>`;

  cats.forEach(c => {
    categorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    searchCategory.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

/* ===============================================
   Image Preview
=============================================== */
imagesInput.onchange = () => {
  preview.innerHTML = "";
  [...imagesInput.files].forEach(f => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    preview.appendChild(img);
  });
};

/* ===============================================
   ADD BUSINESS
=============================================== */
addForm.onsubmit = async e => {
  e.preventDefault();

  msg.textContent = "Saving...";

  const fd = new FormData(addForm);

  const catId = fd.get("categoryId");
  if (catId) {
    const selected = categorySelect.selectedOptions[0]?.textContent;
    fd.append("category", selected);
  }

  const r = await fetch("/api/companies", { method: "POST", body: fd });
  const data = await r.json();

  if (data.success) {
    msg.textContent = "Added!";
    addForm.reset();
    preview.innerHTML = "";
  } else {
    msg.textContent = data.error || "Failed";
  }

  setTimeout(() => (msg.textContent = ""), 2000);
};

$("clear").onclick = () => {
  addForm.reset();
  preview.innerHTML = "";
};

/* ===============================================
   LIVE SUGGEST — REMOVED
=============================================== */
searchBox.oninput = () => {
  suggestBox.style.display = "none";
};

/* ===============================================
   SEARCH
=============================================== */
searchBtn.onclick = doSearch;

searchBox.onkeydown = e => {
  if (e.key === "Enter") {
    e.preventDefault();
    doSearch();
  }
};

async function doSearch() {
  const q = searchBox.value.trim();
  const cat = searchCategory.value;

  results.innerHTML = "Searching...";

  let url = "/api/companies?q=" + encodeURIComponent(q);
  if (cat) url += "&categoryId=" + encodeURIComponent(cat);

  const r = await fetch(url);
  const list = await r.json();

  if (!list.length) {
    results.textContent = "No results found.";
    return;
  }

  results.innerHTML = list.map(render).join("");
}

function render(it) {
  return `
    <div class="result-card">
      <div>
        <b>${it.businessName}</b>
        <div class="meta">${it.ownerName || ""} • ${it.state}</div>
        <div class="meta">${it.description || ""}</div>
        <div class="meta">GST: ${it.gstNo || "—"}</div>
      </div>
      <div style="text-align:right">
        ${it.is_premium ? `<div class="badge-premium">★ Premium</div>` : ""}
        <div class="meta">${it.contactNumber || ""}</div>
      </div>
    </div>
  `;
}

/* ===============================================
   DARK MODE
=============================================== */
const html = document.documentElement;
const toggle = $("toggleTheme");

if (localStorage.getItem("theme") === "dark") {
  html.classList.add("dark");
  toggle.textContent = "☀️ Light";
}

toggle.onclick = () => {
  html.classList.toggle("dark");
  const isDark = html.classList.contains("dark");
  toggle.textContent = isDark ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("theme", isDark ? "dark" : "light");
};

/* INIT */
loadCategories();
