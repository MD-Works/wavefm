# 📻 WAVEFM

A free, browser-based radio station — multiple channels, synced live listening, listener song requests with dedications, and a lightweight admin console to run it all. No ads, no accounts, no tracking.

Built as a small community project. Now open source under the [MIT license](LICENSE) — take it, run it, make it your own.

**🔴 Live:** [wavefm-569.pages.dev](https://wavefm-569.pages.dev)

---

## What it does

- **Multiple channels** — some *synced* (every listener hears the same track at the same position, like real FM radio), some *on-demand* (skip/replay freely, e.g. a Listener Picks channel)
- **Song requests with dedications** — listeners submit a song title, artist, and an optional shout-out message; the DJ finds it on YouTube and adds it live for everyone
- **DJ shoutouts** — a message the admin can push out that appears for all listeners in real time
- **Live listener count** — a real count of who's tuned in right now
- **Admin console** (`admin.html`) — manage channels and tracks, approve/reject requests, post shoutouts, all behind a passphrase
- **Mobile-friendly** — full slide-in channel drawer on phones, not just a shrunk desktop layout

## How it's built

Deliberately simple — no build step, no framework, no dependencies to install:

- `index.html` — the listener-facing player (vanilla HTML/CSS/JS + the [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) for playback)
- `admin.html` — the DJ/admin console
- `channels.json` — the default channel lineup, used to seed the backend on first run and as an offline fallback
- `functions/api/` — the backend: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) backed by [Workers KV](https://developers.cloudflare.com/kv/), handling channels, song requests, shoutouts, and the live listener count

```
wavefm/
├── index.html              # public player
├── admin.html              # admin console
├── channels.json           # default channel data (seed + offline fallback)
├── DEPLOY.md                # full backend setup guide
└── functions/api/
    ├── channels.js          # GET/PUT channel + track data (versioned, conflict-safe)
    ├── requests/             # listener song requests → DJ review → approve/reject
    ├── shoutout.js           # DJ shoutout banner
    ├── heartbeat.js          # listener "still here" ping
    ├── listeners.js          # live listener count
    ├── admin/login.js        # passphrase check for the admin console
    └── _lib/auth.js          # shared auth + response helpers
```

## Running your own

1. Fork or clone this repo.
2. Deploy it to [Cloudflare Pages](https://pages.cloudflare.com/) (point it at your fork — Pages auto-detects the `functions/` folder).
3. Follow **[DEPLOY.md](DEPLOY.md)** for the one-time backend setup: creating a KV namespace, binding it, and setting your admin passphrase.
4. Open `admin.html`, log in, and swap in your own channels and tracks — or just edit `channels.json` before you deploy.

No local dev server needed to poke around the front end — `index.html` and `admin.html` are plain static files. The backend only comes alive once deployed to Pages.

## License

[MIT](LICENSE) — do whatever you'd like with it. If you build something fun with it, I'd love to hear about it.
