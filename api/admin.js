import { list, del, copy, put } from '@vercel/blob';

const authed = req =>
  !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

// GET  /api/admin[?scope=approved] -> { scope, items }   (default scope: pending)
// POST /api/admin {id, action: 'approve'|'deny'|'remove'}
//   remove takes an already-approved doodle back off the wall, for good.
export default async function handler(req, res) {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const scope = req.query?.scope === 'approved' ? 'approved' : 'pending';
      const { blobs } = await list({ prefix: `doodles/${scope}/`, limit: 1000 });
      const metas = blobs.filter(b => b.pathname.endsWith('.json'));
      const items = (await Promise.all(metas.map(async b => {
        try { return await (await fetch(b.url)).json(); } catch { return null; }
      }))).filter(Boolean).sort((a, b) => b.ts - a.ts);
      return res.status(200).json({ scope, items });
    }
    if (req.method === 'POST') {
      const { id, action } = req.body || {};
      if (!/^[0-9a-f-]{36}$/.test(id || '')) return res.status(400).json({ error: 'bad id' });
      if (!['approve', 'deny', 'remove'].includes(action)) return res.status(400).json({ error: 'bad action' });

      if (action === 'remove') {
        const { blobs } = await list({ prefix: `doodles/approved/${id}` });
        if (!blobs.length) return res.status(404).json({ error: 'not on the wall' });
        await Promise.all(blobs.map(b => del(b.url)));
        return res.status(200).json({ ok: true });
      }

      const { blobs } = await list({ prefix: `doodles/pending/${id}` });
      const gif = blobs.find(b => b.pathname.endsWith('.gif'));
      const json = blobs.find(b => b.pathname.endsWith('.json'));

      if (action === 'approve' && gif && json) {
        const { url: newGif } = await copy(gif.url, `doodles/approved/${id}.gif`, { access: 'public' });
        const meta = await (await fetch(json.url)).json();
        meta.gifUrl = newGif;
        await put(`doodles/approved/${id}.json`, JSON.stringify(meta), {
          access: 'public', contentType: 'application/json', addRandomSuffix: false
        });
      }
      await Promise.all(blobs.map(b => del(b.url)));
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
}
