// Local dev mock of the Vercel deployment: static files + /api/* backed by
// the filesystem (.mock-blob/). NOT deployed — Vercel uses api/*.js instead.
// Run: node mock-server.mjs   (admin password: "test")
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const STORE = path.join(ROOT, '.mock-blob');
const PW = 'test';
const PORT = Number(process.env.PORT) || 3131;
for (const d of ['pending', 'approved']) fs.mkdirSync(path.join(STORE, d), { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gif': 'image/gif', '.png': 'image/png' };
const listMeta = dir => fs.readdirSync(path.join(STORE, dir)).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(STORE, dir, f), 'utf8')))
  .sort((a, b) => b.ts - a.ts);
const body = req => new Promise(res => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { res(JSON.parse(b)); } catch { res({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, data, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };

  try {
    if (url.pathname === '/api/submit' && req.method === 'POST') {
      const { gif, name = '', location = '', handle = '' } = await body(req);
      const m = (gif || '').match(/^data:image\/gif;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return send(400, { error: 'not a gif data url' });
      const buf = Buffer.from(m[1], 'base64');
      if (!buf.subarray(0, 6).toString('latin1').startsWith('GIF8')) return send(400, { error: 'invalid gif' });
      const id = crypto.randomUUID();
      const clean = s => String(s).slice(0, 60).replace(/[<>&"']/g, '');
      const cleanHandle = s => String(s).replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);
      fs.writeFileSync(path.join(STORE, 'pending', id + '.gif'), buf);
      fs.writeFileSync(path.join(STORE, 'pending', id + '.json'), JSON.stringify({
        id, name: clean(name), location: clean(location), handle: cleanHandle(handle), ts: Date.now(), gifUrl: `/blob/pending/${id}.gif`
      }));
      return send(200, { ok: true, id });
    }
    if (url.pathname === '/api/wall') return send(200, { items: listMeta('approved') });
    if (url.pathname === '/api/admin') {
      if (req.headers['x-admin-password'] !== PW) return send(401, { error: 'unauthorized' });
      if (req.method === 'GET') {
        const scope = url.searchParams.get('scope') === 'approved' ? 'approved' : 'pending';
        return send(200, { scope, items: listMeta(scope) });
      }
      const { id, action } = await body(req);
      if (!/^[0-9a-f-]{36}$/.test(id || '')) return send(400, { error: 'bad id' });
      if (!['approve', 'deny', 'remove'].includes(action)) return send(400, { error: 'bad action' });
      if (action === 'remove') {
        const ag = path.join(STORE, 'approved', id + '.gif'), aj = path.join(STORE, 'approved', id + '.json');
        if (!fs.existsSync(aj)) return send(404, { error: 'not on the wall' });
        for (const f of [ag, aj]) if (fs.existsSync(f)) fs.unlinkSync(f);
        return send(200, { ok: true });
      }
      const pg = path.join(STORE, 'pending', id + '.gif'), pj = path.join(STORE, 'pending', id + '.json');
      if (action === 'approve' && fs.existsSync(pg) && fs.existsSync(pj)) {
        const meta = JSON.parse(fs.readFileSync(pj, 'utf8'));
        meta.gifUrl = `/blob/approved/${id}.gif`;
        fs.copyFileSync(pg, path.join(STORE, 'approved', id + '.gif'));
        fs.writeFileSync(path.join(STORE, 'approved', id + '.json'), JSON.stringify(meta));
      }
      for (const f of [pg, pj]) if (fs.existsSync(f)) fs.unlinkSync(f);
      return send(200, { ok: true });
    }
    if (url.pathname.startsWith('/blob/')) {
      const f = path.join(STORE, url.pathname.slice(6));
      if (!f.startsWith(STORE) || !fs.existsSync(f)) return send(404, { error: 'nope' });
      return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
    }
    // static
    let f = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, { error: 'not found' });
    return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
  } catch (e) {
    return send(500, { error: 'server error' });
  }
}).listen(PORT, () => console.log(`inkboil mock on http://localhost:${PORT} (admin pw: test)`));
