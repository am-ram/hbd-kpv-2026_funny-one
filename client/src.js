import './style.css';
const assetBase = import.meta.env.BASE_URL;

document.querySelector('#app').innerHTML = `
<div class="ambient" aria-hidden="true"></div><div id="confetti" aria-hidden="true"></div>
<main><section class="celebration">
<div class="poster-wrap"><button class="poster-button" id="poster" aria-label="Open birthday poster full size"><img src="${assetBase}chap_poster.png" alt="कृष्णप्रिया कुकी वर्मा को जन्मदिन की हार्दिक बधाई एवं ढेर सारी शुभकामनाएं — राम, एकपक्षीय विभाग, मुखिया"></button></div>
<section class="intro"><div class="eyebrow">आज का दिन सिर्फ आपके नाम</div><h1>Happy Birthday, <em>कुकी जी!</em> <span>✧</span></h1><p>थोड़ा filmy. थोड़ा extra. पूरी तरह आपके लिए।</p></section>
<div class="music-bar" role="group" aria-label="Music controls"><audio id="audio" preload="none" src="${assetBase}hbd_bhajan.mp3"></audio><button id="play" aria-label="Play music">▶ Play</button><button id="stop" aria-label="Stop song" disabled>■</button><span id="elapsed">0:00</span><input id="seek" aria-label="Song position" type="range" min="0" max="100" value="0" disabled><span id="duration">0:00</span><button id="party" aria-label="Celebrate with confetti">🎉</button></div>
<p id="music-status" role="status" class="status">A little music, a lot of birthday love.</p>
</section></main>
<dialog id="poster-dialog"><button id="close" aria-label="Close poster">✕</button><img src="${assetBase}chap_poster.png" alt="Full birthday poster"></dialog>
<dialog id="entry-dialog" lang="en" aria-labelledby="entry-title" aria-describedby="entry-description"><div class="entry-content"><span class="entry-spark" aria-hidden="true">✦</span><div class="eyebrow">A LITTLE BIRTHDAY SURPRISE</div><h2 id="entry-title">Better with music.</h2><p id="entry-description">Start the birthday song and come on in.</p><button id="enter-music" class="primary" autofocus>▶ Play music & enter</button><button id="enter-quiet" class="quiet">Enter without music →</button><p id="entry-status" role="status"></p></div></dialog>`;
// Relative API requests work on the combined host and through the Vite dev proxy.
const api = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let sessionId;
try { sessionId = sessionStorage.getItem('birthday-session') || crypto.randomUUID(); sessionStorage.setItem('birthday-session', sessionId); } catch { sessionId = crypto.randomUUID(); }
function track(type, detail = {}, leaving = false) {
  if (api === 'off') return;
  const body = JSON.stringify({ eventId: crypto.randomUUID(), sessionId, type, occurredAt: new Date().toISOString(), path: location.pathname, detail });
  fetch(`${api}/api/poster/events`, {method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive: leaving, credentials:'omit'})
    .then(response => { if (!response.ok) console.warn('Birthday tracking request failed:', response.status); })
    .catch(() => console.warn('Birthday tracking could not reach the API.'));
}
const audio = document.querySelector('#audio'), play = document.querySelector('#play'), stop = document.querySelector('#stop'), seek = document.querySelector('#seek'), status = document.querySelector('#music-status');
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;
let stopping = false;
function sync() { play.textContent = audio.paused ? '▶ Play' : 'Ⅱ Pause'; play.setAttribute('aria-label', audio.paused ? 'Play music' : 'Pause music'); stop.disabled = audio.paused && audio.currentTime === 0; }
play.addEventListener('click', async () => { if (audio.paused) { play.disabled = true; try { await audio.play(); } catch { status.textContent = 'Music is unavailable. Please try again.'; track('song_error', { reason:'unavailable' }); } finally { play.disabled = false; } } else audio.pause(); });
audio.addEventListener('play', () => { stopping = false; sync(); status.textContent = 'Now playing · Birthday bhajan'; track('song_play', {position:audio.currentTime}); });
audio.addEventListener('pause', () => { sync(); if (!stopping && !audio.ended) { status.textContent = 'Paused · Resume whenever you like.'; track('song_pause', {position:audio.currentTime}); } });
stop.addEventListener('click', () => { const position = audio.currentTime; stopping = true; audio.pause(); audio.currentTime = 0; sync(); status.textContent = 'Stopped · Ready when you are.'; track('song_stop', {position}); });
audio.addEventListener('ended', () => { sync(); status.textContent = 'One more time? Hit play.'; track('song_end', {position:audio.currentTime}); });
audio.addEventListener('loadedmetadata', () => { seek.disabled = !Number.isFinite(audio.duration); document.querySelector('#duration').textContent = time(audio.duration || 0); });
audio.addEventListener('timeupdate', () => { document.querySelector('#elapsed').textContent = time(audio.currentTime); seek.value = audio.duration ? audio.currentTime / audio.duration * 100 : 0; });
seek.addEventListener('change', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(seek.value) / 100 * audio.duration; track('song_seek', {position:audio.currentTime}); } });
const dialog = document.querySelector('#poster-dialog');
document.querySelector('#poster').onclick = () => { dialog.showModal(); track('poster_open'); };
document.querySelector('#close').onclick = () => dialog.close();
dialog.addEventListener('close', () => track('poster_close'));
document.querySelector('#party').onclick = () => { track('confetti'); if (matchMedia('(prefers-reduced-motion: reduce)').matches) { status.textContent = '🎉 जन्मदिन मुबारक हो, कुकी जी! 🎉'; return; } const holder = document.querySelector('#confetti'); holder.replaceChildren(); for (let i=0;i<65;i++) { const piece = document.createElement('i'); piece.style.cssText = `left:${Math.random()*100}%;background:${['#ffca39','#f52ca8','#5ddfff','#fff'][i%4]};animation-delay:${Math.random()*.6}s;--drift:${Math.random()*240-120}px`; holder.append(piece); } setTimeout(()=>holder.replaceChildren(),4000); };
track('page_view', {language:navigator.language, viewport:`${innerWidth}x${innerHeight}`});
document.addEventListener('visibilitychange', () => { if (document.hidden) track('page_hidden', {position:audio.currentTime, playing:!audio.paused}, true); });
window.addEventListener('pagehide', () => track('page_exit', {position:audio.currentTime, playing:!audio.paused}, true));

const entry = document.querySelector('#entry-dialog');
const enterMusic = document.querySelector('#enter-music');
function enterSite(reason) {
  entry.close();
  document.body.classList.remove('awaiting-entry');
  document.querySelector('#poster').focus({preventScroll:true});
  track('site_enter', {reason});
}
document.body.classList.add('awaiting-entry');
entry.showModal();
entry.addEventListener('cancel', event => { event.preventDefault(); enterSite('without_music'); });
document.querySelector('#enter-quiet').onclick = () => enterSite('without_music');
enterMusic.onclick = async () => {
  enterMusic.disabled = true;
  document.querySelector('#entry-status').textContent = 'Starting the music…';
  try {
    await audio.play();
    if (entry.open) enterSite('with_music');
  } catch {
    document.querySelector('#entry-status').textContent = 'The music could not start. Try again or enter without music.';
    track('song_error', {reason:'entry_playback_failed'});
  } finally { enterMusic.disabled = false; }
};



