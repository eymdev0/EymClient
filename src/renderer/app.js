const { ipcRenderer } = require('electron');
const $ = id => document.getElementById(id);
let accounts = { activeId:null, accounts:[] };
let currentAuth = null;
let settings = { ram:4, version:'1.20.1', loader:'fabric', discordRichPresence:true, discordClientId:'', optimizeProfile:'competitive' };
let versions = [];
let versionFilter = 'release';

function log(message){ const box=$('log'); box.textContent += `\n${new Date().toLocaleTimeString()}  ${message}`; box.scrollTop=box.scrollHeight; }
function toast(title,text){ $('toastTitle').textContent=title; $('toastText').textContent=text; $('toast').classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=> $('toast').classList.remove('show'),3600); }
function page(name){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); $(`page-${name}`).classList.add('active'); document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name)); if(name==='versions') loadVersions(); if(name==='accounts') renderAccounts(); }
function initials(name='E'){ return String(name).slice(0,1).toUpperCase(); }
function activeAccount(){ return accounts.accounts.find(a=>a.id===accounts.activeId) || null; }
function syncAccountUI(){
  const a=activeAccount();
  $('accountCount').textContent=accounts.accounts.length;
  $('miniProfile').querySelector('.avatar').textContent=initials(a?.name||'E');
  $('miniProfile').querySelector('strong').textContent=a?.name||'Misafir';
  $('miniProfile').querySelector('span').textContent=a?(a.mode==='premium'?'Microsoft • Premium':'Offline profil'):'Hesap seçilmedi';
  $('homeAccount').textContent=a?.name||'Hesap seç';
  $('homeAccountType').textContent=a?(a.mode==='premium'?'Microsoft Premium':'Offline profil'):'Oturum bekleniyor';
  $('homeAccountMeta').textContent=a?`${a.mode==='premium'?'Microsoft hesabı':'Yerel profil'} • ${a.uuid?.slice(0,8)||'--------'}`:'Microsoft veya offline hesap ekle';
  $('homeAvatar').textContent=initials(a?.name||'E');
  $('playBtn').disabled=!a;
}
function updateSettingsUI(){
  $('ram').value=settings.ram||4; $('ramValue').textContent=`${settings.ram||4} GB`; $('ramMetric').textContent=`${settings.ram||4} GB`;
  $('loader').value=settings.loader||'fabric'; $('discordClientId').value=settings.discordClientId||''; $('discordToggle').classList.toggle('on',settings.discordRichPresence!==false); $('presenceMetric').textContent=settings.discordRichPresence===false?'OFF':'ON';
  $('homeVersion').textContent=settings.version||'1.20.1'; $('homeLoader').textContent=(settings.loader||'fabric').replace(/^./,x=>x.toUpperCase());
}
async function loadAccounts(){ accounts=await ipcRenderer.invoke('accounts:list'); syncAccountUI(); renderAccounts(); }
function renderAccounts(){
  const box=$('accountsList'); if(!accounts.accounts.length){ box.innerHTML='<div class="loading-card">Henüz hesap yok. Sağdaki formdan offline hesap ekleyebilir veya Microsoft hesabı bağlayabilirsin.</div>'; return; }
  box.innerHTML=accounts.accounts.map(a=>`<div class="account-item ${a.id===accounts.activeId?'active':''}" data-id="${a.id}"><div class="acc-avatar">${initials(a.name)}</div><div class="acc-main"><b>${escapeHtml(a.name)}</b><span>${a.mode==='premium'?'Microsoft Premium':'Offline profil'} • ${a.uuid?.slice(0,8)||''}</span></div><span class="acc-type">${a.mode==='premium'?'PREMIUM':'OFFLINE'}</span><button class="delete" data-delete="${a.id}">×</button></div>`).join('');
  box.querySelectorAll('.account-item').forEach(el=>el.onclick=async e=>{ if(e.target.closest('[data-delete]')) return; try{ currentAuth=await ipcRenderer.invoke('auth:select',el.dataset.id); accounts=await ipcRenderer.invoke('accounts:list'); syncAccountUI(); renderAccounts(); toast('Hesap seçildi',`${currentAuth.name} aktif hesap.`); log(`Aktif hesap: ${currentAuth.name}`);}catch(err){toast('Giriş yenilenemedi',err.message);log(err.message);} });
  box.querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=async e=>{e.stopPropagation(); await ipcRenderer.invoke('accounts:delete',btn.dataset.delete); if(accounts.activeId===btn.dataset.delete) currentAuth=null; await loadAccounts(); toast('Hesap silindi','Hesap listeden kaldırıldı.');});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function loadVersions(){
  $('versionsGrid').innerHTML='<div class="loading-card">Mojang sürüm manifesti okunuyor...</div>';
  const result=await ipcRenderer.invoke('versions:list'); versions=result.versions||[]; renderVersions(); fillVersionSelect(); if(result.error) log(`Sürüm listesi: ${result.error}`);
}
function renderVersions(){
  const query=$('versionSearch').value.trim().toLowerCase();
  const list=versions.filter(v=>(versionFilter==='all'||v.type==='release')&&v.id.toLowerCase().includes(query)).slice(0,60);
  $('versionsGrid').innerHTML=list.length?list.map(v=>`<div class="version-card ${v.installed?'installed':''}"><div class="v-top"><b>${escapeHtml(v.id)}</b><span class="v-status">${v.installed?'HAZIR':'YENİ'}</span></div><small>${new Date(v.releaseTime).toLocaleDateString('tr-TR')} • ${v.type.toUpperCase()}</small><button data-version="${escapeHtml(v.id)}">${v.id===settings.version?'Aktif profil':'Bu sürümü seç'}</button></div>`).join(''):'<div class="loading-card">Aradığın sürüm bulunamadı.</div>';
  $('versionsGrid').querySelectorAll('[data-version]').forEach(btn=>btn.onclick=async()=>{settings=await ipcRenderer.invoke('settings:set',{version:btn.dataset.version}); updateSettingsUI(); fillVersionSelect(); toast('Sürüm seçildi',`${btn.dataset.version} aktif profil oldu.`);});
}
function fillVersionSelect(){ const select=$('versionSelect'); const known=versions.length?versions.map(v=>v.id):['1.20.1','1.21.1','1.21.4']; if(!known.includes(settings.version)) known.unshift(settings.version); select.innerHTML=known.slice(0,80).map(v=>`<option value="${v}">${v}</option>`).join(''); select.value=settings.version; }
async function connectDiscord(){ const id=$('discordClientId').value.trim(); settings=await ipcRenderer.invoke('settings:set',{discordClientId:id,discordRichPresence:true}); const result=await ipcRenderer.invoke('discord:connect',id); if(result.connected){$('discordState').textContent='Discord bağlı';$('discordBadge').textContent='BAĞLI';toast('Discord hazır','Rich Presence bağlantısı kuruldu.');}else{toast('Discord bağlanamadı','Discord masaüstü uygulaması açık olmalı.');log(`Discord: ${result.reason||'bağlantı yok'}`);} }
async function addMicrosoft(){ try{ toast('Microsoft','Giriş penceresi açılıyor...'); currentAuth=await ipcRenderer.invoke('auth:microsoft'); await loadAccounts(); syncAccountUI(); toast('Hesap eklendi',`${currentAuth.name} Premium hesap olarak kaydedildi.`); }catch(err){toast('Microsoft girişi başarısız',err.message);log(err.stack||err.message);} }
async function addOffline(){ const name=$('offlineName').value.trim(); if(!name) return toast('Eksik bilgi','Oyuncu adı gir.'); try{currentAuth=await ipcRenderer.invoke('auth:offline',name); $('offlineName').value=''; await loadAccounts(); toast('Offline hesap eklendi',`${currentAuth.name} aktif hesap.`);}catch(err){toast('Hesap eklenemedi',err.message);} }
async function launch(){ const a=activeAccount(); if(!a) return toast('Hesap seç','Önce Hesaplar bölümünden bir hesap seç.'); try{ $('playBtn').disabled=true; $('statusText').textContent='Hazırlanıyor'; $('statusMeta').textContent='Başlatma hazırlanıyor...'; $('progressBar').style.width='0%'; $('progressText').textContent='0%'; log(`${settings.version} / ${settings.loader} başlatılıyor...`); await ipcRenderer.invoke('minecraft:launch',{version:settings.version, minecraftVersion:settings.version, loader:settings.loader, memory:(settings.ram||4)*1024, discord:{enabled:settings.discordRichPresence,clientId:settings.discordClientId}}); }catch(err){toast('Minecraft başlatılamadı',err.message);log(err.stack||err.message);$('playBtn').disabled=false;} }

