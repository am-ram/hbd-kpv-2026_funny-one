// Vercel overwrites X-Forwarded-For with the connecting client's IP.
// Only enable this platform-specific trust inside a Vercel deployment.
export function proxyTrust(env = process.env) {
  if (env.VERCEL === '1') return 1;
  const value = env.TRUST_PROXY || '0';
  return /^\d+$/.test(value) ? Number(value) : value.split(',').map(x => x.trim());
}
import { isIP } from 'node:net';

export function visitorIp(req, vercel = false) {
  if (vercel) {
    for (const header of ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip']) {
      const value = req.get(header)?.split(',')[0].trim();
      if (value && isIP(value) && !/^127\./.test(value) && value !== '::1' && !value.startsWith('::ffff:127.')) return value;
    }
    // Missing platform metadata is unknown, not the internal loopback address.
    return null;
  }
  return isIP(req.ip) ? req.ip : null;
}
