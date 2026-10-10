const SUPABASE_URL="https://fysaxpqpqexjnlpkbwap.supabase.co";
const SUPABASE_KEY="sb_publishable_DWRaEZTcNMjhglwN3nqCOw_pua8rsjD";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let products=[],categories=[];
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
function toast(m){const e=$("#toast");e.textContent=m;e.hidden=false;setTimeout(()=>e.hidden=true,2800)}
function showAccessDisabledPopup(message,callback){
  let modal=document.getElementById("accessDisabledPopup");
  if(!modal){
    modal=document.createElement("div");
    modal.id="accessDisabledPopup";
    modal.innerHTML='<div class="access-disabled-backdrop"><div class="access-disabled-box"><div class="access-disabled-icon">!</div><h3>Akses Dinonaktifkan</h3><p id="accessDisabledMessage"></p><button type="button" id="accessDisabledOk">Mengerti</button></div></div>';
    const style=document.createElement("style");
    style.textContent="#accessDisabledPopup{position:fixed;inset:0;z-index:99999}#accessDisabledPopup .access-disabled-backdrop{position:absolute;inset:0;background:rgba(5,18,30,.58);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}#accessDisabledPopup .access-disabled-box{width:min(420px,92vw);background:#fff;border-radius:16px;padding:28px 24px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.28)}#accessDisabledPopup .access-disabled-icon{width:46px;height:46px;margin:0 auto 14px;border-radius:50%;background:#fff1f1;color:#b83b3b;font-size:28px;font-weight:900;line-height:46px}#accessDisabledPopup h3{margin:0 0 10px;color:#102437;font-size:22px}#accessDisabledPopup p{margin:0;color:#6b7785;font-size:14px;line-height:1.6}#accessDisabledPopup button{margin-top:22px;border:0;border-radius:9px;padding:12px 28px;background:#b58a50;color:#fff;font-weight:800;cursor:pointer}";
    document.head.appendChild(style);
    document.body.appendChild(modal);
  }
  document.getElementById("accessDisabledMessage").textContent=message;
  modal.hidden=false;
  document.getElementById("accessDisabledOk").onclick=()=>{
    modal.hidden=true;
    if(typeof callback==="function")callback();
  };
}
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
  const {data:client,error:clientError}=await db.from("core_platform_clients").select("id,status").eq("module_slug","PRODUCT").eq("name","AMASA").maybeSingle();
  if(clientError||client?.status!=="ACTIVE"){
    await db.auth.signOut();
    alert("Akses AMASA belum disetujui Core Adiimasa.");
    location.href="login.html";
    return false;
  }

  const {data:accessRows,error:accessError}=await db.from("amasa_core_access")
    .select("approval_status,is_active,created_at")
    .eq("module_slug","PRODUCT")
    .eq("client_name","AMASA")
    .eq("email",user.email.toLowerCase())
    .order("created_at",{ascending:false})
    .limit(1);

  if(accessError){
    await db.auth.signOut();
    alert("Status akses AMASA tidak dapat diverifikasi. Silakan coba lagi.");
    location.href="login.html";
    return false;
  }

  if(accessRows && accessRows.length){
    const access=accessRows[0];
    const approved=String(access.approval_status||"").toUpperCase()==="APPROVED" && access.is_active===true;
    if(!approved){
      await db.auth.signOut();
      alert("Akses AMASA sedang ditangguhkan atau belum disetujui Core Adiimasa.");
      location.href="login.html";
      return false;
    }
  }

  return true;
}

let amasaAccessWatchTimer=null;
let amasaAccessWatchBusy=false;
let amasaAccessWasApproved=true;

async function enforceAmasaAccessLive(showNotice=true){
  if(amasaAccessWatchBusy) return true;
  amasaAccessWatchBusy=true;
  try{
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError||!user){
      if(amasaAccessWatchTimer) clearInterval(amasaAccessWatchTimer);
      location.href="login.html";
      return false;
    }

    const {data:rows,error}=await db.from("amasa_core_access")
      .select("approval_status,is_active")
      .eq("module_slug","PRODUCT")
      .eq("client_name","AMASA")
      .eq("email",user.email.toLowerCase())
      .order("created_at",{ascending:false})
      .limit(1);

    if(error){
      console.warn("AMASA access watch:",error.message);
      return true;
    }

    if(!rows || !rows.length){
      if(amasaAccessWatchTimer) clearInterval(amasaAccessWatchTimer);
      amasaAccessWasApproved=false;
      await db.auth.signOut();
      showAccessDisabledPopup("Akun Anda sudah dihapus oleh Core Adiimasa. Silakan login kembali untuk mengajukan persetujuan akses.",()=>location.href="login.html");
      return false;
    }

    const access=rows[0];
    const approved=String(access.approval_status||"").toUpperCase()==="APPROVED" && access.is_active===true;

    if(!approved){
      if(amasaAccessWatchTimer) clearInterval(amasaAccessWatchTimer);
      amasaAccessWasApproved=false;
      await db.auth.signOut();
      showAccessDisabledPopup("Akun Anda telah dinonaktifkan oleh Core Adiimasa.",()=>location.href="login.html");
      return false;
    }

    amasaAccessWasApproved=true;
    return true;
  }finally{
    amasaAccessWatchBusy=false;
  }
}

function startAmasaAccessWatch(){
  if(amasaAccessWatchTimer) clearInterval(amasaAccessWatchTimer);
  amasaAccessWatchTimer=setInterval(()=>enforceAmasaAccessLive(false),3000);
}

