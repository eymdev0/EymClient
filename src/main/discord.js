import { Client } from '@xhayper/discord-rpc';

let rpc = null;
let currentClientId = '';
let connected = false;

export async function connectDiscord(clientId) {
  if (!clientId || !/^\d{10,25}$/.test(clientId)) return { connected: false, reason: 'client-id-missing' };
  if (connected && currentClientId === clientId) return { connected: true };
  await disconnectDiscord();
  currentClientId = clientId;
  rpc = new Client({ clientId });
  rpc.on('ready', () => { connected = true; });
  rpc.on('disconnected', () => { connected = false; });
  try {
    await rpc.login();
    connected = true;
    return { connected: true };
  } catch (error) {
    connected = false;
    try { rpc.destroy(); } catch {}
    rpc = null;
    return { connected: false, reason: error?.message || 'Discord kapalı' };
  }
}

export async function setDiscordActivity({ details, state, version, account, startTimestamp, loader = 'Fabric' }) {
  if (!rpc || !connected) return false;
  try {
    await rpc.user?.setActivity({
      details: details || 'Minecraft',
      state: state || `${account || 'EymClient'} • ${version || ''}`.trim(),
      startTimestamp: startTimestamp || new Date(),
      largeImageKey: 'eymclient',
      largeImageText: 'EymClient',
      smallImageKey: 'minecraft',
      smallImageText: `${version || ''} • ${loader}`
    });
    return true;
  } catch { return false; }
}

export async function clearDiscordActivity() {
  try { await rpc?.user?.clearActivity(); } catch {}
}

export async function disconnectDiscord() {
  connected = false;
  if (rpc) {
    try { await rpc.user?.clearActivity(); } catch {}
    try { rpc.destroy(); } catch {}
  }
  rpc = null;
  currentClientId = '';
}
