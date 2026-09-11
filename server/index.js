import app, { pool } from './runtime.js';

const server = app.listen(Number(process.env.PORT || 3001),'0.0.0.0',()=>console.log('Birthday API listening'));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { server.close(async()=>{await pool.end();process.exit(0);}); setTimeout(()=>process.exit(1),10000).unref(); });
