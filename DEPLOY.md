# WAVEFM Backend Setup (Cloudflare Pages Functions + KV)

This adds a real backend to WAVEFM using **Cloudflare Pages Functions**
(serverless functions that deploy alongside your existing Pages site — no
separate Worker, no CORS, no new hosting to manage) and **Workers KV** for
storage. It replaces:

- the manual "copy JSON → paste into GitHub" publishing flow
- localStorage-only shoutouts and requests (per-browser, not shared)
- the fake/jittered listener count

with a single shared source of truth that every listener and admin session
reads from.

## 1. Push the new files

Commit and push these new/changed files to the GitHub repo your Cloudflare
Pages project already deploys from:

```
functions/api/_lib/auth.js
functions/api/admin/login.js
functions/api/channels.js
functions/api/heartbeat.js
functions/api/listeners.js
functions/api/shoutout.js
functions/api/requests/index.js
functions/api/requests/[id].js
functions/api/requests/[id]/approve.js
index.html          (updated)
admin.html           (updated)
channels.json         (unchanged — used as a one-time seed + offline fallback)
```

Cloudflare Pages auto-detects the `functions/` folder and deploys each file
as an endpoint under `/api/*`. No config file is required for this.

## 2. Create a KV namespace and bind it

In the Cloudflare dashboard:

1. Go to **Workers & Pages → KV** → **Create a namespace**. Name it e.g.
   `wavefm-kv`.
2. Go to your **Pages project → Settings → Functions → KV namespace
   bindings** → **Add binding**.
   - **Variable name:** `WAVEFM_KV` (must match exactly — the code refers to
     `env.WAVEFM_KV`)
   - **KV namespace:** the `wavefm-kv` namespace you just created
3. Do this for both the **Production** and **Preview** environments.

## 3. Set the admin passphrase

Still in **Settings**, go to **Environment variables**:

1. Add a variable named `ADMIN_PASSPHRASE`.
2. Set its value to whatever passphrase you want admins to use.
3. Click **Encrypt** so it's stored as a secret, not plain text.
4. Add it for both **Production** and **Preview**.

This replaces the old hard-coded `ADMIN_PASSPHRASE` constant that used to
sit in `admin.html`'s source — the passphrase is now only known to the
server and is checked on every write request.

## 4. Redeploy

Bindings and environment variables only take effect on a new deployment.
Trigger one by pushing again, or click **Retry deployment** on the latest
deployment in the dashboard.

## 5. Seed the backend

1. Open `your-site.pages.dev/admin.html` and log in with your new
   passphrase (this now calls `/api/admin/login`, which validates it
   server-side).
2. If the backend has no data yet, you'll see a toast: *"Backend is empty —
   any edit here will seed it automatically."* Add, edit, or reorder
   anything (even trivially) and it will save the current channel data
   (starting from the bundled `channels.json`) into KV as version 1.
3. From then on, every add/edit/delete in the Channels tab saves
   immediately — there's a status indicator next to Logout that shows
   Saving… / Saved ✓ / Sync conflict.

## 6. Quick tests

- Visit `/api/listeners` directly — should return `{"count":0}` (or more,
  if listeners are on the site).
- Open `index.html` in two tabs — the listener count should reflect both.
- Post a shoutout from `admin.html`, then check it shows up in `index.html`
  within ~30 seconds, in a different browser/device.
- Submit a song request from `index.html`, approve it from `admin.html` →
  Requests tab, and confirm it appears in the target channel for all
  listeners (not just your browser).

## What changed vs. before

| Feature | Before | Now |
|---|---|---|
| Publishing channel edits | Manual export → copy → paste into `channels.json` on GitHub | Auto-saved to KV on every edit, with conflict detection |
| DJ shoutouts | `localStorage`, visible only on the admin's own device | Shared via `/api/shoutout`, visible to all listeners |
| Song requests | Two disconnected local queues that only worked if admin and listener shared a browser | One shared, moderated queue (`/api/requests` → approve/reject) |
| Listener count | Randomly jittered fake number | Real count from live heartbeats (`/api/heartbeat` + `/api/listeners`) |
| Concurrent edits | Could silently overwrite each other (the "stale data" bug) | Rejected with a conflict prompt if the data changed since you loaded it |

## Notes / limitations

- `WAVEFM_KV.list()` (used for the listener count) is eventually
  consistent — the count is a good live approximation for a UI badge, not
  an exact real-time figure.
- Everything falls back gracefully: if the backend isn't deployed yet (or
  goes down), `index.html` and `admin.html` fall back to reading the static
  `channels.json`, and the listener count/shoutout simply stay at their
  last known values instead of erroring out.
- Admin auth is a single shared passphrase, checked server-side on every
  write call (via the `X-Admin-Key` header) — simple by design, matching
  how the site was already set up. If you ever want per-admin accounts or
  expiring sessions, that's a bigger change on top of this.
