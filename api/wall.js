import { list } from '@vercel/blob';

// GET /api/wall -> { items: [{id,name,location,ts,gifUrl}, ...] } newest first
export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: 'doodles/approved/', limit: 1000 });
    const metas = blobs.filter(b => b.pathname.endsWith('.json'));
    const items = (await Promise.all(metas.map(async b => {
      try { return await (await fetch(b.url)).json(); } catch { return null; }
    }))).filter(Boolean).sort((a, b) => b.ts - a.ts);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
}
