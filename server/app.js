import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';

const types = new Set(['page_view','site_enter','page_hidden','page_exit','song_play','song_pause','song_stop','song_end','song_seek','song_error','poster_open','poster_close','confetti']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const galleryTypes = new Set(['page_view','gallery_ready','wish_view','wish_read','gallery_complete','gallery_replay','image_error','page_hidden','page_exit']);
const inserts = Object.freeze({
  poster: 'INSERT INTO birthday_events (event_id,session_id,event_type,occurred_at,ip_address,user_agent,origin,path,detail) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (event_id) DO NOTHING',
  gallery: 'INSERT INTO gallery_events (event_id,session_id,event_type,occurred_at,ip_address,user_agent,origin,path,detail) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (event_id) DO NOTHING'
});
export function validateEvent(value, site = 'poster') {
  const eventTypes = site === 'gallery' ? galleryTypes : types;
  if (!value || !uuid.test(value.eventId) || !uuid.test(value.sessionId) || !eventTypes.has(value.type)) return false;
  if (typeof value.occurredAt !== 'string' || !Number.isFinite(Date.parse(value.occurredAt))) return false;
  if (Math.abs(Date.now() - Date.parse(value.occurredAt)) > 86400000) return false;
  if (typeof value.path !== 'string' || !value.path.startsWith('/') || value.path.length > 256 || /[?#\r\n]/.test(value.path)) return false;
  if (!value.detail || typeof value.detail !== 'object' || Array.isArray(value.detail)) return false;
  if (site === 'gallery') {
    const validators = {
      wish: v => Number.isInteger(v) && v >= 1 && v <= 8,
      seconds: v => Number.isFinite(v) && v >= 0 && v <= 86400,
      loadMs: v => Number.isFinite(v) && v >= 0 && v <= 86400000,
      language: v => typeof v === 'string' && v.length <= 100,
      viewport: v => typeof v === 'string' && /^\d{1,5}x\d{1,5}$/.test(v)
    };
    const fields = {
      page_view: ['language','viewport'], gallery_ready: ['loadMs'], wish_view: ['wish'],
      wish_read: ['wish','seconds'], gallery_complete: ['wish'], gallery_replay: ['wish'],
      image_error: ['wish'], page_hidden: ['wish'], page_exit: ['wish']
    };
    if (!Object.entries(value.detail).every(([key,v]) => fields[value.type].includes(key) && validators[key](v))) return false;
    if (['wish_view','wish_read','gallery_complete','gallery_replay','image_error'].includes(value.type) && !validators.wish(value.detail.wish)) return false;
    if (value.type === 'wish_read' && !validators.seconds(value.detail.seconds)) return false;
    return value.type !== 'gallery_complete' || value.detail.wish === 8;
  }
  const allowed = new Set(['position','playing','language','viewport','reason']);
  return Object.entries(value.detail).every(([key,v]) => allowed.has(key) && (key === 'position' ? Number.isFinite(v) && v >= 0 && v <= 86400 : key === 'playing' ? typeof v === 'boolean' : typeof v === 'string' && v.length <= 100));
}
export function createApp({ pool, origins, trustProxy = false, staticDirs = {}, serveSites = true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet({contentSecurityPolicy:{directives:{
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'upgrade-insecure-requests': null
  }}}));
  app.get('/health', async (_req,res) => { try { await pool.query('SELECT 1'); res.json({status:'ok'}); } catch { res.status(503).json({status:'unavailable'}); } });
  app.use('/api', (req,res,next) => { if (!origins.includes(req.get('origin'))) return res.status(403).json({error:'Origin not allowed'}); next(); });
  app.use('/api', cors({origin:origins, methods:['POST','OPTIONS'], allowedHeaders:['Content-Type'], maxAge:86400}));
  app.use('/api', rateLimit({windowMs:60_000, limit:120, standardHeaders:'draft-8', legacyHeaders:false}));
  app.use(express.json({limit:'8kb'}));
  const record = site => async (req,res) => {
    if (!validateEvent(req.body, site)) return res.status(400).json({error:'Invalid event'});
    const e = req.body;
    try {
      await pool.query(inserts[site], [e.eventId,e.sessionId,e.type,e.occurredAt,req.ip,(req.get('user-agent') || '').slice(0,512),req.get('origin').slice(0,256),e.path,e.detail]);
      res.status(202).json({accepted:true});
    } catch { console.error('Event persistence failed'); res.status(503).json({error:'Tracking temporarily unavailable'}); }
  };
  // Fixed routes select fixed SQL; callers never supply table identifiers.
  app.post('/api/events', record('poster'));
  app.post('/api/poster/events', record('poster'));
  app.post('/api/gallery/events', record('gallery'));
  if (serveSites) {
    app.get('/', (_req,res) => res.redirect('/poster/'));
    app.use('/poster', express.static(staticDirs.poster || fileURLToPath(new URL('../client/dist', import.meta.url))));
    app.use('/gallery', express.static(staticDirs.gallery || fileURLToPath(new URL('../gallery/dist', import.meta.url))));
  } else {
    app.get('/', (_req,res) => res.json({service:'Birthday tracking API',health:'/health'}));
  }
  app.use((err,req,res,next) => { res.status(err.status === 413 ? 413 : 400).json({error:'Invalid request'}); });
  return app;
}

