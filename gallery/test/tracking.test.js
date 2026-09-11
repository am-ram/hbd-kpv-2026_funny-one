import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGalleryTracker,createSender} from '../src/tracking.js';
test('reading time excludes hidden time and completion is once per run',()=>{
 const events=[]; let time=0; let visible=true;
 const tracker=createGalleryTracker({send:(...e)=>events.push(e),now:()=>time,visible:()=>visible});
 tracker.view(1); time=3000; visible=false; tracker.hide(); time=13000; tracker.exit(); visible=true; tracker.show(); time=15000; tracker.view(8);
 tracker.complete(); tracker.complete(); tracker.replay(); tracker.view(1); tracker.view(8); tracker.complete();
 assert.deepEqual(events.filter(e=>e[0]==='wish_read').map(e=>e[1]),[{wish:1,seconds:3},{wish:1,seconds:2}]);
 assert.equal(events.filter(e=>e[0]==='gallery_complete').length,2);
});
test('sender omits credentials and tolerates unavailable storage and network',async()=>{
 const requests=[]; let id=0;
 const send=createSender({storage:{getItem(){throw Error('denied');}},uuid:()=>`uuid-${++id}`,pathname:()=>'/gallery/',fetchEvent:(...args)=>{requests.push(args);return Promise.reject(Error('offline'));}});
 assert.doesNotThrow(()=>send('page_exit',{},true)); await new Promise(r=>setImmediate(r));
 assert.equal(requests[0][0],'/api/gallery/events'); assert.equal(requests[0][1].keepalive,true); assert.equal(requests[0][1].credentials,'omit');
});