async function check(){
  const {error}=await db.from("amasa_products").select("id",{count:"exact",head:true});
  if(error){
    $("#statSystem").textContent="OFF";
    throw error;
  }
  $("#statSystem").textContent="OK";
}
function formatDateKey(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}
function formatDayLabel(key){
  const parts=key.split("-");
  return parts.length===3 ? parts[2]+"/"+parts[1] : key;
}
async function loadVisitorAnalytics(){
  const visitorsEl=$("#analyticsVisitors"), pageviewsEl=$("#analyticsPageviews"), sessionsEl=$("#analyticsSessions");
  const chart=$("#visitorChart"), empty=$("#visitorEmpty");
  if(!visitorsEl||!pageviewsEl||!sessionsEl||!chart)return;

  const jakartaParts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const jakartaYear=jakartaParts.find(p=>p.type==="year")?.value;
  const jakartaMonth=jakartaParts.find(p=>p.type==="month")?.value;
  const jakartaDay=jakartaParts.find(p=>p.type==="day")?.value;
  const today=new Date(Number(jakartaYear),Number(jakartaMonth)-1,Number(jakartaDay));
  const start=new Date(today);
  start.setDate(today.getDate()-6);
  const startKey=formatDateKey(start);
  const endKey=formatDateKey(today);

  const {data,error}=await db.from("analytics_daily")
    .select("analytics_date,total_visitors,unique_visitors,total_sessions,total_pageviews")
    .eq("module_slug","AMASA")
    .gte("analytics_date",startKey)
    .lte("analytics_date",endKey)
    .order("analytics_date",{ascending:true});

  if(error){
    console.error("AMASA analytics:",error);
    return;
  }

  const byDate={};
  (data||[]).forEach(row=>{byDate[row.analytics_date]=row});
  const rows=[];
  for(let i=0;i<7;i++){
    const d=new Date(start);
    d.setDate(start.getDate()+i);
    const key=formatDateKey(d);
    rows.push({
      key,
      label:formatDayLabel(key),
      visitors:Number(byDate[key]?.unique_visitors||0),
      pageviews:Number(byDate[key]?.total_pageviews||0),
      sessions:Number(byDate[key]?.total_sessions||0)
    });
  }

  const totals=rows.reduce((a,r)=>({
    visitors:a.visitors+r.visitors,
    pageviews:a.pageviews+r.pageviews,
    sessions:a.sessions+r.sessions
  }),{visitors:0,pageviews:0,sessions:0});

  visitorsEl.textContent=totals.visitors.toLocaleString("id-ID");
  pageviewsEl.textContent=totals.pageviews.toLocaleString("id-ID");
  sessionsEl.textContent=totals.sessions.toLocaleString("id-ID");

  const max=Math.max(...rows.map(r=>r.visitors),1);
  const width=900,height=280,left=48,right=18,top=22,bottom=42;
  const plotW=width-left-right,plotH=height-top-bottom;
  const points=rows.map((r,i)=>{
    const x=left+(plotW*(i/(rows.length-1)));
    const y=top+plotH-(r.visitors/max)*plotH;
    return {x,y,r};
  });
  const path=points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
  const area=path+" L "+points[points.length-1].x.toFixed(1)+" "+(top+plotH)+" L "+points[0].x.toFixed(1)+" "+(top+plotH)+" Z";
  const grid=[0,.25,.5,.75,1].map(v=>{
    const y=top+plotH-v*plotH;
    return '<line x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'" class="chart-grid"></line>';
  }).join("");
  const labels=points.map(p=>'<text x="'+p.x+'" y="'+(height-13)+'" text-anchor="middle" class="chart-label">'+p.r.label+'</text>').join("");
  const dots=points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4" class="chart-dot"></circle>').join("");
  chart.innerHTML=grid+
    '<path d="'+area+'" class="chart-area"></path>'+
    '<path d="'+path+'" class="chart-line"></path>'+
    dots+labels;

  if(empty) empty.hidden=totals.visitors+totals.pageviews+totals.sessions!==0;
  chart.style.opacity=totals.visitors===0 ? "0.35" : "1";
}

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
async function loadProducts(){const {data,error}=await db.from("amasa_products").select("id,category_id,name,slug,sku,short_description,description,image_url,price,size_label,badge,usage_instructions,safety_information,marketplace_links,sort_order,is_active,is_featured,amasa_categories(name,slug)").order("sort_order",{ascending:true}).order("name",{ascending:true});if(error){$("#statSystem").textContent="OFF";$("#productsTableBody").innerHTML='<tr><td colspan="6" class="empty">'+esc(error.message)+'</td></tr>';return}products=data||[];renderProducts();$("#statProducts").textContent=products.length;$("#statActive").textContent=products.filter(x=>x.is_active).length}
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
function openModal(p=null){$("#productModal").hidden=false;$("#modalTitle").textContent=p?"Edit Produk":"Tambah Produk";$("#productId").value=p?.id||"";$("#productName").value=p?.name||"";$("#productSlug").value=p?.slug||"";$("#productCategory").value=p?.category_id||"";$("#productPrice").value=p?.price??"";$("#productImage").value="";$("#productImageInfo").textContent=p?.image_url?"Gambar saat ini tersimpan. Pilih file baru untuk menggantinya.":"JPG, PNG, WEBP. Maksimal 5 MB.";$("#productImagePreview").src=p?.image_url||"";$("#productImagePreview").hidden=!p?.image_url;$("#productSize").value=p?.size_label||"";$("#productBadge").value=p?.badge||"";$("#productShort").value=p?.short_description||"";$("#productDescription").value=p?.description||"";$("#productUsage").value=p?.usage_instructions||"";$("#productSafety").value=p?.safety_information||"";const ml=p?.marketplace_links&&typeof p.marketplace_links==="object"?p.marketplace_links:{};$("#marketShopee").value=ml.shopee||"";$("#marketTiktok").value=ml.tiktok||"";$("#marketTokopedia").value=ml.tokopedia||"";$("#marketLazada").value=ml.lazada||"";$("#marketToco").value=ml.toco||"";$("#marketBlibli").value=ml.blibli||"";$("#productOrder").value=p?.sort_order??0;$("#productFeatured").checked=!!p?.is_featured;$("#productActive").checked=p?p.is_active:true}
function closeModal(){$("#productModal").hidden=true}$$("[data-close]").forEach(b=>b.onclick=closeModal);$("#addProductButton").onclick=()=>openModal();
$("#productImage").onchange=()=>{const f=$("#productImage").files[0];if(!f){return}if(!f.type.startsWith("image/")){toast("File harus berupa gambar.");$("#productImage").value="";return}if(f.size>5*1024*1024){toast("Ukuran gambar maksimal 5 MB.");$("#productImage").value="";return}$("#productImagePreview").src=URL.createObjectURL(f);$("#productImagePreview").hidden=false;$("#productImageInfo").textContent=f.name+" • "+Math.round(f.size/1024)+" KB"};
async function uploadProductImage(file,productId){const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";const path=productId+"/"+crypto.randomUUID()+"."+ext;const {error}=await db.storage.from("amasa-products").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});if(error)throw error;return db.storage.from("amasa-products").getPublicUrl(path).data.publicUrl}
$("#productForm").onsubmit=async e=>{e.preventDefault();const id=$("#productId").value;const saveBtn=$("#saveProduct");saveBtn.disabled=true;saveBtn.textContent="Menyimpan...";try{const p={name:$("#productName").value.trim(),slug:$("#productSlug").value.trim(),category_id:$("#productCategory").value||null,price:$("#productPrice").value?Number($("#productPrice").value):null,size_label:$("#productSize").value.trim()||null,badge:$("#productBadge").value.trim()||null,short_description:$("#productShort").value.trim()||null,description:$("#productDescription").value.trim()||null,usage_instructions:$("#productUsage").value.trim()||null,safety_information:$("#productSafety").value.trim()||null,sort_order:Number($("#productOrder").value||0),is_featured:$("#productFeatured").checked,is_active:$("#productActive").checked,marketplace_links:{shopee:$("#marketShopee").value.trim(),tiktok:$("#marketTiktok").value.trim(),tokopedia:$("#marketTokopedia").value.trim(),lazada:$("#marketLazada").value.trim(),toco:$("#marketToco").value.trim(),blibli:$("#marketBlibli").value.trim()}};let productId=id;if(!productId){const r=await db.from("amasa_products").insert(p).select("id").single();if(r.error)throw r.error;productId=r.data.id}else{const r=await db.from("amasa_products").update(p).eq("id",productId);if(r.error)throw r.error}const file=$("#productImage").files[0];if(file){const imageUrl=await uploadProductImage(file,productId);const r=await db.from("amasa_products").update({image_url:imageUrl}).eq("id",productId);if(r.error)throw r.error}closeModal();toast(id?"Produk berhasil diperbarui.":"Produk berhasil ditambahkan.");await loadProducts()}catch(err){toast(err?.message||"Gagal menyimpan produk.")}finally{saveBtn.disabled=false;saveBtn.textContent="Simpan Produk"}};
async function removeProduct(id){const p=products.find(x=>String(x.id)===String(id));if(!p||!confirm('Hapus produk "'+p.name+'"?'))return;const {error}=await db.from("amasa_products").delete().eq("id",id);if(error)return toast(error.message);toast("Produk berhasil dihapus.");loadProducts()}
$("#productSearch").oninput=renderProducts;$("#productCategoryFilter").onchange=renderProducts;
async function loadSettings(){
  const {data,error}=await db.from("amasa_site_content").select("id,content").eq("section_slug","settings").maybeSingle();
  if(error)return toast(error.message);
  if(!data)return;
  let v={};
  try{v=JSON.parse(data.content||"{}")}catch(e){}
  $("#settingBrand").value=v.brand_name||"AMASA";
  $("#settingCompany").value=v.company_name||"PT Adiimasa Distribusi Indonesia";
  $("#settingWhatsapp").value=v.whatsapp||"";
  $("#settingEmail").value=v.email||"";
}
$("#saveSettings").onclick=async()=>{
  const btn=$("#saveSettings");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const payload={
      brand_name:$("#settingBrand").value.trim(),
      company_name:$("#settingCompany").value.trim(),
      whatsapp:$("#settingWhatsapp").value.trim(),
      email:$("#settingEmail").value.trim(),
    };
    const {data,error}=await db.from("amasa_site_content").select("id").eq("section_slug","settings").maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("Data pengaturan belum tersedia.");
    const r=await db.from("amasa_site_content").update({content:JSON.stringify(payload),title:payload.brand_name,updated_at:new Date().toISOString()}).eq("id",data.id);
    if(r.error)throw r.error;
    toast("Pengaturan berhasil disimpan.");
  }catch(err){toast(err?.message||"Gagal menyimpan pengaturan.")}finally{btn.disabled=false;btn.textContent="Simpan Pengaturan"}
};
$("#logoutButton").onclick=async()=>{await db.auth.signOut();location.href="login.html"};
async function loadWebsiteContent(){
  const {data,error}=await db.from("amasa_site_content").select("id,section_slug,section_name,title,subtitle,content,image_url,button_text,button_url,sort_order,is_active");
  if(error)return toast(error.message);
  const grid=$("#contentGrid");
  if(!grid)return;
  const fixedOrder={hero:1,about:2,gallery:3,video:4,testimoni:5,faq:6};
  const items=(data||[]).filter(x=>x.section_slug!=="settings").sort((a,b)=>(fixedOrder[a.section_slug]??99)-(fixedOrder[b.section_slug]??99));
  grid.innerHTML=items.length?items.map(x=>x.section_slug==="faq"
    ? '<div class="content-card content-card-locked"><strong>'+esc(x.section_name)+'</strong><span>'+esc(x.title||"Pertanyaan yang Sering Diajukan")+'</span><small class="muted">Dikunci • FAQ dikelola AMASA</small></div>'
    : '<button type="button" class="content-card" data-content-edit="'+x.id+'" data-gallery="'+(x.section_slug==="gallery"?esc(x.content||""):"")+'"><strong>'+esc(x.section_name)+'</strong><span>'+esc(x.title||"Belum diatur")+'</span><small class="muted">'+(x.is_active?"Aktif":"Nonaktif")+'</small></button>').join(""):'<div class="empty">Belum ada konten website.</div>';
  document.querySelectorAll("[data-content-edit]").forEach(b=>b.onclick=()=>openContentModal(items.find(x=>String(x.id)===String(b.dataset.contentEdit))));
}
function renderGalleryAdmin(items=[]){
  const list=$("#galleryAdminList");if(!list)return;list.innerHTML="";
  (Array.isArray(items)?items:[]).forEach((item,index)=>{
    const wrap=document.createElement("label");wrap.className="gallery-admin-item";
    wrap.innerHTML='<span>Foto '+(index+1)+'</span><input class="gallery-file" data-slot="'+index+'" type="file" accept="image/*"><small class="gallery-info" data-info="'+index+'"></small><img class="product-image-preview gallery-preview" data-preview="'+index+'" alt="Preview '+(index+1)+'" hidden><button type="button" class="small-btn delete gallery-remove">Hapus Foto</button>';
    list.appendChild(wrap);
    const input=wrap.querySelector(".gallery-file"),img=wrap.querySelector(".gallery-preview"),info=wrap.querySelector(".gallery-info");input.dataset.currentUrl=item?.image_url||"";
    if(item?.image_url){img.src=item.image_url;img.hidden=false;info.textContent="Gambar tersimpan. Pilih file baru untuk menggantinya."}else info.textContent="Belum ada foto";
    input.onchange=async()=>{const f=input.files[0];if(!f)return;await prepareContentImageInput(input,f,"gallery",img,info)};
    wrap.querySelector(".gallery-remove").onclick=()=>{wrap.remove();[...document.querySelectorAll("#galleryAdminList .gallery-admin-item")].forEach((el,n)=>{el.querySelector("span").textContent="Foto "+(n+1);el.querySelector(".gallery-file").dataset.slot=n;el.querySelector(".gallery-preview").dataset.preview=n;el.querySelector(".gallery-info").dataset.info=n})};
  });
}
function addGalleryAdminSlot(){const list=$("#galleryAdminList");if(!list)return;const items=getGalleryAdminItems().map(x=>({image_url:x.url}));items.push({image_url:""});renderGalleryAdmin(items)}
function getGalleryAdminItems(){return [...document.querySelectorAll("#galleryAdminList .gallery-admin-item")].map(w=>({input:w.querySelector(".gallery-file"),url:w.querySelector(".gallery-file")?.dataset.currentUrl||""}))}
function renderVideoAdmin(items=[]){
  const list=$("#videoAdminList");if(!list)return;
  list.innerHTML="";
  (Array.isArray(items)?items:[]).forEach((item,index)=>{
    const wrap=document.createElement("div");
    wrap.className="gallery-admin-item video-admin-item";
    wrap.innerHTML='<span>Video '+(index+1)+'</span>'+
      '<input class="video-title" type="text" placeholder="Judul video" value="'+esc(item?.title||"")+'">'+
      '<input class="video-url" type="url" placeholder="https://youtube.com/... atau https://.../video.mp4" value="'+esc(item?.url||"")+'">'+
      '<input class="video-file" type="file" accept="video/*">'+
      '<small class="video-info muted">'+(item?.url?"Video tersimpan. Link/file baru akan menggantikannya.":"Belum ada video")+'</small>'+
      '<button type="button" class="small-btn delete video-remove">Hapus Video</button>';
    list.appendChild(wrap);
    const file=wrap.querySelector(".video-file");
    file.dataset.currentUrl=item?.url||"";
    file.onchange=()=>{
      const f=file.files[0];if(!f)return;
      try{validateContentVideoFile(f)}catch(error){toast(error.message);file.value="";return}
      wrap.querySelector(".video-url").value="";
      wrap.querySelector(".video-info").textContent=f.name+" • asli "+formatFileSize(f.size)+" • akan dikompres otomatis saat disimpan (maks. 20 MB)";
    };
    wrap.querySelector(".video-remove").onclick=()=>{
      wrap.remove();
      [...document.querySelectorAll("#videoAdminList .video-admin-item")].forEach((el,n)=>el.querySelector("span").textContent="Video "+(n+1));
    };
  });
}
function addVideoAdminSlot(){
  renderVideoAdmin([...getVideoAdminItems(),{title:"",url:""}]);
}
function getVideoAdminItems(){
  return [...document.querySelectorAll("#videoAdminList .video-admin-item")].map(w=>({
    title:w.querySelector(".video-title")?.value.trim()||"Video AMASA",
    url:w.querySelector(".video-url")?.value.trim()||"",
    file:w.querySelector(".video-file")||null
  })).filter(x=>x.url||x.file?.files?.[0]);
}

