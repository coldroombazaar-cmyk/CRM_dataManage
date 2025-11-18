const $ = id => document.getElementById(id);

/* FORM ELEMENTS */
const addForm = $("addForm");
const imagesInput = $("images");
const preview = $("preview");
const msg = $("msg");

/* SEARCH ELEMENTS */
const searchCategory = $("searchCategory");
const searchBox = $("searchBox");
const searchBtn = $("searchBtn");
const results = $("results");
const suggestBox = $("suggestBox");

/* MULTI-CATEGORY POPUP ELEMENTS */
const multiCatSelect = $("multiCatSelect");
const categoryModal = $("categoryModal");
const catSearchPopup = $("catSearchPopup");
const catCheckboxList = $("catCheckboxList");
const catCancel = $("catCancel");
const catApply = $("catApply");
const hiddenSelected = $("selectedCategories");

/* =====================================
   GLOBAL STATE
===================================== */
let allCategories = [];
let selectedCategoryIds = [];

/* =====================================
   LOAD CATEGORIES
===================================== */
async function loadCategories() {
  const res = await fetch("/categories");
  allCategories = await res.json();

  // Search dropdown
  searchCategory.innerHTML = `<option value="">All</option>`;
  allCategories.forEach(c => {
    searchCategory.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  // Render checkboxes in popup
  renderCategoryCheckboxes();
}

/* =====================================
   RENDER CHECKBOX POPUP
===================================== */
function renderCategoryCheckboxes(filter = "") {
  catCheckboxList.innerHTML = "";

  allCategories
    .filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(c => {
      const checked = selectedCategoryIds.includes(c.id) ? "checked" : "";
      catCheckboxList.innerHTML += `
        <label>
          <input type="checkbox" value="${c.id}" ${checked}>
          ${c.name}
        </label>
      `;
    });
}

/* =====================================
   OPEN POPUP
===================================== */
multiCatSelect.onclick = () => {
  categoryModal.classList.remove("hidden");
};

/* =====================================
   CLOSE POPUP
===================================== */
catCancel.onclick = () => {
  categoryModal.classList.add("hidden");
};

/* =====================================
   APPLY SELECTED CATEGORIES
===================================== */
catApply.onclick = () => {
  const checks = Array.from(catCheckboxList.querySelectorAll("input:checked"));
  selectedCategoryIds = checks.map(c => Number(c.value));

  // Show selected names
  const names = allCategories
    .filter(c => selectedCategoryIds.includes(c.id))
    .map(c => c.name)
    .join(", ");

  multiCatSelect.textContent = names || "Select Categories";
  hiddenSelected.value = JSON.stringify(selectedCategoryIds);

  categoryModal.classList.add("hidden");
};

/* =====================================
   POPUP SEARCH
===================================== */
catSearchPopup.oninput = e => {
  renderCategoryCheckboxes(e.target.value);
};

/* =====================================
   IMAGE PREVIEW
===================================== */
imagesInput.onchange = () => {
  preview.innerHTML = "";
  [...imagesInput.files].forEach(f => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    preview.appendChild(img);
  });
};

/* =====================================
   ADD BUSINESS (WITH MULTI CATEGORY)
===================================== */
addForm.onsubmit = async e => {
  e.preventDefault();
  msg.textContent = "Saving...";

  const fd = new FormData(addForm);
  fd.append("categoryIds", JSON.stringify(selectedCategoryIds));

  const res = await fetch("/api/companies", {
    method: "POST",
    body: fd
  });

  const data = await res.json();

  if (data.success) {
    msg.textContent = "Added!";
    addForm.reset();
    preview.innerHTML = "";
    selectedCategoryIds = [];
    multiCatSelect.textContent = "Select Categories";
  } else {
    msg.textContent = data.error || "Failed";
  }

  setTimeout(() => (msg.textContent = ""), 2000);
};

/* =====================================
   CLEAR FORM
===================================== */
$("clear").onclick = () => {
  addForm.reset();
  preview.innerHTML = "";
  selectedCategoryIds = [];
  multiCatSelect.textContent = "Select Categories";
};

/* =====================================
   SEARCH
===================================== */
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

  if (q.length < 2 && !cat) {
    results.textContent = "Type at least 2 letters to search.";
    return;
  }

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

/* RESULT CARD */
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

/* =====================================
   DARK MODE
===================================== */
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
