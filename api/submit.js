import { put } from '@vercel/blob';
import crypto from 'node:crypto';

// POST /api/submit  { gif: dataURL, name, location } -> stored under doodles/pending/
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { gif, name = '', location = '', handle = '' } = req.body || {};
    if (!gif || typeof gif !== 'string') return res.status(400).json({ error: 'missing gif' });
    const m = gif.match(/^data:image\/gif;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: 'not a gif data url' });
    if (m[1].length > 4_200_000) return res.status(413).json({ error: 'gif too large (3 MB max)' });
    const buf = Buffer.from(m[1], 'base64');
    const sig = buf.subarray(0, 6).toString('latin1');
    if (sig !== 'GIF89a' && sig !== 'GIF87a') return res.status(400).json({ error: 'invalid gif' });

    const id = crypto.randomUUID();
    const clean = s => String(s).slice(0, 60).replace(/[<>&"']/g, '');
    const cleanHandle = s => String(s).replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);
    const { url: gifUrl } = await put(`doodles/pending/${id}.gif`, buf, {
      access: 'public', contentType: 'image/gif', addRandomSuffix: false
    });
    await put(`doodles/pending/${id}.json`, JSON.stringify({
      id, name: clean(name), location: clean(location), handle: cleanHandle(handle), ts: Date.now(), gifUrl
    }), { access: 'public', contentType: 'application/json', addRandomSuffix: false });

    res.status(200).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
}
