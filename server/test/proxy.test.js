import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { proxyTrust } from '../proxy.js';
import { createApp } from '../app.js';

test('proxy configuration trusts Vercel even with an old TRUST_PROXY=0 setting', () => {
  assert.equal(proxyTrust({VERCEL:'1', TRUST_PROXY:'0'}), 1);
  assert.equal(proxyTrust({}), 0);
  assert.equal(proxyTrust({TRUST_PROXY:'2'}), 2);
});

test('Vercel requests persist forwarded IPv4 and IPv6 for both sites', async () => {
  const writes = [];
  const server = createApp({pool:{query:async (...args) => writes.push(args)}, origins:['https://kpv-hbd.vercel.app'], trustProxy:proxyTrust({VERCEL:'1'}), serveSites:false}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const [site, ip] of [['poster','203.0.113.42'], ['gallery','2001:db8::42']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${site}/events`, {
        method:'POST', headers:{origin:'https://kpv-hbd.vercel.app','content-type':'application/json','x-forwarded-for':ip},
        body:JSON.stringify({eventId:randomUUID(),sessionId:randomUUID(),type:'page_view',occurredAt:new Date().toISOString(),path:'/',detail:{}})
      });
      assert.equal(response.status,202);
      assert.equal(writes.at(-1)[1][4],ip);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
