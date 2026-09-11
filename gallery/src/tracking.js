// Anonymous tab sessions, no query strings, cookies, or fingerprinting.
export function createGalleryTracker({ send, now = () => performance.now(), visible = () => !document.hidden }) {
  let wish = null;
  let started = null;
  let completed = false;
  let announced = null;
  function flush(leaving = false) {
    if (wish === null || started === null) return;
    const seconds = Math.min(86400, Math.max(0, Math.round((now() - started) / 10) / 100));
    started = null;
    if (seconds > 0) send('wish_read', {wish, seconds}, leaving);
  }
  return {
    view(next) {
      if (next === wish) return;
      flush();
      wish = next;
      if (visible()) { started = now(); send('wish_view', {wish}); announced = wish; }
    },
    ready(loadMs) { send('gallery_ready', {loadMs:Math.min(86400000, Math.round(loadMs))}); },
    complete() { if (!completed && wish === 8 && visible()) { completed = true; send('gallery_complete', {wish}); } },
    replay() { flush(); send('gallery_replay', {wish: wish || 8}); completed = false; },
    hide() { flush(true); send('page_hidden', wish === null ? {} : {wish}, true); },
    show() { if (wish !== null && started === null) { started = now(); if (announced !== wish) { send('wish_view', {wish}); announced = wish; } } },
    exit() { flush(true); send('page_exit', wish === null ? {} : {wish}, true); },
    error(index) { send('image_error', {wish:index}); }
  };
}

export function createSender({ api = '', storage, fetchEvent, uuid, pathname, timestamp = () => new Date().toISOString() }) {
  let sessionId;
  try {
    sessionId = storage.getItem('gallery-session') || uuid();
    storage.setItem('gallery-session', sessionId);
  } catch { sessionId = uuid(); }
  return (type, detail = {}, leaving = false) => {
    if (api === 'off') return;
    try {
      const body = JSON.stringify({eventId:uuid(), sessionId, type, occurredAt:timestamp(), path:pathname(), detail});
      Promise.resolve(fetchEvent(`${api.replace(/\/$/, '')}/api/gallery/events`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', keepalive:leaving, body
      })).catch(() => {});
    } catch { /* Analytics must never interrupt the birthday experience. */ }
  };
}