function renderTestimonialAdmin(items=[]){
  const list=$("#testimonialAdminList");if(!list)return;
  list.innerHTML="";
  (Array.isArray(items)?items:[]).forEach((item,index)=>{
    const wrap=document.createElement("div");
    wrap.className="gallery-admin-item testimonial-admin-item";
    wrap.innerHTML='<span>Testimoni '+(index+1)+'</span>'+
      '<input class="testimonial-name" type="text" placeholder="Nama pelanggan" value="'+esc(item?.name||"")+'">'+
      '<input class="testimonial-role" type="text" placeholder="Keterangan / kota / pengguna AMASA" value="'+esc(item?.role||"")+'">'+
      '<input class="testimonial-rating" type="number" min="1" max="5" step="1" placeholder="Rating 1-5" value="'+(Number(item?.rating)||5)+'">'+
      '<textarea class="testimonial-text" rows="4" placeholder="Pengalaman pelanggan">'+esc(item?.text||"")+'</textarea>'+
      '<button type="button" class="small-btn delete testimonial-remove">Hapus Testimoni</button>';
    list.appendChild(wrap);
    wrap.querySelector(".testimonial-remove").onclick=()=>{
      wrap.remove();
      [...document.querySelectorAll("#testimonialAdminList .testimonial-admin-item")].forEach((el,n)=>el.querySelector("span").textContent="Testimoni "+(n+1));
    };
  });
}
function addTestimonialAdminSlot(){
  const items=getTestimonialAdminItems();
  items.push({name:"",role:"",rating:5,text:""});
  renderTestimonialAdmin(items);
}
function getTestimonialAdminItems(){
  return [...document.querySelectorAll("#testimonialAdminList .testimonial-admin-item")].map(w=>({
    name:w.querySelector(".testimonial-name")?.value.trim()||"",
    role:w.querySelector(".testimonial-role")?.value.trim()||"",
    rating:Math.min(5,Math.max(1,Number(w.querySelector(".testimonial-rating")?.value||5))),
    text:w.querySelector(".testimonial-text")?.value.trim()||""
  })).filter(x=>x.name||x.role||x.text);
}

