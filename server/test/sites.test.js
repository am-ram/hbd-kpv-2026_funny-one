import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../app.js';
test('routes isolate tables, reject cross-site data and serve both built sites',async()=>{
 const queries=[]; const server=createApp({pool:{query:async(...a)=>queries.push(a)},origins:['https://birthday.example']}).listen(0);
 await new Promise(r=>server.once('listening',r)); const base=`http://127.0.0.1:${server.address().port}`;
 const event={eventId:randomUUID(),sessionId:randomUUID(),occurredAt:new Date().toISOString(),path:'/gallery/',type:'wish_read',detail:{wish:3,seconds:12.5}};
 const send=(path,value=event)=>fetch(base+path,{method:'POST',headers:{origin:'https://birthday.example','content-type':'application/json'},body:JSON.stringify(value)});
 try {
  assert.equal((await send('/api/gallery/events')).status,202); assert.match(queries[0][0],/^INSERT INTO gallery_events /);
  assert.equal((await send('/api/poster/events')).status,400);
  for(const detail of [{wish:9,seconds:1},{wish:2,seconds:-1},{wish:2,seconds:2,email:'private'},{wish:2}]) assert.equal((await send('/api/gallery/events',{...event,detail})).status,400);
  assert.equal((await send('/api/gallery/events',{...event,path:'/gallery/?token=secret'})).status,400);
  assert.equal((await send('/api/gallery/events',{...event,type:'song_play',detail:{position:0}})).status,400);
  assert.equal((await send('/api/gallery/events',{...event,type:'gallery_complete',detail:{wish:4}})).status,400);
  for(const route of ['/api/events','/api/poster/events']) { assert.equal((await send(route,{...event,type:'song_play',detail:{position:0}})).status,202); assert.match(queries.at(-1)[0],/^INSERT INTO birthday_events /); }
  assert.equal((await send('/api/arbitrary/events')).status,404); assert.equal(queries.length,3);
  for(const path of ['/poster/','/gallery/']) {
   const res=await fetch(base+path); assert.equal(res.status,200); const html=await res.text();
   const asset=html.match(/(?:src|href)="(\/(?:poster|gallery)\/assets\/[^\"]+)"/); assert.ok(asset); assert.equal((await fetch(base+asset[1])).status,200);
  }
 } finally {await new Promise(r=>server.close(r));}
});
