import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';
import { proxyTrust } from './proxy.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in server/.env or your host environment');
const origins = [...new Set(['https://kpv-hbd.vercel.app', ...(process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5186,http://127.0.0.1:5186,http://localhost:3001,http://127.0.0.1:3001').split(',').map(x=>x.trim()).filter(Boolean)])];
for (const origin of origins) { if (new URL(origin).origin !== origin) throw new Error('ALLOWED_ORIGINS must contain exact origins without trailing slashes'); }
const trustProxy = proxyTrust();
export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
pool.on('error', () => console.error('Database connection interrupted'));
try { await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8')); }
catch {
  await pool.end();
  throw new Error('Database initialization failed. Check DATABASE_URL and network access.');
}
export function createRuntimeApp(vercel = process.env.VERCEL === '1') {
  return createApp({pool,origins,trustProxy,serveSites:!vercel,vercel});
}
export default createRuntimeApp();

