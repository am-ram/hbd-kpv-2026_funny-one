// Vercel overwrites X-Forwarded-For with the connecting client's IP.
// Only enable this platform-specific trust inside a Vercel deployment.
export function proxyTrust(env = process.env) {
  if (env.VERCEL === '1') return 1;
  const value = env.TRUST_PROXY || '0';
  return /^\d+$/.test(value) ? Number(value) : value.split(',').map(x => x.trim());
}