for(const n of document.querySelectorAll('.nav')) n.onclick=()=>page(n.dataset.page);
document.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>page(b.dataset.pageJump));
$('minimizeBtn').onclick=()=>ipcRenderer.invoke('window:minimize'); $('maximizeBtn').onclick=()=>ipcRenderer.invoke('window:maximize'); $('closeBtn').onclick=()=>ipcRenderer.invoke('window:close');
$('addMicrosoft').onclick=addMicrosoft; $('addOffline').onclick=addOffline; $('playBtn').onclick=launch; $('miniAccount').onclick=()=>page('accounts'); $('clearLog').onclick=()=>$('log').textContent='EymClient log temizlendi.';
$('ram').oninput=async e=>{settings=await ipcRenderer.invoke('settings:set',{ram:Number(e.target.value)});updateSettingsUI();};
$('loader').onchange=async e=>{settings=await ipcRenderer.invoke('settings:set',{loader:e.target.value});updateSettingsUI();};
$('versionSelect').onchange=async e=>{settings=await ipcRenderer.invoke('settings:set',{version:e.target.value});updateSettingsUI();};
$('discordToggle').onclick=async()=>{settings=await ipcRenderer.invoke('settings:set',{discordRichPresence:!settings.discordRichPresence});updateSettingsUI();if(!settings.discordRichPresence) await ipcRenderer.invoke('discord:disconnect');}; $('discordConnect').onclick=connectDiscord;
$('refreshVersions').onclick=loadVersions; $('versionSearch').oninput=renderVersions; document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');versionFilter=b.dataset.filter;renderVersions();});
async function loadQuickMods(){
  const box=$('quickMods');
  if(!box) return;
  try{
    const mods=await ipcRenderer.invoke('mods:quick-list');
    box.innerHTML=mods.map(m=>`<div class="quick-mod" data-mod="${m.id}"><div><b>${m.name}</b><span>${m.description}</span></div><button class="secondary-btn quick-install">Kur</button></div>`).join('');
    box.querySelectorAll('.quick-install').forEach(btn=>btn.onclick=async()=>{
      const card=btn.closest('.quick-mod'); const mod=card.dataset.mod;
      try{
        btn.disabled=true; btn.textContent='Kuruluyor...';
        const r=await ipcRenderer.invoke('mods:quick-install',{version:settings.version,loader:settings.loader,mod});
        const count=Array.isArray(r?.installed)?r.installed.length:0;
        $('modMetric').textContent=String((Number($('modMetric').textContent)||0)+count);
        toast('Kurulum tamamlandı',`${r.name} seçili profile eklendi.`);
        log(`Hızlı mod: ${r.name} kuruldu.`);
      }catch(err){ toast('Kurulum başarısız',err.message); log(`Hızlı mod hatası: ${err.message}`); }
      finally{ btn.disabled=false; btn.textContent='Kur'; }
    });
  }catch(err){ box.innerHTML='<div class="loading-card">Mod merkezi yüklenemedi.</div>'; log(`Mod merkezi: ${err.message}`); }
}