function renderFaqAdmin(items=[]){
  const list=$("#faqAdminList");if(!list)return;
  list.innerHTML="";
  (Array.isArray(items)?items:[]).forEach((item,index)=>{
    const wrap=document.createElement("div");
    wrap.className="gallery-admin-item faq-admin-item";
    wrap.innerHTML='<span>FAQ '+(index+1)+'</span>'+
      '<input class="faq-question" type="text" placeholder="Pertanyaan" value="'+esc(item?.question||"")+'">'+
      '<textarea class="faq-answer" rows="4" placeholder="Jawaban">'+esc(item?.answer||"")+'</textarea>'+
      '<button type="button" class="small-btn delete faq-remove">Hapus FAQ</button>';
    list.appendChild(wrap);
    wrap.querySelector(".faq-remove").onclick=()=>{
      wrap.remove();
      [...document.querySelectorAll("#faqAdminList .faq-admin-item")].forEach((el,n)=>el.querySelector("span").textContent="FAQ "+(n+1));
    };
  });
}
function addFaqAdminSlot(){
  const items=getFaqAdminItems();
  items.push({question:"",answer:""});
  renderFaqAdmin(items);
}
function getFaqAdminItems(){
  return [...document.querySelectorAll("#faqAdminList .faq-admin-item")].map(w=>({
    question:w.querySelector(".faq-question")?.value.trim()||"",
    answer:w.querySelector(".faq-answer")?.value.trim()||""
  })).filter(x=>x.question||x.answer);
}

