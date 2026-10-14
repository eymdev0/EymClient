import fs from 'node:fs';
import path from 'node:path';
import { getVersionRoot } from './storage.js';

const API = 'https://api.modrinth.com/v2';
const PROFILES = {
  balanced: ['sodium', 'lithium', 'ferrite-core', 'immediatelyfast', 'entityculling', 'modernfix'],
  competitive: ['sodium', 'lithium', 'ferrite-core', 'immediatelyfast', 'entityculling', 'modernfix', 'dynamic-fps'],
  visual: ['sodium', 'sodium-extra', 'lithium', 'ferrite-core', 'immediatelyfast', 'entityculling'],
  essentials: ['sodium', 'lithium', 'ferrite-core', 'immediatelyfast', 'entityculling', 'modernfix', 'dynamic-fps', 'modmenu']
};

const QUICK_MODS = {
  sodium: { name: 'Sodium', slug: 'sodium', description: 'Render performansı ve daha yüksek FPS.' },
  lithium: { name: 'Lithium', slug: 'lithium', description: 'Oyun mantığı ve sunucu tarafı optimizasyonları.' },
  ferrite: { name: 'FerriteCore', slug: 'ferrite-core', description: 'Bellek kullanımını azaltmaya yardımcı olur.' },
  entity: { name: 'EntityCulling', slug: 'entityculling', description: 'Görünmeyen varlıkların gereksiz çizimini azaltır.' },
  modmenu: { name: 'Mod Menu', slug: 'modmenu', description: 'Kurulu Fabric modlarını oyun içinden yönet.' },
  iris: { name: 'Iris Shaders', slug: 'iris', description: 'Shader paketlerini Fabric üzerinde kullan.' }
};

async function getProjectVersion(slug, gameVersion, loader) {
  const params = new URLSearchParams({ game_versions: JSON.stringify([gameVersion]), loaders: JSON.stringify([loader]), limit: '10' });
  const response = await fetch(`${API}/project/${encodeURIComponent(slug)}/version?${params}`, {
    headers: { 'User-Agent': 'EymClient/2.3.0' }
  });
  if (!response.ok) throw new Error(`${slug}: Modrinth ${response.status}`);
  const versions = await response.json();
  return versions.find(v => v.version_type === 'release') || versions[0] || null;
}

async function installSlug(slug, version, loader, send) {
  const modsDir = path.join(getVersionRoot(version, loader), 'mods');
  fs.mkdirSync(modsDir, { recursive: true });
  const modVersion = await getProjectVersion(slug, version, loader);
  const file = modVersion?.files?.find(f => f.primary) || modVersion?.files?.[0];
  if (!file?.url) throw new Error(`${slug}: bu sürüm için uyumlu dosya bulunamadı`);
  const target = path.join(modsDir, file.filename);
  const response = await fetch(file.url, { headers: { 'User-Agent': 'EymClient/2.3.0' } });
  if (!response.ok) throw new Error(`${slug}: indirme ${response.status}`);
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  send?.({ type: 'status', message: `${file.filename} kuruldu.` });
  return { slug, filename: file.filename, version: modVersion.version_number };
}

export async function installOptimizationProfile({ version, loader = 'fabric', profile = 'competitive', send }) {
  if (loader !== 'fabric') throw new Error('Optimize profilleri şu anda Fabric içindir.');
  const slugs = PROFILES[profile] || PROFILES.competitive;
  const installed = [];
  const failed = [];
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    send?.({ type: 'status', message: `${slug} uyumlu sürümü aranıyor...` });
    try {
      installed.push(await installSlug(slug, version, loader, send));
    } catch (error) {
      failed.push({ slug, error: error.message });
    }
    send?.({ type: 'progress', data: { percent: Math.round(((i + 1) / slugs.length) * 100) } });
  }
  return { profile, version, loader, installed, failed, modsDir: path.join(getVersionRoot(version, loader), 'mods') };
}

export async function installQuickMod({ version, loader = 'fabric', mod, send }) {
  if (loader !== 'fabric') throw new Error('Hızlı mod kurulumu Fabric içindir.');
  const item = QUICK_MODS[mod];
  if (!item) throw new Error('Bilinmeyen hızlı mod.');
  send?.({ type: 'status', message: `${item.name} için uyumlu sürüm aranıyor...` });
  const installed = [];
  // Iris is intentionally paired with Sodium because Iris requires a compatible renderer stack.
  if (mod === 'iris') installed.push(await installSlug('sodium', version, loader, send));
  installed.push(await installSlug(item.slug, version, loader, send));
  return { mod, name: item.name, installed, modsDir: path.join(getVersionRoot(version, loader), 'mods') };
}

export function getQuickMods() {
  return Object.entries(QUICK_MODS).map(([id, item]) => ({ id, ...item }));
}

