import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app, safeStorage } from 'electron';

let root = null;
let accountsFile = null;
let settingsFile = null;

export function initStorage() {
  root = path.join(app.getPath('appData'), '.eymclient');
  accountsFile = path.join(root, 'accounts.json');
  settingsFile = path.join(root, 'settings.json');
  for (const dir of [root, path.join(root, 'versions'), path.join(root, 'cache'), path.join(root, 'logs'), path.join(root, 'backups')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(accountsFile)) writeJson(accountsFile, { activeId: null, accounts: [] });
  if (!fs.existsSync(settingsFile)) writeJson(settingsFile, {
    ram: 4,
    version: '1.20.1',
    loader: 'fabric',
    discordRichPresence: true,
    discordClientId: '',
    optimizeProfile: 'competitive'
  });
  return root;
}

export function getRoot() {
  if (!root) initStorage();
  return root;
}

export function getVersionRoot(version, loader = 'vanilla') {
  const safeVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(getRoot(), 'versions', `${safeVersion}-${loader}`, '.minecraft');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function encrypt(value) {
  if (!value) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) return { kind: 'safeStorage', value: safeStorage.encryptString(value).toString('base64') };
  } catch {}
  const key = crypto.createHash('sha256').update(`${app.getPath('userData')}:eymclient`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { kind: 'aes-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: encrypted.toString('base64') };
}

function decrypt(payload) {
  if (!payload) return null;
  try {
    if (payload.kind === 'safeStorage') return safeStorage.decryptString(Buffer.from(payload.value, 'base64'));
    if (payload.kind === 'aes-gcm') {
      const key = crypto.createHash('sha256').update(`${app.getPath('userData')}:eymclient`).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(payload.value, 'base64')), decipher.final()]).toString('utf8');
    }
  } catch {}
  return null;
}

export function listAccounts() {
  const data = readJson(accountsFile, { activeId: null, accounts: [] });
  return { activeId: data.activeId || null, accounts: data.accounts || [] };
}

export function saveAccount(account, refreshBlob = null) {
  const data = listAccounts();
  const id = account.id || crypto.randomUUID();
  const sanitized = { ...account, id, createdAt: account.createdAt || Date.now(), updatedAt: Date.now() };
  if (refreshBlob) sanitized.refreshToken = encrypt(refreshBlob);
  const existing = data.accounts.findIndex(a => a.id === id);
  if (existing >= 0) data.accounts[existing] = { ...data.accounts[existing], ...sanitized };
  else data.accounts.push(sanitized);
  data.activeId = id;
  writeJson(accountsFile, data);
  return data.accounts.find(a => a.id === id);
}

export function deleteAccount(id) {
  const data = listAccounts();
  data.accounts = data.accounts.filter(a => a.id !== id);
  if (data.activeId === id) data.activeId = data.accounts[0]?.id || null;
  writeJson(accountsFile, data);
  return data;
}

export function setActiveAccount(id) {
  const data = listAccounts();
  if (!data.accounts.some(a => a.id === id)) throw new Error('Hesap bulunamadı.');
  data.activeId = id;
  writeJson(accountsFile, data);
  return data;
}

export function getAccountSecret(id) {
  const account = listAccounts().accounts.find(a => a.id === id);
  return decrypt(account?.refreshToken);
}

export function readSettings() { return readJson(settingsFile, {}); }
export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  writeJson(settingsFile, next);
  return next;
}

export function getPublicAccounts() {
  const data = listAccounts();
  return {
    activeId: data.activeId,
    accounts: data.accounts.map(({ refreshToken, ...account }) => account)
  };
}