function openContentModal(item){
  if(!item||item.section_slug==="settings")return;
  $("#contentModal").hidden=false;$("#contentModalTitle").textContent="Edit "+item.section_name;$("#contentId").value=item.id;$("#contentSectionName").value=item.section_name||"";$("#contentTitle").value=item.title||"";$("#contentSubtitle").value=item.subtitle||"";$("#contentBody").value=item.content||"";
  $("#aboutParagraph1").value="";$("#aboutParagraph2").value="";
  if(item.section_slug==="about"){try{const about=JSON.parse(item.content||"{}");$("#aboutParagraph1").value=about.paragraph1||"";$("#aboutParagraph2").value=about.paragraph2||""}catch(e){}}
  $("#contentBodyWrap").hidden=item.section_slug==="about";$("#aboutParagraph1Wrap").hidden=item.section_slug!=="about";$("#aboutParagraph2Wrap").hidden=item.section_slug!=="about";
  $("#contentImage").value="";$("#contentImage").dataset.currentUrl=item.image_url||"";$("#contentImage")._compressedFile=null;$("#clearContentImage").hidden=!item.image_url;$("#contentImageInfo").textContent=item.image_url?"Gambar saat ini tersimpan. Pilih file baru untuk menggantinya.":"JPG, PNG, WEBP. Maksimal 5 MB sebelum kompresi otomatis ke WebP.";$("#contentImagePreview").src=item.image_url||"";$("#contentImagePreview").hidden=!item.image_url;$("#contentActive").checked=!!item.is_active;
  const isGallery=item.section_slug==="gallery",isVideo=item.section_slug==="video",isTestimonial=item.section_slug==="testimoni",isFaq=item.section_slug==="faq";
  $("#contentBodyWrap").hidden=isGallery||isVideo||isTestimonial||isFaq||item.section_slug==="about";$("#galleryImagesWrap").hidden=!isGallery;$("#videoItemsWrap").hidden=!isVideo;$("#testimonialItemsWrap").hidden=!isTestimonial;$("#faqItemsWrap").hidden=!isFaq;$("#contentImageWrap").hidden=isGallery||isVideo||isTestimonial||isFaq;
  if(isGallery){let g={};try{g=JSON.parse(item.content||"{}")}catch(e){}let items=Array.isArray(g.items)?g.items:[];if(!items.length&&item.image_url)items=[{image_url:item.image_url,label:"PRODUCT GALLERY 01"}];renderGalleryAdmin(items)}else $("#galleryAdminList").innerHTML="";
  if(isVideo){let v={};try{v=JSON.parse(item.content||"{}")}catch(e){}renderVideoAdmin(Array.isArray(v.items)?v.items:[])}else $("#videoAdminList").innerHTML="";
  if(isTestimonial){let t={};try{t=JSON.parse(item.content||"{}")}catch(e){}renderTestimonialAdmin(Array.isArray(t.items)?t.items:[])}else $("#testimonialAdminList").innerHTML="";
  if(isFaq){let f={};try{f=JSON.parse(item.content||"{}")}catch(e){}renderFaqAdmin(Array.isArray(f.items)?f.items:[])}else $("#faqAdminList").innerHTML="";
}

$("#addGalleryImage").onclick=addGalleryAdminSlot;
$("#addVideoItem").onclick=addVideoAdminSlot;
$("#addTestimonialItem").onclick=addTestimonialAdminSlot;
$("#addFaqItem").onclick=addFaqAdminSlot;
function closeContentModal(){$("#contentModal").hidden=true}
document.querySelectorAll("[data-content-close]").forEach(b=>b.onclick=closeContentModal);
$("#contentImage").onchange=async()=>{const input=$("#contentImage"),f=input.files[0];if(!f)return;await prepareContentImageInput(input,f,contentSectionSlug(),$("#contentImagePreview"),$("#contentImageInfo"));$("#clearContentImage").hidden=!(input.dataset.currentUrl||input._compressedFile)};
$("#clearContentImage").onclick=()=>{const input=$("#contentImage");input.value="";input.dataset.currentUrl="";input._compressedFile=null;$("#contentImagePreview").removeAttribute("src");$("#contentImagePreview").hidden=true;$("#contentImageInfo").textContent="Gambar dihapus dari formulir. Tekan Simpan Konten untuk menerapkan perubahan ke website.";$("#clearContentImage").hidden=true;};
document.querySelectorAll(".gallery-file").forEach(input=>input.onchange=()=>{const f=input.files[0],n=input.dataset.slot;if(!f)return;if(!f.type.startsWith("image/")||f.size>5*1024*1024){toast("File gambar tidak valid atau lebih dari 5 MB.");input.value="";return}const img=document.querySelector(`.gallery-preview[data-preview="${n}"]`),info=document.querySelector(`.gallery-info[data-info="${n}"]`);if(img){img.src=URL.createObjectURL(f);img.hidden=false}if(info)info.textContent=f.name+" • "+Math.round(f.size/1024)+" KB"});

const AMASA_CONTENT_IMAGE_MAX_SOURCE = 5 * 1024 * 1024;
const AMASA_CONTENT_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const AMASA_CONTENT_VIDEO_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const AMASA_CONTENT_IMAGE_TARGETS = {
  hero: { maxBytes: 300 * 1024, maxDimension: 1920 },
  about: { maxBytes: 200 * 1024, maxDimension: 1600 },
  gallery: { maxBytes: 250 * 1024, maxDimension: 1600 }
};

function contentImageTarget(sectionSlug) {
  return AMASA_CONTENT_IMAGE_TARGETS[sectionSlug] || { maxBytes: 300 * 1024, maxDimension: 1600 };
}

