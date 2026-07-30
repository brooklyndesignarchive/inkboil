import { put } from '@vercel/blob';

// POST /api/track  body: event name (text) — appends one tiny blob per event.
// Counting by listing avoids read-modify-write races entirely.
const EVENTS = new Set(['user', 'view_tool', 'view_wall', 'drawing_loaded',
                        'export_video', 'export_gif', 'send', 'submit']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const e = String(typeof req.body === 'string' ? req.body : req.body?.e || '').trim();
    if (!EVENTS.has(e)) return res.status(400).json({ error: 'bad event' });
    await put(`stats/${e}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`, '1', {
      access: 'public', contentType: 'text/plain', addRandomSuffix: false
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
}
