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

  const today=new Date();
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
async function loadProducts(){const {data,error}=await db.from("amasa_products").select("id,category_id,name,slug,sku,short_description,description,image_url,price,size_label,badge,usage_instructions,safety_information,sort_order,is_active,is_featured,amasa_categories(name,slug)").order("sort_order",{ascending:true}).order("name",{ascending:true});if(error){$("#statSystem").textContent="OFF";$("#productsTableBody").innerHTML='<tr><td colspan="6" class="empty">'+esc(error.message)+'</td></tr>';return}products=data||[];renderProducts();$("#statProducts").textContent=products.length;$("#statActive").textContent=products.filter(x=>x.is_active).length}
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
  grid.innerHTML=items.length?items.map(x=>'<button type="button" class="content-card" data-content-edit="'+x.id+'" data-gallery="'+(x.section_slug==="gallery"?esc(x.content||""):"")+'"><strong>'+esc(x.section_name)+'</strong><span>'+esc(x.title||"Belum diatur")+'</span><small class="muted">'+(x.is_active?"Aktif":"Nonaktif")+'</small></button>').join(""):'<div class="empty">Belum ada konten website.</div>';
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
    input.onchange=()=>{const f=input.files[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>5*1024*1024){toast("File gambar tidak valid atau lebih dari 5 MB.");input.value="";return}img.src=URL.createObjectURL(f);img.hidden=false;info.textContent=f.name+" • "+Math.round(f.size/1024)+" KB"};
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
      if(!f.type.startsWith("video/")||f.size>100*1024*1024){toast("File video harus berupa video dan maksimal 100 MB.");file.value="";return}
      wrap.querySelector(".video-url").value="";
      wrap.querySelector(".video-info").textContent=f.name+" • "+Math.round(f.size/1024/1024)+" MB";
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

function openContentModal(item){
  if(!item||item.section_slug==="settings")return;
  $("#contentModal").hidden=false;$("#contentModalTitle").textContent="Edit "+item.section_name;$("#contentId").value=item.id;$("#contentSectionName").value=item.section_name||"";$("#contentTitle").value=item.title||"";$("#contentSubtitle").value=item.subtitle||"";$("#contentBody").value=item.content||"";
  $("#aboutParagraph1").value="";$("#aboutParagraph2").value="";
  if(item.section_slug==="about"){try{const about=JSON.parse(item.content||"{}");$("#aboutParagraph1").value=about.paragraph1||"";$("#aboutParagraph2").value=about.paragraph2||""}catch(e){}}
  $("#contentBodyWrap").hidden=item.section_slug==="about";$("#aboutParagraph1Wrap").hidden=item.section_slug!=="about";$("#aboutParagraph2Wrap").hidden=item.section_slug!=="about";
  $("#contentImage").value="";$("#contentImage").dataset.currentUrl=item.image_url||"";$("#contentImageInfo").textContent=item.image_url?"Gambar saat ini tersimpan. Pilih file baru untuk menggantinya.":"JPG, PNG, WEBP. Maksimal 5 MB.";$("#contentImagePreview").src=item.image_url||"";$("#contentImagePreview").hidden=!item.image_url;$("#contentActive").checked=!!item.is_active;
  const isGallery=item.section_slug==="gallery",isVideo=item.section_slug==="video";
  $("#contentBodyWrap").hidden=isGallery||isVideo||item.section_slug==="about";$("#galleryImagesWrap").hidden=!isGallery;$("#videoItemsWrap").hidden=!isVideo;$("#contentImageWrap").hidden=isGallery||isVideo;
  if(isGallery){let g={};try{g=JSON.parse(item.content||"{}")}catch(e){}let items=Array.isArray(g.items)?g.items:[];if(!items.length&&item.image_url)items=[{image_url:item.image_url,label:"PRODUCT GALLERY 01"}];renderGalleryAdmin(items)}else $("#galleryAdminList").innerHTML="";
  if(isVideo){let v={};try{v=JSON.parse(item.content||"{}")}catch(e){}renderVideoAdmin(Array.isArray(v.items)?v.items:[])}else $("#videoAdminList").innerHTML="";
}

