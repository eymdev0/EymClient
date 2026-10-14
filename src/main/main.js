import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createOfflineProfile, loginMicrosoft, restoreMicrosoftAccount } from './authenticator.js';
import { getPublicAccounts, listAccounts, deleteAccount, setActiveAccount, readSettings, writeSettings, initStorage } from './storage.js';
import { launchMinecraft, isGameRunning } from './launcher.js';
import { fetchVersions, listInstalled } from './versions.js';
import { installOptimizationProfile, installQuickMod, getQuickMods, getInstalledMods, copyOptifine, searchModrinth, getModrinthVersions, installModrinthVersionById } from './mods.js';
import { getSponsors, ensureSponsorServers } from './sponsors.js';
import { connectDiscord, disconnectDiscord, setDiscordActivity, clearDiscordActivity } from './discord.js';
import { setupUpdater, checkForUpdates, installUpdate } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let currentAuth = null;

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1380, height: 860, minWidth: 1120, minHeight: 700, frame: false, backgroundColor: '#08090c', show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  setupUpdater(mainWindow);
}

function activeAccountRecord() {
  const data = listAccounts();
  return data.accounts.find(a => a.id === data.activeId) || null;
}

app.whenReady().then(() => {
  initStorage();
  createWindow();

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); return mainWindow?.isMaximized() ?? false; });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url));
  ipcMain.handle('app:get-info', () => ({ version: app.getVersion(), platform: process.platform, appData: path.join(app.getPath('appData'), '.eymclient') }));
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_, patch) => writeSettings(patch));
  ipcMain.handle('accounts:list', () => getPublicAccounts());
  ipcMain.handle('accounts:select', (_, id) => setActiveAccount(id));
  ipcMain.handle('accounts:delete', (_, id) => deleteAccount(id));

  ipcMain.handle('auth:offline', (_, username) => { currentAuth = createOfflineProfile(username); return currentAuth; });
  ipcMain.handle('auth:microsoft', async () => { currentAuth = await loginMicrosoft(); return currentAuth; });
  ipcMain.handle('auth:select', async (_, id) => {
    const account = listAccounts().accounts.find(a => a.id === id);
    if (!account) throw new Error('Hesap bulunamadı.');
    setActiveAccount(id);
    if (account.mode === 'offline') currentAuth = createOfflineProfile(account.name);
    else currentAuth = await restoreMicrosoftAccount(account);
    return currentAuth;
  });
  ipcMain.handle('auth:get-current', () => currentAuth);
  ipcMain.handle('auth:restore-active', async () => {
    const account = activeAccountRecord();
    if (!account) return null;
    try {
      if (account.mode === 'offline') currentAuth = createOfflineProfile(account.name);
      else currentAuth = await restoreMicrosoftAccount(account);
      return currentAuth;
    } catch (error) {
      return { error: error.message, accountId: account.id, name: account.name };
    }
  });

  ipcMain.handle('versions:list', async () => {
    try { return { versions: await fetchVersions(), installed: listInstalled() }; }
    catch (error) { return { versions: [], installed: listInstalled(), error: error.message }; }
  });
  ipcMain.handle('mods:list', (_, { version, loader }) => getInstalledMods(version, loader));
  ipcMain.handle('mods:quick-list', () => getQuickMods());
  ipcMain.handle('mods:quick-install', async (_, opts) => installQuickMod({ ...opts, send: message => mainWindow?.webContents.send('launcher:event', message) }));
  ipcMain.handle('mods:optimize', async (_, opts) => installOptimizationProfile({ ...opts, send: message => mainWindow?.webContents.send('launcher:event', message) }));
  ipcMain.handle('mods:search', async (_, opts) => searchModrinth(opts));
  ipcMain.handle('mods:versions', async (_, opts) => getModrinthVersions(opts.projectId, opts.version, opts.loader));
  ipcMain.handle('mods:install-version', async (_, opts) => installModrinthVersionById({ ...opts, send: message => mainWindow?.webContents.send('launcher:event', message) }));
  ipcMain.handle('sponsors:list', async () => getSponsors());
  ipcMain.handle('sponsors:sync', async (_, { version, loader }) => ensureSponsorServers(version, loader));

  ipcMain.handle('mods:optifine', async (_, { version, loader }) => {
    const picked = await dialog.showOpenDialog(mainWindow, { title: 'OptiFine .jar seç', filters: [{ name: 'Java Archive', extensions: ['jar'] }], properties: ['openFile'] });
    if (picked.canceled || !picked.filePaths[0]) return null;
    return copyOptifine(version, loader, picked.filePaths[0]);
  });

  ipcMain.handle('discord:connect', async (_, clientId) => connectDiscord(clientId));
  ipcMain.handle('discord:activity', async (_, payload) => setDiscordActivity(payload));
  ipcMain.handle('discord:clear', async () => clearDiscordActivity());
  ipcMain.handle('discord:disconnect', async () => disconnectDiscord());

  ipcMain.handle('minecraft:running', () => isGameRunning());
  ipcMain.handle('minecraft:launch', async (_, options) => {
    if (!currentAuth) throw new Error('Önce hesap seçmelisin.');
    await ensureSponsorServers(options.version || options.minecraftVersion, options.loader);
    return launchMinecraft({ ...options, auth: currentAuth, send: message => mainWindow?.webContents.send('launcher:event', message), discord: options.discord });
  });
  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:install', () => installUpdate());

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { disconnectDiscord().catch(() => {}); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