function contentSectionSlug() {
  const name = $("#contentSectionName")?.value || "";
  if (name === "Tentang AMASA") return "about";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatFileSize(bytes) {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(2) + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

async function compressContentImage(file, sectionSlug) {
  if (!file) throw new Error("Pilih gambar terlebih dahulu.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Format gambar harus JPG, PNG, atau WEBP.");
  }
  if (file.size > AMASA_CONTENT_IMAGE_MAX_SOURCE) {
    throw new Error("Ukuran gambar asli maksimal 5 MB sebelum kompresi.");
  }

  const target = contentImageTarget(sectionSlug);
  if (file.type === "image/webp" && file.size <= target.maxBytes) return file;
  if (typeof createImageBitmap !== "function") {
    throw new Error("Browser ini belum mendukung kompresi gambar otomatis. Gunakan Chrome versi terbaru.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    let scale = Math.min(1, target.maxDimension / Math.max(bitmap.width, bitmap.height));
    let smallestBlob = null;

    for (let resizePass = 0; resizePass < 8; resizePass++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Gagal menyiapkan kompresi gambar.");
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.84, 0.76, 0.68, 0.60, 0.52]) {
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error("Gagal mengubah gambar ke WebP.")), "image/webp", quality);
        });
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (blob.size <= target.maxBytes) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "amasa-image";
          return new File([blob], baseName + ".webp", { type: "image/webp", lastModified: Date.now() });
        }
      }
      scale *= 0.82;
    }

    if (smallestBlob && smallestBlob.size <= target.maxBytes) {
      const baseName = file.name.replace(/\.[^.]+$/, "") || "amasa-image";
      return new File([smallestBlob], baseName + ".webp", { type: "image/webp", lastModified: Date.now() });
    }
    throw new Error("Gambar belum bisa mencapai batas " + formatFileSize(target.maxBytes) + ". Pilih gambar yang lebih sederhana atau beresolusi lebih rendah.");
  } finally {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

async function prepareContentImageInput(input, file, sectionSlug, preview, info) {
  if (!file) return;
  try {
    const optimized = await compressContentImage(file, sectionSlug);
    input._compressedFile = optimized;
    if (preview) {
      preview.src = URL.createObjectURL(optimized);
      preview.hidden = false;
    }
    if (info) {
      info.textContent = "Asli " + formatFileSize(file.size) + " → WebP " + formatFileSize(optimized.size) +
        " (batas " + formatFileSize(contentImageTarget(sectionSlug).maxBytes) + ")";
    }
  } catch (error) {
    input.value = "";
    input._compressedFile = null;
    if (info) info.textContent = error?.message || "Gagal mengompres gambar.";
    toast(error?.message || "Gagal mengompres gambar.");
  }
}

function validateContentVideoFile(file) {
  if (!file || !String(file.type || "").startsWith("video/")) {
    throw new Error("File harus berupa video yang didukung browser.");
  }
}

function waitForVideoEvent(video, eventName, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const isReady = () => eventName === "loadedmetadata"
      ? video.readyState >= 1 && Number.isFinite(video.duration)
      : eventName === "loadeddata"
        ? video.readyState >= 2 && video.videoWidth > 0
        : false;
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Video terlalu lama diproses browser.")), timeoutMs);
    const onReady = () => { if (isReady()) finish(); };
    const onError = () => {
      const mediaCode = video.error?.code || 0;
      const error = new Error("Browser tidak dapat membaca video ini (kode " + (mediaCode || "tidak diketahui") + ").");
      error.mediaErrorCode = mediaCode;
      finish(error);
    };
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
      error ? reject(error) : resolve();
    }
    video.addEventListener(eventName, onReady);
    video.addEventListener("error", onError);
    if (isReady()) finish();
  });
}