$("#addGalleryImage").onclick=addGalleryAdminSlot;
$("#addVideoItem").onclick=addVideoAdminSlot;
function closeContentModal(){$("#contentModal").hidden=true}
document.querySelectorAll("[data-content-close]").forEach(b=>b.onclick=closeContentModal);
$("#contentImage").onchange=()=>{const f=$("#contentImage").files[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>5*1024*1024){toast("File gambar tidak valid atau lebih dari 5 MB.");$("#contentImage").value="";return}$("#contentImagePreview").src=URL.createObjectURL(f);$("#contentImagePreview").hidden=false;$("#contentImageInfo").textContent=f.name+" • "+Math.round(f.size/1024)+" KB"};
document.querySelectorAll(".gallery-file").forEach(input=>input.onchange=()=>{const f=input.files[0],n=input.dataset.slot;if(!f)return;if(!f.type.startsWith("image/")||f.size>5*1024*1024){toast("File gambar tidak valid atau lebih dari 5 MB.");input.value="";return}const img=document.querySelector(`.gallery-preview[data-preview="${n}"]`),info=document.querySelector(`.gallery-info[data-info="${n}"]`);if(img){img.src=URL.createObjectURL(f);img.hidden=false}if(info)info.textContent=f.name+" • "+Math.round(f.size/1024)+" KB"});
async function uploadContentImage(file,sectionSlug){const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";const id=(crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+"-"+Math.random().toString(36).slice(2));const path="content/"+sectionSlug+"/"+id+"."+ext;const {error}=await db.storage.from("amasa-products").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg",cacheControl:"31536000"});if(error)throw error;return db.storage.from("amasa-products").getPublicUrl(path).data.publicUrl}
async function uploadContentVideo(file){const ext=(file.name.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"")||"mp4";const id=(crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+"-"+Math.random().toString(36).slice(2));const path="content/video/"+id+"."+ext;const {error}=await db.storage.from("amasa-products").upload(path,file,{upsert:false,contentType:file.type||"video/mp4",cacheControl:"31536000"});if(error)throw error;return db.storage.from("amasa-products").getPublicUrl(path).data.publicUrl}
function itemSectionSlug(id){const card=document.querySelector('[data-content-edit="'+id+'"]');return card?.dataset.sectionSlug||"";}
$("#contentForm").onsubmit=async e=>{
 e.preventDefault();const id=$("#contentId").value,saveBtn=$("#saveContent");saveBtn.disabled=true;saveBtn.textContent="Menyimpan...";
 try{
  const sectionName=$("#contentSectionName").value,p={title:$("#contentTitle").value.trim()||null,subtitle:$("#contentSubtitle").value.trim()||null,content:$("#contentBody").value.trim()||null,image_url:$("#contentImage").dataset.currentUrl||null,button_text:null,button_url:null,is_active:$("#contentActive").checked,updated_at:new Date().toISOString()};
  if(sectionName==="Galeri"){
   const entries=getGalleryAdminItems(),items=[];
   for(let n=0;n<entries.length;n++){let url=entries[n].url||"";if(entries[n].input?.files?.[0]){try{url=await uploadContentImage(entries[n].input.files[0],"gallery")}catch(err){throw new Error("Gagal upload Foto "+(n+1)+": "+(err?.message||"Failed to fetch"))}}if(url)items.push({image_url:url,label:"PRODUCT GALLERY "+String(items.length+1).padStart(2,"0")})}
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="Video"){
   const entries=getVideoAdminItems(),items=[];
   for(let n=0;n<entries.length;n++){let url=entries[n].url||entries[n].file?.dataset.currentUrl||"";if(entries[n].file?.files?.[0]){try{url=await uploadContentVideo(entries[n].file.files[0])}catch(err){throw new Error("Gagal upload Video "+(n+1)+": "+(err?.message||"Failed to fetch"))}}if(url)items.push({title:entries[n].title||"Video AMASA",url})}
   p.content=JSON.stringify({items});p.image_url=null;
  }else if(sectionName==="Tentang AMASA"){
   p.content=JSON.stringify({paragraph1:$("#aboutParagraph1").value.trim(),paragraph2:$("#aboutParagraph2").value.trim()});
   const file=$("#contentImage").files[0];if(file)p.image_url=await uploadContentImage(file,"about");
  }else{const file=$("#contentImage").files[0];if(file)p.image_url=await uploadContentImage(file,sectionName.toLowerCase().replace(/[^a-z0-9]+/g,"-"))}
  const r=await db.from("amasa_site_content").update(p).eq("id",id);if(r.error)throw r.error;
  closeContentModal();toast("Konten berhasil diperbarui.");await loadWebsiteContent();
 }catch(err){toast(err?.message||"Gagal menyimpan konten.")}finally{saveBtn.disabled=false;saveBtn.textContent="Simpan Konten"}
};

(async()=>{if(await requireAdmin()){try{await Promise.all([loadCategories(),loadProducts(),loadWebsiteContent(),loadSettings(),loadVisitorAnalytics()]);$("#statSystem").textContent="OK"}catch(e){console.error(e);$("#statSystem").textContent="OFF"}}})();
// mobile sidebar navigation fix
