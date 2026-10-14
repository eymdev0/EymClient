import { app } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
let mainWindow = null;
let autoInstalling = false;
function send(type, payload = {}) { if (!mainWindow || mainWindow.isDestroyed()) return; mainWindow.webContents.send('updater:event', { type, ...payload }); }
export function setupUpdater(window) {
  mainWindow = window;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-not-available', info => send('not-available', { version: info?.version }));
  autoUpdater.on('update-available', info => send('available', { version: info.version }));
  autoUpdater.on('download-progress', p => send('progress', { percent: p.percent, bytesPerSecond: p.bytesPerSecond }));
  autoUpdater.on('update-downloaded', info => {
    send('downloaded', { version: info.version });
    if (!autoInstalling) {
      autoInstalling = true;
      setTimeout(() => { try { autoUpdater.quitAndInstall(true, true); } catch (error) { autoInstalling = false; send('error', { message: error.message }); } }, 900);
    }
  });
  autoUpdater.on('error', error => send('error', { message: error?.message || String(error) }));
  setTimeout(checkForUpdates, 3000);
}
export async function checkForUpdates() {
  if (!app.isPackaged) return { skipped: true, reason: 'development' };
  try { return await autoUpdater.checkForUpdates(); } catch (error) { send('error', { message: error.message }); return null; }
}
export function installUpdate() { if (app.isPackaged) autoUpdater.quitAndInstall(true, true); }