document.querySelectorAll('.optimize-btn').forEach(btn=>btn.onclick=async()=>{const profile=btn.closest('.profile-card').dataset.profile;try{toast('Optimize',`${profile} profili kuruluyor...`);const r=await ipcRenderer.invoke('mods:optimize',{version:settings.version,loader:settings.loader,profile});$('modMetric').textContent=r.installed.length;toast('Optimize tamamlandı',`${r.installed.length} mod kuruldu${r.failed.length?`, ${r.failed.length} atlandı`:''}.`);log(`Optimize ${profile}: ${r.installed.length} mod kuruldu.`);}catch(err){toast('Optimize başarısız',err.message);log(err.message);}}); $('optifineBtn').onclick=async()=>{try{const result=await ipcRenderer.invoke('mods:optifine',{version:settings.version,loader:settings.loader});if(result) toast('OptiFine eklendi','JAR seçili profilin mods klasörüne kopyalandı.');}catch(err){toast('OptiFine eklenemedi',err.message);}};
ipcRenderer.on('launcher:event',(_,e)=>{
  if(e.type==='status'){
    $('statusText').textContent=e.message;
    $('statusMeta').textContent=e.message;
    log(e.message);
  }
  if(e.type==='log'||e.type==='game-log') log(e.message);
  if(e.type==='download-complete') log(`Dosya indirildi: ${typeof e.data==='string'?e.data:JSON.stringify(e.data)}`);
  if(e.type==='download' && e.data){
    const d=e.data;
    const name=d.name||d.file||d.path||d.type||'dosya';
    const current=Number(d.current??d.downloaded??d.progress??0);
    const total=Number(d.total??d.size??0);
    if(total>0){
      const p=Math.max(0,Math.min(100,(current/total)*100));
      $('progressBar').style.width=`${p}%`;
      $('progressText').textContent=`${Math.round(p)}%`;
    }
    log(`İndiriliyor: ${name}`);
  }
  if(e.type==='progress'){
    const d=e.data||{};
    let p=Number(d.percent??e.percent);
    if(!Number.isFinite(p) && Number(d.total)>0) p=(Number(d.task||0)/Number(d.total))*100;
    if(!Number.isFinite(p)) p=0;
    p=Math.max(0,Math.min(100,p));
    $('progressBar').style.width=`${p}%`;
    $('progressText').textContent=`${Math.round(p)}%`;
    const stage=d.type?String(d.type):'indirme';
    $('statusMeta').textContent=`${stage} • ${Math.round(p)}%`;
    log(`MCLC ilerleme: ${stage} ${Math.round(p)}%`);
  }
  if(e.type==='game-start'){
    $('statusText').textContent='Minecraft çalışıyor';
    $('statusMeta').textContent=`PID: ${e.pid??'—'}`;
    $('progressBar').style.width='100%';
    $('progressText').textContent='100%';
    log(`Minecraft başladı. PID: ${e.pid??'—'}`);
  }
  if(e.type==='error'){
    $('statusText').textContent='Başlatma hatası';
    $('statusMeta').textContent=e.message||'Bilinmeyen hata';
    $('playBtn').disabled=!activeAccount();
    toast('Minecraft başlatılamadı',e.message||'Bilinmeyen hata');
    log(`HATA: ${e.message||'Bilinmeyen hata'}`);
  }
  if(e.type==='game-exit'){
    $('statusText').textContent='Hazır';
    $('statusMeta').textContent=`Minecraft kapandı • kod ${e.code??0}`;
    $('playBtn').disabled=!activeAccount();
    log(`Minecraft kapandı (${e.code??0}).`);
  }
});
ipcRenderer.on('updater:event',(_,e)=>{if(e.type==='checking')log('Güncelleme kontrol ediliyor...');if(e.type==='available')log(`Yeni EymClient sürümü bulundu: ${e.version}`);if(e.type==='progress')log(`Güncelleme indiriliyor: ${Math.round(e.percent)}%`);if(e.type==='downloaded'){ $('updateVersion').textContent=`v${e.version} indirildi. Yeniden başlatılıyor...`; $('updateToast').classList.add('show'); }if(e.type==='error')log(`Updater: ${e.message}`);}); $('restartBtn').onclick=()=>ipcRenderer.invoke('updater:install');
(async()=>{try{const info=await ipcRenderer.invoke('app:get-info');$('appVersion').textContent=`v${info.version}`;$('storagePath').textContent=info.appData;settings={...settings,...await ipcRenderer.invoke('settings:get')};updateSettingsUI();await loadAccounts();const restored=await ipcRenderer.invoke('auth:restore-active');if(restored?.name&&!restored.error){currentAuth=restored;syncAccountUI();log(`Aktif hesap geri yüklendi: ${restored.name}`);}else if(restored?.error){log(`Aktif Microsoft hesabı yenilenemedi: ${restored.error}`);}if(settings.discordRichPresence&&settings.discordClientId){const d=await ipcRenderer.invoke('discord:connect',settings.discordClientId);if(d.connected){$('discordState').textContent='Discord bağlı';$('discordBadge').textContent='BAĞLI';}}await loadVersions();await loadQuickMods();}catch(e){log(e.stack||e.message);}})();
function onKey(e){if(e.key==='F6')launch();}window.addEventListener('keydown',onKey);

