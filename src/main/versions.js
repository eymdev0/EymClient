import fs from 'node:fs';
import path from 'node:path';
import { getRoot, getVersionRoot } from './storage.js';

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

export async function fetchVersions() {
  const response = await fetch(MANIFEST, { headers: { 'User-Agent': 'EymClient/2.2.0' } });
  if (!response.ok) throw new Error(`Minecraft sürüm listesi alınamadı (${response.status}).`);
  const data = await response.json();
  const releases = (data.versions || []).filter(v => v.type === 'release').slice(0, 80);
  return releases.map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime, installed: isInstalled(v.id, 'vanilla') || isInstalled(v.id, 'fabric') }));
}

export function isInstalled(version, loader = 'vanilla') {
  return fs.existsSync(path.join(getVersionRoot(version, loader), 'versions')) || fs.existsSync(path.join(getVersionRoot(version, loader), 'mods'));
}

export function listInstalled() {
  const versionsRoot = path.join(getRoot(), 'versions');
  if (!fs.existsSync(versionsRoot)) return [];
  return fs.readdirSync(versionsRoot, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name);
}
