const SUPABASE_URL="https://fysaxpqpqexjnlpkbwap.supabase.co";
const SUPABASE_KEY="sb_publishable_DWRaEZTcNMjhglwN3nqCOw_pua8rsjD";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let products=[],categories=[];
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
function toast(m){const e=$("#toast");e.textContent=m;e.hidden=false;setTimeout(()=>e.hidden=true,2800)}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function rupiah(v){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v)}

async function requireAdmin(){
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user){location.href="login.html";return false}
  const {data:admin,error:adminError}=await db.from("amasa_admins").select("user_id,role").eq("user_id",user.id).eq("role","admin").maybeSingle();
  if(adminError||!admin){
    await db.auth.signOut();
    alert("Akses ditolak. Akun ini bukan Admin AMASA.");
    location.href="login.html";
    return false;
  }
  return true;
}

async function check(){const e=$("#apiStatus");const {error}=await db.from("amasa_products").select("id",{count:"exact",head:true});if(error){e.textContent="Supabase Error";$("#statSystem").textContent="OFF";throw error}e.textContent="Supabase Terhubung";e.style.background="#e7f4eb";e.style.color="#27763e";$("#statSystem").textContent="OK"}
async function loadCategories(){
  const {data,error}=await db.from("amasa_categories")
    .select("id,name,slug,description,sort_order,is_active")
    .order("sort_order",{ascending:true});
  if(error)return toast(error.message);
  categories=data||[];
  const a=categories.filter(x=>x.is_active);
  $("#statCategories").textContent=a.length;
  $("#categoriesList").innerHTML=a.length?a.map(x=>'<div class="category-item" data-category-card="'+x.id+'"><div><strong>'+esc(x.name)+'</strong><span>'+esc(x.slug)+'</span></div><div class="action-group"><button type="button" class="small-btn" data-category-edit="'+x.id+'">Edit</button><button type="button" class="small-btn delete" data-category-delete="'+x.id+'">Hapus</button></div></div>').join(""):'<div class="empty">Belum ada kategori.</div>';
  $("#productCategory").innerHTML='<option value="">Pilih kategori</option>'+a.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
  $("#productCategoryFilter").innerHTML='<option value="">Semua kategori</option>'+a.map(x=>'<option value="'+esc(x.slug)+'">'+esc(x.name)+'</option>').join("");
  document.querySelectorAll("[data-category-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();openCategoryModal(categories.find(x=>String(x.id)===String(b.dataset.categoryEdit)))});
  document.querySelectorAll("[data-category-delete]").forEach(b=>b.onclick=e=>{e.stopPropagation();removeCategory(b.dataset.categoryDelete)});
  document.querySelectorAll("[data-category-card]").forEach(card=>card.onclick=()=>openCategoryModal(categories.find(x=>String(x.id)===String(card.dataset.categoryCard))));
}
function openCategoryModal(category=null){
  $("#categoryModal").hidden=false;
  $("#categoryModalTitle").textContent=category?"Edit Kategori":"Tambah Kategori";
  $("#categoryId").value=category?.id||"";
  $("#categoryName").value=category?.name||"";
  $("#categorySlug").value=category?.slug||"";
  $("#categoryDescription").value=category?.description||"";
  $("#categoryOrder").value=category?.sort_order??0;
  $("#categoryActive").checked=category?!!category.is_active:true;
}
function closeCategoryModal(){$("#categoryModal").hidden=true}
document.querySelectorAll("[data-category-close]").forEach(b=>b.onclick=closeCategoryModal);
$("#addCategoryButton").onclick=()=>openCategoryModal();
$("#categoryForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("#categoryId").value;
  const saveBtn=$("#saveCategory");
  saveBtn.disabled=true;
  saveBtn.textContent="Menyimpan...";
  try{
    const p={
      name:$("#categoryName").value.trim(),
      slug:$("#categorySlug").value.trim().toLowerCase().replace(/\s+/g,"-"),
      description:$("#categoryDescription").value.trim()||null,
      sort_order:Number($("#categoryOrder").value||0),
      is_active:$("#categoryActive").checked
    };
    if(!p.name||!p.slug)throw new Error("Nama dan slug kategori wajib diisi.");
    const r=id
      ? await db.from("amasa_categories").update(p).eq("id",id)
      : await db.from("amasa_categories").insert(p);
    if(r.error)throw r.error;
    closeCategoryModal();
    toast(id?"Kategori berhasil diperbarui.":"Kategori berhasil ditambahkan.");
    await loadCategories();
    await loadProducts();
  }catch(err){
    toast(err?.message||"Gagal menyimpan kategori.");
  }finally{
    saveBtn.disabled=false;
    saveBtn.textContent="Simpan Kategori";
  }
};
async function removeCategory(id){
  const category=categories.find(x=>String(x.id)===String(id));
  if(!category)return;
  if(!confirm('Hapus kategori "'+category.name+'"? Produk pada kategori ini tidak akan ikut terhapus.'))return;
  const {error}=await db.from("amasa_categories").delete().eq("id",id);
  if(error)return toast(error.message);
  toast("Kategori berhasil dihapus.");
  await loadCategories();
  await loadProducts();
}
async function loadProducts(){const {data,error}=await db.from("amasa_products").select("id,category_id,name,slug,sku,short_description,description,image_url,price,size_label,badge,usage_instructions,safety_information,sort_order,is_active,is_featured,amasa_categories(name,slug)").order("sort_order",{ascending:true}).order("name",{ascending:true});if(error){$("#productsTableBody").innerHTML='<tr><td colspan="6" class="empty">'+esc(error.message)+'</td></tr>';return}products=data||[];renderProducts();$("#statProducts").textContent=products.length;$("#statActive").textContent=products.filter(x=>x.is_active).length}
function renderProducts(){const body=$("#productsTableBody"),q=$("#productSearch").value.toLowerCase().trim(),cat=$("#productCategoryFilter").value;const rows=products.filter(p=>(!q||(p.name||"").toLowerCase().includes(q)||(p.sku||"").toLowerCase().includes(q))&&(!cat||p.amasa_categories?.slug===cat));if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty">Produk tidak ditemukan.</td></tr>';return}body.innerHTML=rows.map(p=>'<tr><td><div class="product-name-cell">'+(p.image_url?'<img class="product-thumb" src="'+esc(p.image_url)+'" alt="">':'')+'<div><strong>'+esc(p.name)+'</strong><span class="muted">'+esc(p.sku||p.slug)+'</span></div></div></td><td>'+esc(p.amasa_categories?.name||"Tanpa kategori")+'</td><td>'+(p.price!=null?rupiah(p.price):"Belum diatur")+'</td><td><span class="status '+(p.is_active?"":"off")+'">'+(p.is_active?"AKTIF":"NONAKTIF")+'</span></td><td>'+(p.is_featured?'<span class="featured-badge">★ Unggulan</span>':'—')+'</td><td><div class="action-group"><button class="small-btn" data-edit="'+p.id+'">Edit</button><button class="small-btn delete" data-delete="'+p.id+'">Hapus</button></div></td></tr>').join("");$$("[data-edit]").forEach(b=>b.onclick=()=>openModal(products.find(p=>String(p.id)===String(b.dataset.edit))));$$("[data-delete]").forEach(b=>b.onclick=()=>removeProduct(b.dataset.delete))}
function showPage(p){$$(".page").forEach(x=>x.classList.remove("active"));$("#page-"+p)?.classList.add("active");$$("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===p));$("#pageTitle").textContent={dashboard:"Dashboard",products:"Produk",categories:"Kategori",content:"Konten Website",settings:"Pengaturan"}[p]||"Dashboard";setSidebarOpen(false)}
$$("[data-page]").forEach(b=>b.onclick=()=>showPage(b.dataset.page));$$("[data-go]").forEach(b=>b.onclick=()=>showPage(b.dataset.go));
const mobileMenu=$("#mobileMenu"),sidebar=$("#sidebar");
const sidebarBackdrop=document.createElement("div");
sidebarBackdrop.id="sidebarBackdrop";sidebarBackdrop.hidden=true;document.body.appendChild(sidebarBackdrop);
function setSidebarOpen(open){sidebar.classList.toggle("open",open);sidebarBackdrop.hidden=!open}
mobileMenu.onclick=e=>{e.stopPropagation();setSidebarOpen(!sidebar.classList.contains("open"))};
sidebarBackdrop.onclick=()=>setSidebarOpen(false);
document.addEventListener("pointerdown",e=>{if(sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!mobileMenu.contains(e.target)&&e.target!==sidebarBackdrop)setSidebarOpen(false)});
function openModal(p=null){$("#productModal").hidden=false;$("#modalTitle").textContent=p?"Edit Produk":"Tambah Produk";$("#productId").value=p?.id||"";$("#productName").value=p?.name||"";$("#productSlug").value=p?.slug||"";$("#productCategory").value=p?.category_id||"";$("#productPrice").value=p?.price??"";$("#productImage").value="";$("#productImageInfo").textContent=p?.image_url?"Gambar saat ini tersimpan. Pilih file baru untuk menggantinya.":"JPG, PNG, WEBP. Maksimal 5 MB.";$("#productImagePreview").src=p?.image_url||"";$("#productImagePreview").hidden=!p?.image_url;$("#productSize").value=p?.size_label||"";$("#productBadge").value=p?.badge||"";$("#productShort").value=p?.short_description||"";$("#productDescription").value=p?.description||"";$("#productUsage").value=p?.usage_instructions||"";$("#productSafety").value=p?.safety_information||"";$("#productOrder").value=p?.sort_order??0;$("#productFeatured").checked=!!p?.is_featured;$("#productActive").checked=p?p.is_active:true}
function closeModal(){$("#productModal").hidden=true}$$("[data-close]").forEach(b=>b.onclick=closeModal);$("#addProductButton").onclick=()=>openModal();
$("#productImage").onchange=()=>{const f=$("#productImage").files[0];if(!f){return}if(!f.type.startsWith("image/")){toast("File harus berupa gambar.");$("#productImage").value="";return}if(f.size>5*1024*1024){toast("Ukuran gambar maksimal 5 MB.");$("#productImage").value="";return}$("#productImagePreview").src=URL.createObjectURL(f);$("#productImagePreview").hidden=false;$("#productImageInfo").textContent=f.name+" • "+Math.round(f.size/1024)+" KB"};
async function uploadProductImage(file,productId){const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";const path=productId+"/"+crypto.randomUUID()+"."+ext;const {error}=await db.storage.from("amasa-products").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});if(error)throw error;return db.storage.from("amasa-products").getPublicUrl(path).data.publicUrl}
$("#productForm").onsubmit=async e=>{e.preventDefault();const id=$("#productId").value;const saveBtn=$("#saveProduct");saveBtn.disabled=true;saveBtn.textContent="Menyimpan...";try{const p={name:$("#productName").value.trim(),slug:$("#productSlug").value.trim(),category_id:$("#productCategory").value||null,price:$("#productPrice").value?Number($("#productPrice").value):null,size_label:$("#productSize").value.trim()||null,badge:$("#productBadge").value.trim()||null,short_description:$("#productShort").value.trim()||null,description:$("#productDescription").value.trim()||null,usage_instructions:$("#productUsage").value.trim()||null,safety_information:$("#productSafety").value.trim()||null,sort_order:Number($("#productOrder").value||0),is_featured:$("#productFeatured").checked,is_active:$("#productActive").checked};let productId=id;if(!productId){const r=await db.from("amasa_products").insert(p).select("id").single();if(r.error)throw r.error;productId=r.data.id}else{const r=await db.from("amasa_products").update(p).eq("id",productId);if(r.error)throw r.error}const file=$("#productImage").files[0];if(file){const imageUrl=await uploadProductImage(file,productId);const r=await db.from("amasa_products").update({image_url:imageUrl}).eq("id",productId);if(r.error)throw r.error}closeModal();toast(id?"Produk berhasil diperbarui.":"Produk berhasil ditambahkan.");await loadProducts()}catch(err){toast(err?.message||"Gagal menyimpan produk.")}finally{saveBtn.disabled=false;saveBtn.textContent="Simpan Produk"}};
async function removeProduct(id){const p=products.find(x=>String(x.id)===String(id));if(!p||!confirm('Hapus produk "'+p.name+'"?'))return;const {error}=await db.from("amasa_products").delete().eq("id",id);if(error)return toast(error.message);toast("Produk berhasil dihapus.");loadProducts()}
$("#productSearch").oninput=renderProducts;$("#productCategoryFilter").onchange=renderProducts;$("#logoutButton").onclick=async()=>{await db.auth.signOut();location.href="login.html"};$("#saveSettings").onclick=()=>toast("Pengaturan belum dibuat di Supabase.");
(async()=>{if(await requireAdmin()){try{await check();await loadCategories();await loadProducts()}catch(e){console.error(e)}}})();
// mobile sidebar navigation fix
