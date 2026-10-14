import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { getVersionRoot } from './storage.js';
import { fileURLToPath } from 'node:url';

const REMOTE = 'https://client.eymdev.com.tr/data/sponsors.json';
const LOCAL = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/sponsors.json');

function clean(value, fallback = '') { return String(value ?? fallback).trim(); }

async function readConfig() {
  let data = null;
  try {
    const response = await fetch(`${REMOTE}?t=${Date.now()}`, { headers: { 'User-Agent': 'EymClient/2.4.0' } });
    if (response.ok) data = await response.json();
  } catch {}
  if (!data) {
    try { data = JSON.parse(fs.readFileSync(LOCAL, 'utf8')); } catch { data = { sponsors: [] }; }
  }
  const list = Array.isArray(data) ? data : data.sponsors;
  return (Array.isArray(list) ? list : []).filter(s => s && s.enabled !== false && clean(s.name) && clean(s.address));
}

async function iconData(icon) {
  if (!icon) return '';
  if (String(icon).startsWith('data:image/')) return icon;
  try {
    const r = await fetch(icon, { headers: { 'User-Agent': 'EymClient/2.4.0' } });
    if (!r.ok) return '';
    const type = r.headers.get('content-type') || 'image/png';
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  } catch { return ''; }
}

// Minimal generic NBT reader/writer. servers.dat is a gzip-compressed root compound.
function readU8(b, s) { return b.readUInt8(s.i++); }
function readI8(b, s) { return b.readInt8(s.i++); }
function readU16(b, s) { const v=b.readUInt16BE(s.i); s.i+=2; return v; }
function readI16(b, s) { const v=b.readInt16BE(s.i); s.i+=2; return v; }
function readI32(b, s) { const v=b.readInt32BE(s.i); s.i+=4; return v; }
function readI64(b, s) { const v=b.readBigInt64BE(s.i); s.i+=8; return v; }
function readF32(b, s) { const v=b.readFloatBE(s.i); s.i+=4; return v; }
function readF64(b, s) { const v=b.readDoubleBE(s.i); s.i+=8; return v; }
function readStr(b, s) { const n=readU16(b,s); const v=b.subarray(s.i,s.i+n).toString('utf8'); s.i+=n; return v; }
function tagValue(type,b,s) {
  if(type===1)return readI8(b,s); if(type===2)return readStr(b,s); if(type===3)return readI32(b,s); if(type===4)return readI64(b,s);
  if(type===5)return readF32(b,s); if(type===6)return readF64(b,s);
  if(type===7){const n=readI32(b,s);const v=Buffer.from(b.subarray(s.i,s.i+n));s.i+=n;return v;}
  if(type===8)return readStr(b,s);
  if(type===9){const child=readU8(b,s), n=readI32(b,s), a=[];for(let i=0;i<n;i++)a.push(tagValue(child,b,s));return {kind:'list',type:child,value:a};}
  if(type===10){const value={};while(true){const t=readU8(b,s);if(t===0)break;const name=readStr(b,s);value[name]={type:t,value:tagValue(t,b,s)};}return {kind:'compound',value};}
  if(type===11){const n=readI32(b,s);const a=[];for(let i=0;i<n;i++)a.push(readI32(b,s));return a;}
  if(type===12){const n=readI32(b,s);const a=[];for(let i=0;i<n;i++)a.push(readI64(b,s));return a;}
  throw new Error(`NBT type ${type} unsupported`);
}
function parseNbt(buf){const b=zlib.gunzipSync(buf),s={i:0};const type=readU8(b,s);if(type!==10)throw new Error('servers.dat root compound bekleniyor');readStr(b,s);return tagValue(10,b,s).value;}
function writeU8(a,v){a.push(Buffer.from([v]));} function writeU16(a,v){const b=Buffer.alloc(2);b.writeUInt16BE(v);a.push(b);} function writeI32(a,v){const b=Buffer.alloc(4);b.writeInt32BE(v);a.push(b);} function writeI64(a,v){const b=Buffer.alloc(8);b.writeBigInt64BE(BigInt(v));a.push(b);} function writeStr(a,v){const b=Buffer.from(String(v),'utf8');writeU16(a,b.length);a.push(b);}
function emitTag(a,type,name,value){writeU8(a,type);writeStr(a,name);emitValue(a,type,value);}
function emitValue(a,type,v){if(type===1){writeU8(a,Number(v)&255);return;}if(type===2||type===8){writeStr(a,v);return;}if(type===3){writeI32(a,v);return;}if(type===4){writeI64(a,v);return;}if(type===5){const b=Buffer.alloc(4);b.writeFloatBE(v);a.push(b);return;}if(type===6){const b=Buffer.alloc(8);b.writeDoubleBE(v);a.push(b);return;}if(type===7){writeI32(a,v.length);a.push(v);return;}if(type===9){writeU8(a,v.type);writeI32(a,v.value.length);for(const x of v.value)emitValue(a,v.type,x);return;}if(type===10){for(const [n,t] of Object.entries(v))emitTag(a,t.type,n,t.value);writeU8(a,0);return;}if(type===11||type===12){writeI32(a,v.length);for(const x of v)(type===11?writeI32:writeI64)(a,x);return;}throw new Error(`NBT type ${type} unsupported`);}
function encodeNbt(root){const a=[];writeU8(a,10);writeStr(a,'');emitValue(a,10,root);return zlib.gzipSync(Buffer.concat(a));}

function makeServer(name,address,icon='') { const c={}; c.name={type:8,value:name}; c.ip={type:8,value:address}; c.acceptTextures={type:1,value:1}; if(icon)c.icon={type:8,value:icon}; return {type:10,value:c}; }

export async function getSponsors() {
  const list=await readConfig();
  return Promise.all(list.map(async s=>({...s,name:clean(s.name),address:clean(s.address),description:clean(s.description),icon:await iconData(s.icon)})));
}

export async function ensureSponsorServers(version, loader='fabric') {
  const sponsors=await getSponsors();
  if (!sponsors.length) return { count:0, sponsors:[] };
  const mcRoot=getVersionRoot(version,loader); fs.mkdirSync(mcRoot,{recursive:true});
  const file=path.join(mcRoot,'servers.dat'); let root;
  try { root=fs.existsSync(file)?parseNbt(fs.readFileSync(file)):{ServerList:{type:9,value:{kind:'list',type:10,value:[]}}}; }
  catch { root={ServerList:{type:9,value:{kind:'list',type:10,value:[]}}}; }
  const listTag=root.ServerList?.value;
  if(!listTag || listTag.kind!=='list') root.ServerList={type:9,value:{kind:'list',type:10,value:[]}};
  const entries=root.ServerList.value.value;
  const sponsorAddresses=new Set(sponsors.map(s=>s.address.toLowerCase()));
  const normal=entries.filter(e=>!sponsorAddresses.has(String(e.value?.ip?.value||'').toLowerCase()) && !e.value?.eymSponsor?.value);
  const pinned=sponsors.map(s=>{const entry=makeServer(s.name,s.address,s.icon);entry.value.eymSponsor={type:1,value:1};entry.value.eymSponsorId={type:8,value:clean(s.id,s.address)};return entry;});
  root.ServerList.value.value=[...pinned,...normal];
  fs.writeFileSync(file,encodeNbt(root));
  return {count:pinned.length,sponsors:sponsors.map(({icon,...x})=>x)};
}

