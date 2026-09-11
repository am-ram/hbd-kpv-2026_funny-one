import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';

test('tracking validates input, enforces CORS, parameterizes events and handles DB failures', async () => {
  const queries = []; let fail = false;
  const pool = {query:async(...args)=>{if(fail) throw new Error('private connection detail'); queries.push(args);}};
  const server = createApp({pool,origins:['https://birthday.example']}).listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const event = {eventId:randomUUID(),sessionId:randomUUID(),type:'song_play',occurredAt:new Date().toISOString(),path:'/',detail:{position:12}};
  const send = (data,origin='https://birthday.example')=>fetch(`${url}/api/events`,{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'1.2.3.4'},body:JSON.stringify(data)});
  try {
    const preflight=await fetch(`${url}/api/events`,{method:'OPTIONS',headers:{origin:'https://birthday.example','access-control-request-method':'POST','access-control-request-headers':'content-type'}});
    assert.equal(preflight.status,204); assert.equal(preflight.headers.get('access-control-allow-origin'),'https://birthday.example');
    assert.equal((await send(event,'https://evil.example')).status,403);
    assert.equal((await send({...event,type:'unknown'})).status,400);
    assert.equal((await send({...event,detail:{position:-1}})).status,400);
    assert.equal((await send(event)).status,202);
    assert.equal(queries.length,1); assert.ok(queries[0][0].includes('ON CONFLICT')); assert.equal(queries[0][1][2],'song_play'); assert.notEqual(queries[0][1][4],'1.2.3.4');
    fail=true; const failure=await send(event); assert.equal(failure.status,503); assert.ok(!(await failure.text()).includes('private'));
    assert.equal((await fetch(`${url}/health`)).status,503);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
