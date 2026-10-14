import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from 'minecraft-launcher-core';
import { fabric } from 'tomate-loaders';
import { getVersionRoot } from './storage.js';
import { setDiscordActivity, clearDiscordActivity } from './discord.js';

const launcher = new Client();
let currentChild = null;
let currentStart = null;
function emit(send, type, payload = {}) { try { send?.({ type, ...payload }); } catch {} }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function is26x(version) { return /^26\./.test(String(version)); }
function detectJavaMajor() {
  const command = process.platform === 'win32' ? 'java.exe' : 'java';
  const result = spawnSync(command, ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = text.match(/version\s+"(\d+)/i);
  return match ? Number(match[1]) : null;
}
async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
    ]);
  } finally { clearTimeout(timer); }
}

export function isGameRunning() { return Boolean(currentChild && !currentChild.killed); }
export function getCurrentStart() { return currentStart; }

export async function launchMinecraft({ auth, minecraftVersion = '1.20.1', loader = 'fabric', memory = 4096, send, discord }) {
  if (!auth?.name || !auth?.uuid) throw new Error('Önce bir hesap seçmelisin.');
  if (isGameRunning()) throw new Error('Minecraft zaten çalışıyor.');

  const javaMajor = detectJavaMajor();
  if (is26x(minecraftVersion) && javaMajor !== 25) {
    throw new Error(`Minecraft ${minecraftVersion} için Java 25 gerekiyor. Algılanan Java: ${javaMajor ?? 'bulunamadı'}.`);
  }
  if (!javaMajor) throw new Error('Java bulunamadı. Java 25 (Minecraft 26.x) veya uygun bir Java sürümü kurmalısın.');

  const root = getVersionRoot(minecraftVersion, loader);
  const maxMemory = Math.max(2048, Math.min(Number(memory) || 4096, Math.floor(os.totalmem() / 1024 / 1024 * 0.8)));
  const minMemory = Math.min(2048, maxMemory);
  emit(send, 'status', { message: `${minecraftVersion} ${loader} hazırlanıyor...` });
  emit(send, 'log', { message: `Java ${javaMajor} bulundu. Profil: ${root}` });

  // Bind MCLC listeners before Fabric metadata resolution so early download events are not lost.
  launcher.removeAllListeners();
  launcher.on('debug', message => emit(send, 'log', { message: String(message) }));
  launcher.on('data', data => emit(send, 'game-log', { message: String(data) }));
  launcher.on('download', data => emit(send, 'download', { data }));
  launcher.on('download-status', data => emit(send, 'download', { data }));
  launcher.on('progress', data => emit(send, 'progress', { data }));

  let launchConfig;
  if (loader === 'fabric') {
    emit(send, 'status', { message: 'Fabric profili hazırlanıyor...' });
    launchConfig = await withTimeout(
      fabric.getMCLCLaunchConfig({ gameVersion: minecraftVersion, rootPath: root }),
      45000,
      'Fabric profili 45 saniye içinde hazırlanamadı. İnternet bağlantısını ve sürüm uyumluluğunu kontrol et.'
    );
  } else {
    launchConfig = { root, version: { number: minecraftVersion, type: 'release' } };
  }

  const options = {
    ...launchConfig,
    root,
    authorization: auth,
    memory: { max: `${maxMemory}M`, min: `${minMemory}M` },
    javaPath: process.platform === 'win32' ? 'javaw.exe' : 'java',
    customArgs: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC', '-XX:+UseStringDeduplication']
  };

  emit(send, 'status', { message: 'Minecraft dosyaları indiriliyor / doğrulanıyor...' });
  currentChild = await launcher.launch(options);
  currentStart = Date.now();
  emit(send, 'status', { message: 'Minecraft başlatıldı.' });
  emit(send, 'game-start', { pid: currentChild.pid });

  if (discord?.enabled) {
    await setDiscordActivity({ details: 'Minecraft oynuyor', state: `${auth.name} • ${minecraftVersion}`, version: minecraftVersion, account: auth.name, startTimestamp: new Date(currentStart), loader: loader === 'fabric' ? 'Fabric' : 'Vanilla' });
  }
  currentChild.on('close', async code => {
    emit(send, 'game-exit', { code });
    await clearDiscordActivity();
    currentChild = null;
    currentStart = null;
  });
  currentChild.on('error', async error => {
    emit(send, 'error', { message: error.message });
    await clearDiscordActivity();
    currentChild = null;
    currentStart = null;
  });
  return { pid: currentChild.pid, root, memory: maxMemory, version: minecraftVersion, loader };
}