// --- EymClient 2.4: Sponsor Servers + full Modrinth center ---
let modOffset = 0;
let modLastQuery = '';
const modLimit = 18;

async function loadSponsors(){
  try{
    const sponsors=await ipcRenderer.invoke('sponsors:list');
    const home=$('homeSponsors'), grid=$('sponsorGrid');
    const card=(s)=>`<div class="sponsor-card"><div class="sponsor-icon">${s.icon?`<img src="${s.icon}" alt="">`:'★'}</div><div class="sponsor-main"><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.description||s.address)}</span><small>${escapeHtml(s.address)}</small></div><span class="sponsor-fixed">SABİT</span></div>`;
    const empty='<div class="loading-card">Henüz sponsor sunucu eklenmemiş.</div>';
    if(home) home.innerHTML=sponsors.length?sponsors.map(card).join(''):empty;
    if(grid) grid.innerHTML=sponsors.length?sponsors.map(card).join(''):empty;
    return sponsors;
  }catch(err){ log(`Sponsor sunucular: ${err.message}`); return []; }
}
async function syncSponsors(){
  try{const r=await ipcRenderer.invoke('sponsors:sync',{version:settings.version,loader:settings.loader});toast('Sponsor sunucular',`${r.count||0} sponsor sunucu Minecraft listesine sabitlendi.`);log(`Sponsor sunucular senkronize edildi: ${r.count||0}`);await loadSponsors();}
  catch(err){toast('Sponsor senkronizasyonu başarısız',err.message);log(err.message);}
}
function fillModVersion(){
  const select=$('modVersion'); if(!select)return;
  const known=versions.length?versions.filter(v=>v.type==='release').map(v=>v.id):[settings.version];
  const all=[settings.version,...known.filter(v=>v!==settings.version)];
  select.innerHTML=all.slice(0,80).map(v=>`<option value="${escapeHtml(v)}">Minecraft ${escapeHtml(v)}</option>`).join('');
  select.value=settings.version;
}
function modCard(hit){
  return `<article class="mod-card" data-project="${escapeHtml(hit.project_id)}"><div class="mod-icon">${hit.icon_url?`<img src="${escapeHtml(hit.icon_url)}" alt="">`:'◆'}</div><div class="mod-body"><div class="mod-title"><h3>${escapeHtml(hit.title)}</h3><span>${Number(hit.downloads||0).toLocaleString('tr-TR')} indirme</span></div><p>${escapeHtml(hit.description||'')}</p><div class="mod-tags">${(hit.categories||[]).slice(0,4).map(x=>`<i>${escapeHtml(x)}</i>`).join('')}</div><div class="mod-actions"><select class="mod-release"><option value="">Sürümleri getir...</option></select><button class="secondary-btn mod-load-versions">Sürümleri yükle</button><button class="primary-btn mod-install" disabled>İndir</button></div></div></article>`;
}
async function searchMods(reset=true){
  const q=$('modSearch').value.trim(); if(!q)return toast('Mod ara','Aramak istediğin modun adını yaz.');
  if(reset)modOffset=0; modLastQuery=q;
  const version=$('modVersion').value||settings.version, loader=$('modLoader').value||settings.loader;
  const box=$('modResults'); box.innerHTML='<div class="loading-card">Modrinth aranıyor...</div>';
  try{
    const data=await ipcRenderer.invoke('mods:search',{query:q,gameVersion:version,loader,offset:modOffset,limit:modLimit});
    $('modSearchMeta').textContent=`${Number(data.total_hits||0).toLocaleString('tr-TR')} sonuç • ${version} • ${loader}`;
    box.innerHTML=data.hits?.length?data.hits.map(modCard).join(''):'<div class="loading-card">Bu filtrelerle mod bulunamadı.</div>';
    box.querySelectorAll('.mod-load-versions').forEach(btn=>btn.onclick=()=>loadModVersions(btn.closest('.mod-card')));
    box.querySelectorAll('.mod-release').forEach(sel=>sel.onchange=()=>{const b=sel.closest('.mod-card').querySelector('.mod-install');b.disabled=!sel.value;});
    box.querySelectorAll('.mod-install').forEach(btn=>btn.onclick=()=>installMod(btn.closest('.mod-card')));
  }catch(err){box.innerHTML='<div class="loading-card">Modrinth erişilemedi.</div>';toast('Modrinth hatası',err.message);log(err.message);}
}
async function loadModVersions(card){
  const project=card.dataset.project, select=card.querySelector('.mod-release'), version=$('modVersion').value||settings.version, loader=$('modLoader').value;
  select.innerHTML='<option value="">Sürümler yükleniyor...</option>';
  try{
    const list=await ipcRenderer.invoke('mods:versions',{projectId:project,version,loader});
    select.innerHTML=list.length?list.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.version_number)} • ${escapeHtml(v.version_type)} • ${Number(v.downloads||0).toLocaleString('tr-TR')}</option>`).join(''):'<option value="">Uyumlu sürüm yok</option>';
    select.disabled=!list.length; const b=card.querySelector('.mod-install'); b.disabled=!list.length; if(list.length)select.value=list[0].id;
  }catch(err){select.innerHTML='<option value="">Sürümler alınamadı</option>';toast('Sürüm alınamadı',err.message);}
}
async function installMod(card){
  const versionId=card.querySelector('.mod-release').value; if(!versionId)return;
  const btn=card.querySelector('.mod-install'); btn.disabled=true; btn.textContent='İndiriliyor...';
  try{
    const r=await ipcRenderer.invoke('mods:install-version',{versionId,version:$('modVersion').value||settings.version,loader:$('modLoader').value});
    const count=r.installed?.length||0; $('modMetric').textContent=String((Number($('modMetric').textContent)||0)+count);
    toast('Mod kuruldu',`${card.querySelector('h3').textContent} ve gerekli bağımlılıkları kuruldu.`); log(`Modrinth: ${card.querySelector('h3').textContent} kuruldu (${count} dosya).`);
  }catch(err){toast('Mod kurulamadı',err.message);log(`Modrinth kurulum: ${err.message}`);}
  finally{btn.disabled=false;btn.textContent='İndir';}
}

// Wire new controls after the original UI is available.
$('syncSponsors')?.addEventListener('click',syncSponsors);
$('modSearchBtn')?.addEventListener('click',()=>searchMods(true));
$('modSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')searchMods(true);});
$('modPrev')?.addEventListener('click',()=>{if(modOffset>0){modOffset=Math.max(0,modOffset-modLimit);searchMods(false);}});
$('modNext')?.addEventListener('click',()=>{modOffset+=modLimit;searchMods(false);});
$('modLoader')?.addEventListener('change',()=>{if(modLastQuery)searchMods(true);});
$('modVersion')?.addEventListener('change',()=>{if(modLastQuery)searchMods(true);});

const originalPage=page;
page=function(name){originalPage(name);if(name==='modrinth')fillModVersion();if(name==='servers')loadSponsors();};
(async()=>{try{fillModVersion();await loadSponsors();await syncSponsors();}catch(e){log(`Yeni özellikler: ${e.message}`);}})();