async function recordContentVideoPass(file, profile, mimeType, keepAudio, onProgress) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Browser ini belum mendukung kompresi video otomatis. Gunakan Chrome desktop versi terbaru.");
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.muted = true;
  video.defaultMuted = true;
  video.src = sourceUrl;

  let canvasStream = null;
  let sourceStream = null;
  let recorder = null;
  let rafId = 0;
  let capturedVideoFrames = 0;
  let progressHeartbeat = 0;
  let heartbeatTicks = 0;

  try {
    const metadataReady = waitForVideoEvent(video, "loadedmetadata");
    video.load();
    await metadataReady;
    await waitForVideoEvent(video, "loadeddata");

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Durasi video tidak dapat dibaca.");
    }
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Ukuran frame video tidak dapat dibaca.");
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = Math.min(1, profile.maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(2, Math.floor(sourceWidth * scale / 2) * 2);
    const height = Math.max(2, Math.floor(sourceHeight * scale / 2) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Gagal menyiapkan kompresi video.");

    // Samakan mekanisme pengambilan frame dengan GEPARU Aduan Sosial:
    // canvas.captureStream(fps) + drawImage melalui requestAnimationFrame.
    // Ini menghindari ketergantungan pada requestFrame() atau callback decoder khusus.
    canvasStream = canvas.captureStream(profile.fps || 24);

    if (keepAudio) {
      try {
        if (typeof video.captureStream === "function") sourceStream = video.captureStream();
        else if (typeof video.mozCaptureStream === "function") sourceStream = video.mozCaptureStream();
        if (sourceStream) {
          sourceStream.getAudioTracks().forEach(track => {
            try { canvasStream.addTrack(track); } catch (_) {}
          });
        }
      } catch (_) {}
    }

    const options = { videoBitsPerSecond: profile.videoBitrate };
    if (keepAudio) options.audioBitsPerSecond = 64000;
    if (mimeType && MediaRecorder.isTypeSupported(mimeType)) options.mimeType = mimeType;
    recorder = new MediaRecorder(canvasStream, options);

    const chunks = [];
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", () => reject(new Error("Browser gagal mengompres video.")), { once: true });
      recorder.addEventListener("stop", resolve, { once: true });
    });

    const drawFrame = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          context.drawImage(video, 0, 0, width, height);
          capturedVideoFrames++;
        } catch (_) {}
      }
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      if (duration > 0) {
        onProgress?.(Math.min(99, Math.round((currentTime / duration) * 100)), "Merekam frame video");
      }
      if (!video.ended && recorder.state === "recording") {
        rafId = requestAnimationFrame(drawFrame);
      } else if (recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
      }
    };

    const ended = new Promise((resolve, reject) => {
      const onEnded = () => { cleanup(); resolve(); };
      const onError = () => {
        cleanup();
        const code = video.error?.code || 0;
        const error = new Error("Gagal membaca frame video sumber (kode " + (code || "tidak diketahui") + ").");
        error.mediaErrorCode = code;
        reject(error);
      };
      function cleanup() {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
      }
      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    // Match GEPARU's proven ordering: start MediaRecorder first, then start
    // source playback, so audio and canvas video enter the same recording window.
    recorder.start(250);
    await video.play();
    try {
      context.drawImage(video, 0, 0, width, height);
      capturedVideoFrames++;
    } catch (_) {}
    rafId = requestAnimationFrame(drawFrame);

    // Keep status visibly alive during encoding/rendering without inventing
    // progress percentages. Percentages still follow the real source time.
    const heartbeatStartedAt = Date.now();
    progressHeartbeat = window.setInterval(() => {
      if (video.ended || recorder.state !== "recording") return;
      heartbeatTicks = (heartbeatTicks + 1) % 4;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const pct = duration > 0 ? Math.min(99, Math.round((currentTime / duration) * 100)) : 0;
      const dots = ["", ".", "..", "..."][heartbeatTicks];
      const elapsed = Math.max(1, Math.floor((Date.now() - heartbeatStartedAt) / 1000));
      onProgress?.(pct, "Merender frame" + dots + " (" + elapsed + " dtk)");
    }, 800);

    const maxWaitMs = Math.min(Math.max(Math.ceil(video.duration * 1000) + 10000, 15000), 10 * 60 * 1000);
    let timeoutId;
    try {
      await Promise.race([
        ended,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Waktu pemrosesan video habis.")), maxWaitMs);
        })
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (recorder.state !== "inactive") recorder.stop();
    await stopped;

    if (capturedVideoFrames < 2) {
      throw new Error("Kompresi tidak menangkap frame video yang bergerak. Hasil ini tidak akan dipakai.");
    }

    const type = recorder.mimeType || chunks[0]?.type || mimeType || "video/webm";
    let blob = new Blob(chunks, { type });
    if (!blob.size) throw new Error("Hasil kompresi video kosong.");
    if (blob.type.includes("webm")) {
      onProgress?.(99, "Menyusun metadata durasi dan navigasi video");
      if (!window.EBML?.Decoder || !window.EBML?.Reader || !window.EBML?.tools?.makeMetadataSeekable) {
        throw new Error("Modul perbaikan metadata WebM tidak tersedia. Muat ulang halaman admin lalu coba lagi.");
      }
      const decoder = new window.EBML.Decoder();
      const reader = new window.EBML.Reader();
      const streamReader = blob.stream().getReader();
      while (true) {
        const part = await streamReader.read();
        if (part.done) {
          reader.stop();
          break;
        }
        let elements = decoder.decode(part.value);
        elements = elements?.filter(element => element.type !== "unknown") || [];
        elements.forEach(element => reader.read(element));
      }
      const metadata = window.EBML.tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
      blob = new Blob([metadata, blob.slice(reader.metadataSize)], { type: blob.type });
      if (!blob.size) throw new Error("Perbaikan metadata video gagal.");
    }
    onProgress?.(100, "Render percobaan selesai");
    return blob;
  } finally {
    if (progressHeartbeat) clearInterval(progressHeartbeat);
    if (rafId) cancelAnimationFrame(rafId);
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch (_) {}
    }
    if (sourceStream) sourceStream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
    if (canvasStream) canvasStream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
    try { video.pause(); } catch (_) {}
    video.removeAttribute("src");
    try { video.load(); } catch (_) {}
    URL.revokeObjectURL(sourceUrl);
  }
}

async function compressContentVideo(file, onProgress) {
  validateContentVideoFile(file);
  // Preserve the source video bit-for-bit. Browser canvas/MediaRecorder
  // transcoding has caused uneven frame pacing and audio/video drift, so
  // never transcode here when playback stability is the priority.
  if (file.size > AMASA_CONTENT_VIDEO_MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran video asli melebihi 50 MB. Agar pemutaran tetap lancar, kompres video terlebih dahulu hingga maksimal 50 MB lalu unggah kembali.");
  }
  onProgress?.("Video siap diunggah tanpa pengodean ulang");
  return file;
  const profiles = [
    { label: "720p", maxDimension: 720, fps: 24, videoBitrate: 1000000 },
    { label: "640p", maxDimension: 640, fps: 24, videoBitrate: 650000 },
    { label: "480p", maxDimension: 480, fps: 20, videoBitrate: 400000 },
    { label: "360p", maxDimension: 360, fps: 18, videoBitrate: 250000 }
  ];
  const mimeTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ].filter(type => MediaRecorder.isTypeSupported(type));
  if (!mimeTypes.length) mimeTypes.push("");
  let smallest = null;
  let lastError = null;
  const totalPasses = profiles.length * 2;
  let pass = 0;
  let lastReportedOverallPct = 0;
  for (const keepAudio of [true, false]) {
    for (const profile of profiles) {
      pass++;
      const passLabel = "Kompresi " + profile.label + (keepAudio ? " + audio" : " tanpa audio") + " (" + pass + "/" + totalPasses + ")";
      const passStartPct = Math.round(((pass - 1) / totalPasses) * 100);
      onProgress?.("Sedang mengompres video " + Math.max(lastReportedOverallPct, passStartPct) + "%");
      let result = null;
      for (const mimeType of mimeTypes) {
        try {
          const blob = await recordContentVideoPass(file, profile, mimeType, keepAudio, pct => {
            // Report progress across all compression passes, not just the current
            // pass. This prevents the percentage jumping back to 1% on retries.
            const withinPassPct = Math.max(0, Math.min(99, pct));
            const overallPct = Math.min(99, Math.round(((pass - 1 + withinPassPct / 100) / totalPasses) * 100));
            lastReportedOverallPct = Math.max(lastReportedOverallPct, overallPct);
            onProgress?.("Sedang mengompres video " + lastReportedOverallPct + "%");
          });
          const resultType = blob.type.startsWith("video/") ? blob.type : (mimeType || "video/webm");
          const extension = resultType.includes("mp4") ? "mp4" : "webm";
          const baseName = file.name.replace(/\.[^.]+$/, "") || "amasa-video";
          result = new File([blob], baseName + "-compressed." + extension, {
            type: resultType,
            lastModified: Date.now()
          });
          break;
        } catch (error) {
          lastError = error;
          if (error?.mediaErrorCode === 4) {
            if (file.size <= AMASA_CONTENT_VIDEO_MAX_UPLOAD_BYTES) {
              onProgress?.("Browser HP tidak bisa membaca video untuk kompresi. Mengunggah file asli (" + formatFileSize(file.size) + ") tanpa kompresi…");
              return file;
            }
            throw new Error("Browser HP tidak bisa membaca video untuk kompresi dan ukuran file asli melebihi batas upload 50 MB.");
          }
          onProgress?.("Kompresi " + profile.label + (keepAudio ? " + audio" : " tanpa audio") + " gagal pada percobaan codec: " + (error?.message || "error tidak diketahui"));
        }
      }
      if (!result) continue;
      if (!smallest || result.size < smallest.size) smallest = result;
      if (result.size <= AMASA_CONTENT_VIDEO_MAX_BYTES) {
        lastReportedOverallPct = 100;
        onProgress?.("Sedang mengompres video 100%");
        onProgress?.("Selesai: " + formatFileSize(result.size) + " (maksimal 20 MB).");
        return result;
      }
    }
  }
  if (!smallest && lastError) {
    onProgress?.("Kompresi gagal: " + (lastError?.message || "browser tidak dapat membaca video"));
    throw lastError;
  }
  throw new Error("Video tetap lebih dari 20 MB setelah kompresi otomatis. Coba video yang lebih pendek. Hasil terkecil: " +
    (smallest ? formatFileSize(smallest.size) : "tidak tersedia") + ".");
}

