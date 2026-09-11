import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createApp} from './app.js';
const c = new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
let server;
try {
 await c.connect();
 await c.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 await c.query('BEGIN');
 server=createApp({pool:c,origins:['http://localhost']}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 for(const table of ['birthday_events','gallery_events']) {
  const id=randomUUID(); const type=table==='gallery_events'?'wish_view':'song_play';
  const site=table==='gallery_events'?'gallery':'poster';
  const event={eventId:id,sessionId:randomUUID(),type,occurredAt:new Date().toISOString(),path:`/${site}/`,detail:site==='gallery'?{wish:1}:{position:0}};
  for(let i=0;i<2;i++) {
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/${site}/events`,{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(event)});
   if(response.status!==202) throw Error('API verification failed');
  }
  const r=await c.query(`SELECT count(*)::int AS count, bool_and(received_at_ist IS NOT NULL) AS ist_valid FROM ${table}_ist WHERE event_id=$1`,[id]);
  if(r.rows[0].count!==1 || !r.rows[0].ist_valid) throw Error('Verification failed');
  const other=table==='gallery_events'?'birthday_events':'gallery_events';
  if((await c.query(`SELECT 1 FROM ${other} WHERE event_id=$1`,[id])).rowCount) throw Error('Table isolation failed');
  console.log(`${table}: API insert, table isolation, deduplication and IST view verified`);
 }
 await c.query('ROLLBACK'); console.log('Verification rows rolled back; both tables are ready.');
} catch { console.error('Database check failed. Check DATABASE_URL and network access.'); process.exitCode=1; }
finally {if(server) await new Promise(r=>server.close(r)); await c.end();}
