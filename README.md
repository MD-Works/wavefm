# WAVEFM — Setup & Feature Reference

## What is WAVEFM?

WAVEFM is a browser-based internet radio platform with a live DJ admin console. Listeners tune into curated channels (synced or on-demand), submit song requests with dedications, rate tracks, and share songs or playlists. The DJ manages channels, tracks, requests, and shoutouts from a password-protected admin panel. Everything is backed by Cloudflare Pages Functions + Workers KV — no separate server, no CORS, no third-party hosting.

---

## Backend Setup (first-time)

### 1. Push files to GitHub

Commit and push the following to the GitHub repo your Cloudflare Pages project deploys from:

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
functions/api/ratings/[id].js     ← new
functions/api/hot.js               ← new
index.html
admin.html
channels.json                      (unchanged — used as seed + offline fallback)
```

Cloudflare Pages auto-detects the `functions/` folder and deploys each file as an endpoint under `/api/*`. No config file needed.

### 2. Create a KV namespace

1. Go to **Workers & Pages → KV → Create a namespace**. Name it `wavefm-kv`.
2. Go to your **Pages project → Settings → Functions → KV namespace bindings → Add binding**:
   - **Variable name:** `WAVEFM_KV` (must match exactly — the code uses `env.WAVEFM_KV`)
   - **KV namespace:** the namespace you just created
3. Add the binding for both **Production** and **Preview** environments.

### 3. Set the admin passphrase

In **Settings → Environment variables**:

1. Add `ADMIN_PASSPHRASE` — set to whatever passphrase you want DJs to use.
2. Click **Encrypt** so it's stored as a secret.
3. Add it for both **Production** and **Preview**.

### 4. Redeploy

Bindings and env vars only take effect on a new deployment. Push any change or click **Retry deployment** in the dashboard.

### 5. Seed the backend

1. Open `your-site.pages.dev/admin.html` and log in.
2. If the backend has no data yet, you'll see a toast: *"Backend is empty — any edit here will seed it automatically."*
3. Add or edit anything — it will save the current `channels.json` data into KV as version 1. All subsequent edits save automatically.

### 6. Quick smoke tests

- `/api/listeners` → should return `{"count":0}` (or more if listeners are on)
- Open `index.html` in two tabs — listener count should reflect both
- Post a shoutout from admin, verify it appears on the listener page within ~30 seconds
- Submit a request from `index.html`, approve it from the Requests tab in admin, confirm the track appears for listeners

---

## Files changed per update

| Update | Files |
|---|---|
| Initial backend | `functions/api/**`, `index.html`, `admin.html` |
| Song sharing (WhatsApp) | `index.html` |
| Ratings + Hot channel | `index.html`, `functions/api/ratings/[id].js`, `functions/api/hot.js` |
| Fullscreen video | `index.html` |
| Admin track editing + move to channel | `admin.html` |
| Song count + runtime stats | `index.html`, `admin.html` |

---

## Feature Reference

### Listener features (`index.html`)

#### Channels
- Sidebar lists all channels. Synced channels play the same position for every listener; on-demand channels let each listener navigate freely.
- Last channel played is remembered per device (localStorage) and restored on next visit.

#### Song requests
Listeners type a song title, artist, and optional dedication — no YouTube URL required. The DJ finds the video and attaches it from the admin panel. Dedications appear under the track in the queue and the now-playing bar.

#### Song sharing
Every track row and playlist detail shows a **↗** share button. Tapping it opens a modal with:
- A pre-formatted WhatsApp message (`wa.me/?text=...`) including the track title and a direct link
- A **Copy Link** button for the raw URL

**Share URL formats:**
- Single track: `https://wavefm-569.pages.dev/?v=VIDEO_ID`
- Temp playlist: `https://wavefm-569.pages.dev/?pl=ID1,ID2,ID3`

When a listener opens a share link, WAVEFM auto-plays the track or creates a temporary in-memory playlist (shown as a "Shared Playlist" channel). A banner confirms what's playing. Share links take priority over the last-played channel on load.

#### Ratings (👍 / 👎)
Thumbs up/down buttons appear in the now-playing bar on every track. Rules:
- One vote per track per device (stored in localStorage, locked once cast)
- Votes POST to `/api/ratings/:videoId` and increment KV counters atomically
- If the backend is unreachable, the vote is stored locally and a toast confirms "(offline)"

Ratings feed directly into the **Hot Right Now** channel (see below).

#### Hot Right Now channel
The first channel is dynamically ranked by net rating (`up − down`) on every page load:
- `/api/hot` reads all `rating:*` keys from KV, sorts by net score, returns the top 20
- Track titles are resolved from the locally-loaded channel data (no KV catalogue dependency)
- Falls back to the static channel order in `channels.json` if the API returns nothing

#### Fullscreen video
The **⛶** button in the now-playing bar expands the YouTube player to fill the screen without restarting playback. Exit by:
- Tapping the black area around the video
- Pressing `Esc`
- Pressing `F`
- Clicking the **⛶** collapse icon

The player element stays in place in the DOM (CSS `position: fixed` via a class) — no iframe reload, no audio interruption.

#### Playlists
Listeners can build personal playlists from any track in any channel. Playlists live in localStorage and can be shared as a temp playlist URL.

#### Song count badge
The topbar shows a live **"N songs & growing"** count populated from the loaded channel data after boot.

---

### DJ admin features (`admin.html`)

Access at `your-site.pages.dev/admin.html`. Requires the `ADMIN_PASSPHRASE` environment variable set in Cloudflare. The passphrase is validated server-side on every write — never hard-coded in the page source.

#### Stats bar
A slim bar below the topbar shows — updated live after every change:
- **Total songs** across all channels
- **Total runtime** (formatted as `4h 32m`)
- **Channel count**

Each channel card header also shows its individual runtime (e.g. `2h 15m`).

#### Channels tab

**Add channel** — name, icon (emoji), frequency label, description, synced toggle.

**Edit channel** — click **Edit** on any channel header to edit its name, icon, frequency, description, and synced mode inline. Saves immediately to KV.

**Delete channel** — removes the channel and all its tracks after confirmation.

**Add track** — per channel. Accepts a song title, YouTube URL or ID (11-char), and length (`m:ss` or `h:mm:ss`). Validation:
- Hard block if the video ID already exists in the same channel
- Soft amber warning with **Add Anyway / Cancel** if the ID exists in a different channel

**Edit track (✎)** — click the pencil on any track row to edit its title, YouTube ID, and duration inline. If the new ID exists elsewhere, shows an amber warning with **Save Anyway / Cancel**.

**Move track up/down (↑↓)** — reorders within the channel.

**Move to channel (⇄)** — opens a dropdown to pick a destination channel. The track is removed from the current channel and appended to the target. Shows a confirmation prompt if the track already exists in the target channel. Disabled when only one channel exists.

**Remove track (✕)** — removes immediately.

All changes auto-save to KV. A **Saving… / Saved ✓ / Sync conflict** indicator in the topbar confirms status. If two admin sessions edit simultaneously, the later save is rejected with a reload prompt to prevent silent overwrites.

#### Requests tab
Listener requests show song title, artist, optional dedication, and requester name. Actions:
- **Find & Add** — opens a form to attach a YouTube URL/ID, confirm/edit the title and length, set the target channel, and approve. The dedication carries through to the track.
- **Reject** — removes the request from the queue.

#### Shoutout tab
Post a text message that appears as a banner on all listener devices within ~30 seconds (via KV polling). Expires after 30 minutes. Includes a live preview and a **Clear Current** button.

#### Backup tab
Preview, copy, or download the current channel data as `channels.json`. Useful as a manual backup; the backend is the live source of truth.

---

## Architecture notes

| Concern | Approach |
|---|---|
| Channel data | Stored in KV as `channels` key. Versioned — concurrent saves are rejected if the version is stale. Falls back to static `channels.json` if KV unreachable. |
| Ratings | KV keys `rating:{videoId}` → `{ up, down }`. Client-side one-vote enforcement via `wfm_votes` in localStorage. |
| Hot channel | `/api/hot` lists all `rating:*` keys, sorts by net score, enriches from the `channels` KV key, returns top 20. |
| Listener count | Heartbeat keys `heartbeat:{uuid}` with 35s TTL. Count is approximate (KV list is eventually consistent). |
| Shoutout | Single KV key `shoutout`. Polled every 30s by listeners. |
| Requests | KV keys `request:{uuid}`. Approved requests mutate the channels object directly via `/api/requests/[id]/approve`. |
| Admin auth | Single `ADMIN_PASSPHRASE` env var, checked server-side on every write via `X-Admin-Key` header. Session stored in `sessionStorage` only. |
| Last channel | `wfm_last_channel` in localStorage. Overridden by share link params on load. |
| Share links | `?v=VIDEO_ID` (single track) or `?pl=ID1,ID2,...` (temp playlist). Decoded in `parseShareParams()` on boot. |

## Limitations

- `WAVEFM_KV.list()` (used for listener count and hot rankings) is eventually consistent — values are a good live approximation, not exact real-time figures.
- Admin auth is a single shared passphrase by design. Per-admin accounts or expiring tokens would require a more significant auth layer on top.
- Shared playlist URLs encode video IDs in the query string — practical up to ~30 tracks before URLs get unwieldy.
- The YouTube iframe API logs harmless `postMessage` origin warnings in the browser console during player initialisation. These come from YouTube's own embed script and can be ignored.
