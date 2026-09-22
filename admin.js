const API_BASE = "../api";

let products = [];
let categories = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => el.hidden = true, 2800);
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: "Respons server tidak valid."
  }));

  if (!response.ok || !data.success) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data.data;
}

async function checkApi() {
  const status = $("#apiStatus");
  try {
    await apiRequest("health.php");
    status.textContent = "API + Database Terhubung";
    status.style.background = "#e7f4eb";
    status.style.color = "#27763e";
    $("#statSystem").textContent = "OK";
  } catch (error) {
    status.textContent = "API Belum Terhubung";
    status.style.background = "#f7e9e9";
    status.style.color = "#9b3e3e";
    $("#statSystem").textContent = "OFF";
    console.warn(error);
  }
}

async function loadCategories() {
  try {
    categories = await apiRequest("categories.php");
    renderCategories();
    fillCategorySelects();
    $("#statCategories").textContent = categories.length;
  } catch (error) {
    $("#categoriesList").innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

function renderCategories() {
  const list = $("#categoriesList");
  if (!categories.length) {
    list.innerHTML = '<div class="empty">Belum ada kategori.</div>';
    return;
  }

  list.innerHTML = categories.map(c => `
    <div class="category-item">
      <strong>${escapeHtml(c.name)}</strong>
      <span>${escapeHtml(c.slug)}</span>
    </div>
  `).join("");
}

function fillCategorySelects() {
  const options = categories.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join("");

  $("#productCategory").innerHTML =
    `<option value="">Pilih kategori</option>${options}`;

  $("#productCategoryFilter").innerHTML =
    `<option value="">Semua kategori</option>` +
    categories.map(c =>
      `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`
    ).join("");
}

async function loadProducts() {
  try {
    products = await apiRequest("products.php");
    renderProducts();
    updateStats();
  } catch (error) {
    $("#productsTableBody").innerHTML =
      `<tr><td colspan="5" class="empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

function updateStats() {
  $("#statProducts").textContent = products.length;
  $("#statActive").textContent =
    products.filter(p => Number(p.is_active) === 1).length;
}

function renderProducts() {
  const body = $("#productsTableBody");
  const search = $("#productSearch").value.toLowerCase().trim();
  const category = $("#productCategoryFilter").value;

  const filtered = products.filter(p => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search) ||
      (p.sku || "").toLowerCase().includes(search);

    const matchesCategory =
      !category || p.category_slug === category;

    return matchesSearch && matchesCategory;
  });

  if (!filtered.length) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty">Produk tidak ditemukan.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(p => `
    <tr>
      <td>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">${escapeHtml(p.slug)}</span>
      </td>
      <td>${escapeHtml(p.category_name || "Tanpa kategori")}</td>
      <td>${p.price ? formatRupiah(p.price) : "Belum diatur"}</td>
      <td>
        <span class="status ${Number(p.is_active) === 1 ? "" : "off"}">
          ${Number(p.is_active) === 1 ? "AKTIF" : "NONAKTIF"}
        </span>
      </td>
      <td>
        <div class="action-group">
          <button class="small-btn" data-edit="${p.id}">Edit</button>
          <button class="small-btn delete" data-delete="${p.id}">Hapus</button>
        </div>
      </td>
    </tr>
  `).join("");

  $$("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEditProduct(Number(btn.dataset.edit)))
  );

  $$("[data-delete]").forEach(btn =>
    btn.addEventListener("click", () => deleteProduct(Number(btn.dataset.delete)))
  );
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showPage(page) {
  $$(".page").forEach(el => el.classList.remove("active"));
  $(`#page-${page}`).classList.add("active");

  $$(".nav-item[data-page]").forEach(el =>
    el.classList.toggle("active", el.dataset.page === page)
  );

  const titles = {
    dashboard: "Dashboard",
    products: "Produk",
    categories: "Kategori",
    content: "Konten Website",
    settings: "Pengaturan"
  };

  $("#pageTitle").textContent = titles[page] || "Dashboard";
  $("#sidebar").classList.remove("open");
}

$$(".nav-item[data-page]").forEach(btn =>
  btn.addEventListener("click", () => showPage(btn.dataset.page))
);

$$("[data-go]").forEach(btn =>
  btn.addEventListener("click", () => showPage(btn.dataset.go))
);

$("#mobileMenu").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open")
);

function openProductModal(product = null) {
  $("#productModal").hidden = false;

  $("#modalTitle").textContent =
    product ? "Edit Produk" : "Tambah Produk";

  $("#productId").value = product?.id || "";
  $("#productName").value = product?.name || "";
  $("#productSlug").value = product?.slug || "";
  $("#productCategory").value = product?.category_id || "";
  $("#productPrice").value = product?.price || "";
  $("#productSize").value = product?.size_label || "";
  $("#productBadge").value = product?.badge || "";
  $("#productShort").value = product?.short_description || "";
  $("#productDescription").value = product?.description || "";
  $("#productUsage").value = product?.usage_instructions || "";
  $("#productSafety").value = product?.safety_information || "";
  $("#productOrder").value = product?.sort_order || 0;
  $("#productFeatured").checked = Number(product?.is_featured) === 1;
  $("#productActive").checked =
    product ? Number(product.is_active) === 1 : true;
}

/*...*/