export function getInstalledMods(version, loader = 'fabric') {
  const modsDir = path.join(getVersionRoot(version, loader), 'mods');
  if (!fs.existsSync(modsDir)) return [];
  return fs.readdirSync(modsDir).filter(file => file.endsWith('.jar'));
}

export function copyOptifine(version, loader, sourcePath) {
  if (!sourcePath || !sourcePath.toLowerCase().endsWith('.jar')) throw new Error('Bir OptiFine .jar dosyası seçmelisin.');
  const modsDir = path.join(getVersionRoot(version, loader), 'mods');
  fs.mkdirSync(modsDir, { recursive: true });
  const target = path.join(modsDir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  return target;
}

export async function searchModrinth({ query = '', gameVersion, loader = 'fabric', offset = 0, limit = 24 }) {
  const facets = [[`project_type:mod`]];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader && loader !== 'vanilla') facets.push([`categories:${loader}`]);
  const params = new URLSearchParams({ query: String(query), facets: JSON.stringify(facets), index: 'relevance', offset: String(Math.max(0, Number(offset)||0)), limit: String(Math.min(100, Math.max(1, Number(limit)||24))) });
  const response = await fetch(`${API}/search?${params}`, { headers: { 'User-Agent': 'EymClient/2.4.0' } });
  if (!response.ok) throw new Error(`Modrinth arama ${response.status}`);
  const data = await response.json();
  return { ...data, hits: (data.hits || []).filter(x => x.project_type === 'mod') };
}

export async function getModrinthVersions(projectId, gameVersion, loader='fabric') {
  const params = new URLSearchParams({ game_versions: JSON.stringify([gameVersion]), loaders: JSON.stringify([loader]), include_changelog: 'false' });
  const response = await fetch(`${API}/project/${encodeURIComponent(projectId)}/version?${params}`, { headers: { 'User-Agent': 'EymClient/2.4.0' } });
  if (!response.ok) throw new Error(`Modrinth sürümleri ${response.status}`);
  const versions = await response.json();
  return versions.map(v => ({
    id:v.id, name:v.name, version_number:v.version_number, version_type:v.version_type, date_published:v.date_published,
    downloads:v.downloads, dependencies:v.dependencies || [], files:(v.files||[]).map(f=>({filename:f.filename,primary:f.primary,size:f.size,url:f.url,hashes:f.hashes}))
  }));
}

async function fetchVersion(versionId) {
  const response = await fetch(`${API}/version/${encodeURIComponent(versionId)}`, { headers: { 'User-Agent': 'EymClient/2.4.0' } });
  if (!response.ok) throw new Error(`Modrinth sürümü ${response.status}`);
  return response.json();
}

async function installModrinthVersion(versionId, version, loader, send, installedProjects=new Set()) {
  const modVersion = await fetchVersion(versionId);
  if (installedProjects.has(modVersion.project_id)) return [];
  installedProjects.add(modVersion.project_id);
  const installed=[];
  for (const dep of (modVersion.dependencies||[]).filter(d=>d.dependency_type==='required')) {
    if (dep.version_id) installed.push(...await installModrinthVersion(dep.version_id,version,loader,send,installedProjects));
    else if (dep.project_id) {
      const versions=await getModrinthVersions(dep.project_id,version,loader);
      const candidate=versions.find(v=>v.version_type==='release')||versions[0];
      if(candidate) installed.push(...await installModrinthVersion(candidate.id,version,loader,send,installedProjects));
    }
  }
  const file=modVersion.files?.find(f=>f.primary)||modVersion.files?.[0];
  if(!file?.url) throw new Error(`${modVersion.name}: indirilebilir JAR bulunamadı.`);
  const modsDir=path.join(getVersionRoot(version,loader),'mods'); fs.mkdirSync(modsDir,{recursive:true});
  const target=path.join(modsDir,file.filename);
  if(!fs.existsSync(target)){
    send?.({type:'status',message:`${modVersion.name} indiriliyor...`});
    const response=await fetch(file.url,{headers:{'User-Agent':'EymClient/2.4.0'}});
    if(!response.ok) throw new Error(`${modVersion.name}: indirme ${response.status}`);
    fs.writeFileSync(target,Buffer.from(await response.arrayBuffer()));
  }
  installed.push({projectId:modVersion.project_id,name:modVersion.name,version:modVersion.version_number,filename:file.filename,path:target});
  return installed;
}

export async function installModrinthVersionById({ versionId, version, loader='fabric', send }) {
  if(loader==='vanilla') throw new Error('Mod kurulumu için Fabric, Forge veya NeoForge gibi bir mod loader seçmelisin.');
  const installed=await installModrinthVersion(versionId,version,loader,send,new Set());
  send?.({type:'progress',data:{percent:100}});
  return {version,loader,installed,modsDir:path.join(getVersionRoot(version,loader),'mods')};
}
