# Ink Boil

Hand-drawn line animation tool: scan → boil → GIF / MP4, with a community
Doodle Wall.

- `index.html` — the tool. Works standalone (double-click) or served.
- `wall.html` — public wall of approved doodles.
- `admin.html` — approve/deny dashboard (password-protected).
- `api/` — Vercel serverless functions (submit / wall / admin), storage in Vercel Blob.
- `mock-server.mjs` — local dev stand-in for the whole deployment: `node mock-server.mjs`
  → http://localhost:3131 (admin password `test`, storage in `.mock-blob/`).

## Deploying

Source of truth is [github.com/brooklyndesignarchive/inkboil](https://github.com/brooklyndesignarchive/inkboil),
connected to the Vercel project `inkboil`:

- push to `main` → production at [inkboil.vercel.app](https://inkboil.vercel.app)
- push any other branch → preview deployment

The tool is `/`, the wall is `/wall.html`, moderation is `/admin.html`.

Setting up from scratch (a fork, or a new Vercel project):

1. Import the repo in Vercel.
2. In the Vercel project: **Storage → Create → Blob** and connect it
   (this auto-sets `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables**: add `ADMIN_PASSWORD` = your chosen password.

Submissions land in Blob under `doodles/pending/`; approving copies them to
`doodles/approved/` (what `/api/wall` serves) and deletes the pending copy.
Denying just deletes. GIFs are capped at 3 MB and validated server-side.
