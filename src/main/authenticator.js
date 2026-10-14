import crypto from 'node:crypto';
import { Auth } from 'msmc';
import { getAccountSecret, saveAccount } from './storage.js';

function offlineUuid(username) {
  const hex = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function createOfflineProfile(username) {
  const name = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Kullanıcı adı 3-16 karakter olmalı.');
  const profile = { mode: 'offline', name, uuid: offlineUuid(name), access_token: '0', client_token: crypto.randomUUID(), user_properties: '{}', meta: { type: 'mojang', demo: false } };
  const account = saveAccount({ mode: 'offline', name, uuid: profile.uuid }, null);
  return { ...profile, accountId: account.id };
}

export async function loginMicrosoft() {
  const authManager = new Auth('select_account');
  const xbox = await authManager.launch('raw', { width: 520, height: 760, suppress: true });
  const token = await xbox.getMinecraft();
  if (!token) throw new Error('Microsoft oturumundan Minecraft tokenı alınamadı.');
  const profile = token.mclc();
  const refreshBlob = typeof xbox.save === 'function' ? xbox.save() : null;
  const account = saveAccount({
    mode: 'premium',
    name: profile.name,
    uuid: profile.uuid,
    xuid: token.xuid || null,
    skin: token.profile?.skins?.[0]?.url || null
  }, refreshBlob);
  return { ...profile, mode: 'premium', accountId: account.id };
}

export async function restoreMicrosoftAccount(account) {
  const saved = getAccountSecret(account.id);
  if (!saved) throw new Error('Bu Microsoft hesabının oturum bilgisi bulunamadı.');
  const authManager = new Auth('select_account');
  const xbox = await authManager.refresh(saved);
  const token = await xbox.getMinecraft();
  const profile = token.mclc();
  const refreshBlob = typeof xbox.save === 'function' ? xbox.save() : saved;
  saveAccount({ ...account, name: profile.name, uuid: profile.uuid, updatedAt: Date.now() }, refreshBlob);
  return { ...profile, mode: 'premium', accountId: account.id };
}