async function uploadContentImage(file,sectionSlug){const optimized=await compressContentImage(file,sectionSlug);const id=(crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+"-"+Math.random().toString(36).slice(2));const path="content/"+sectionSlug+"/"+id+".webp";const {error}=await db.storage.from("amasa-products").upload(path,optimized,{upsert:false,contentType:"image/webp",cacheControl:"31536000"});if(error)throw error;return db.storage.from("amasa-products").getPublicUrl(path).data.publicUrl}
async function uploadContentVideo(file, onProgress){
  const optimized = await compressContentVideo(file, onProgress);
  if (optimized.size > AMASA_CONTENT_VIDEO_MAX_UPLOAD_BYTES) {
    throw new Error("Upload dibatalkan: ukuran video melebihi batas Storage 50 MB.");
  }
  const ext = optimized.type.includes("mp4") ? "mp4" : "webm";
  const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(36).slice(2));
  const path = "content/video/" + id + "." + ext;
  // Mirror Geparu's proven direct-fetch Storage upload flow.
  // Use the active Supabase session token and return the real Storage error body.
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw new Error("Gagal membaca sesi login: " + sessionError.message);
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sesi login berakhir. Silakan login ulang sebelum upload video.");

  const objectUrl = SUPABASE_URL + "/storage/v1/object/amasa-products/" +
    path.split("/").map(part => encodeURIComponent(part)).join("/");
  const response = await fetch(objectUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + accessToken,
      "Accept": "application/json",
      "Content-Type": optimized.type || (ext === "mp4" ? "video/mp4" : "video/webm"),
      "x-upsert": "false",
      "cache-control": "31536000"
    },
    body: optimized
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Storage upload HTTP " + response.status + (detail ? ": " + detail.slice(0, 350) : ""));
  }

  return SUPABASE_URL + "/storage/v1/object/public/amasa-products/" +
    path.split("/").map(part => encodeURIComponent(part)).join("/");
}
function itemSectionSlug(id){const card=document.querySelector('[data-content-edit="'+id+'"]');return card?.dataset.sectionSlug||"";}
$("#contentForm").onsubmit=async e=>{
 e.preventDefault();const id=$("#contentId").value,saveBtn=$("#saveContent");saveBtn.disabled=true;saveBtn.textContent="Menyimpan...";
 try{
  const sectionName=$("#contentSectionName").value,p={title:$("#contentTitle").value.trim()||null,subtitle:$("#contentSubtitle").value.trim()||null,content:$("#contentBody").value.trim()||null,image_url:$("#contentImage").dataset.currentUrl||null,button_text:null,button_url:null,is_active:$("#contentActive").checked,updated_at:new Date().toISOString()};
  if(sectionName==="Galeri"){
   const entries=getGalleryAdminItems(),items=[];
   for(let n=0;n<entries.length;n++){let url=entries[n].url||"";if(entries[n].input?.files?.[0]){try{url=await uploadContentImage(entries[n].input._compressedFile||entries[n].input.files[0],"gallery")}catch(err){throw new Error("Gagal upload Foto "+(n+1)+": "+(err?.message||"Failed to fetch"))}}if(url)items.push({image_url:url,label:"PRODUCT GALLERY "+String(items.length+1).padStart(2,"0")})}
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="Video"){
   const entries=getVideoAdminItems(),items=[];
   for(let n=0;n<entries.length;n++){let url=entries[n].url||entries[n].file?.dataset.currentUrl||"";if(entries[n].file?.files?.[0]){const info=entries[n].file.closest(".video-admin-item")?.querySelector(".video-info");try{url=await uploadContentVideo(entries[n].file.files[0],message=>{if(info)info.textContent=message})}catch(err){throw new Error("Gagal upload Video "+(n+1)+": "+(err?.message||"Failed to fetch"))}}if(url)items.push({title:entries[n].title||"Video AMASA",url})}
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="FAQ"){
   const items=getFaqAdminItems();
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="Testimoni"){
   const items=getTestimonialAdminItems();
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="Tentang AMASA"){
   p.content=JSON.stringify({paragraph1:$("#aboutParagraph1").value.trim(),paragraph2:$("#aboutParagraph2").value.trim()});
   const file=$("#contentImage").files[0];if(file)p.image_url=await uploadContentImage($("#contentImage")._compressedFile||file,"about");
  }else{const file=$("#contentImage").files[0];if(file)p.image_url=await uploadContentImage($("#contentImage")._compressedFile||file,contentSectionSlug())}
  const r=await db.from("amasa_site_content").update(p).eq("id",id);if(r.error)throw r.error;
  closeContentModal();toast("Konten berhasil diperbarui.");await loadWebsiteContent();
 }catch(err){toast(err?.message||"Gagal menyimpan konten.")}finally{saveBtn.disabled=false;saveBtn.textContent="Simpan Konten"}
};

(async()=>{if(await requireAdmin()){
  startAmasaAccessWatch();try{await Promise.all([loadCategories(),loadProducts(),loadWebsiteContent(),loadSettings(),loadVisitorAnalytics()]);$("#statSystem").textContent="OK"}catch(e){console.error(e);$("#statSystem").textContent="OFF"}}})();
// mobile sidebar navigation fix
