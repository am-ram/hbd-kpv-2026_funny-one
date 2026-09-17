import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { proxyTrust, visitorIp } from '../proxy.js';
import { createApp } from '../app.js';

test('proxy configuration trusts Vercel even with an old TRUST_PROXY=0 setting', () => {
  assert.equal(proxyTrust({VERCEL:'1', TRUST_PROXY:'0'}), 1);
  assert.equal(proxyTrust({}), 0);
  assert.equal(proxyTrust({TRUST_PROXY:'2'}), 2);
});

test('Vercel requests persist forwarded IPv4 and IPv6 for both sites', async () => {
  const writes = [];
  const server = createApp({pool:{query:async (...args) => writes.push(args)}, origins:['https://kpv-hbd.vercel.app'], trustProxy:false, vercel:true, serveSites:false}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const [site, ip] of [['poster','203.0.113.42'], ['gallery','2001:db8::42']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${site}/events`, {
        method:'POST', headers:{origin:'https://kpv-hbd.vercel.app','content-type':'application/json','x-vercel-forwarded-for':ip,'x-forwarded-for':'127.0.0.1'},
        body:JSON.stringify({eventId:randomUUID(),sessionId:randomUUID(),type:'page_view',occurredAt:new Date().toISOString(),path:'/',detail:{}})
      });
      assert.equal(response.status,202);
      assert.equal(writes.at(-1)[1][4],ip);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('platform headers are ignored locally and malformed or loopback values are not saved on Vercel', () => {
  const req = headers => ({ip:'127.0.0.1',get:key=>headers[key]});
  assert.equal(visitorIp(req({'x-vercel-forwarded-for':'203.0.113.7'})), '127.0.0.1');
  assert.equal(visitorIp(req({'x-vercel-forwarded-for':'invalid','x-forwarded-for':'2001:db8::5, 127.0.0.1'}),true), '2001:db8::5');
  assert.equal(visitorIp(req({'x-forwarded-for':'127.0.0.1'}),true),null);
  assert.equal(visitorIp(req({}),true),null);
});

test('2025 extraction uses the first forwarded IP and removes the IPv4-mapped prefix', () => {
  const req = {ip:'127.0.0.1',get:key=>({'x-forwarded-for':' ::ffff:203.0.113.24, 127.0.0.1','x-vercel-forwarded-for':'198.51.100.9'})[key]};
  assert.equal(visitorIp(req,true),'203.0.113.24');
});
