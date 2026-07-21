import { checkAdmin, jsonResponse, errorResponse } from '../_lib/auth.js';

const KEY = 'requests';

async function loadRequests(env) {
  const raw = await env.WAVEFM_KV.get(KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveRequests(env, list) {
  await env.WAVEFM_KV.put(KEY, JSON.stringify(list));
}

// ── EMAIL NOTIFICATION ────────────────────────────────────────────────────────
// Fires via Resend (https://resend.com) after a request is saved to KV.
// Requires two env vars set in Cloudflare Pages → Settings → Environment variables:
//   RESEND_API_KEY   — your Resend API key  (re_xxxxxxxxx)
//   DJ_EMAIL         — the address to notify  (you@example.com)
// NOTIFY_FROM is optional; defaults to onair@wavefm.fm (must be a verified
// Resend sender domain, or use the Resend sandbox address for testing).
//
// The function is fire-and-forget — it uses ctx.waitUntil() so the listener
// gets their 201 response instantly and the email sends in the background.
// If Resend is unavailable or misconfigured the request is still saved; the
// error is logged but not surfaced to the listener.

async function sendRequestNotification(env, entry, ctx) {
  if (!env.RESEND_API_KEY || !env.DJ_EMAIL) return; // silently skip if not configured

  const from    = env.NOTIFY_FROM || 'WaveFM <onair@wavefm.fm>';
  const channel = env.WAVEFM_KV
    ? await getChannelName(env, entry.channelIdx)
    : null;

  const channelLine = channel ? `\nChannel:     ${channel}` : '';
  const dedLine     = entry.dedication ? `\nDedication:  ${entry.dedication}` : '';

  const text = [
    '🎵 New song request on WaveFM',
    '',
    `Song:        ${entry.songTitle}`,
    entry.artist ? `Artist:      ${entry.artist}` : null,
    `Requested by: ${entry.requestedBy}`,
    channelLine || null,
    dedLine || null,
    '',
    `Received:    ${new Date(entry.ts).toUTCString()}`,
    `Request ID:  ${entry.id}`,
    '',
    'Open the DJ admin panel to review and approve.',
  ].filter(l => l !== null).join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: system-ui, sans-serif; background: #1a1610; color: #e8c87a; margin: 0; padding: 0; }
  .wrap { max-width: 480px; margin: 32px auto; background: #231e14; border-radius: 8px;
          border: 1px solid #3a3020; overflow: hidden; }
  .header { background: #2a2318; padding: 20px 28px; border-bottom: 1px solid #3a3020; }
  .logo { font-size: 1.3rem; font-weight: 900; letter-spacing: 0.08em; color: #e8c87a; }
  .logo span { color: #c8a84a; }
  .badge { display: inline-block; background: #e8c87a22; color: #e8c87a;
           font-size: 0.7rem; letter-spacing: 0.1em; padding: 2px 8px;
           border-radius: 3px; margin-top: 6px; }
  .body { padding: 24px 28px; }
  .title { font-size: 1.05rem; font-weight: 700; color: #f0d890; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; font-size: 0.88rem; vertical-align: top; }
  td:first-child { color: #9a8a6a; width: 110px; white-space: nowrap; }
  td:last-child  { color: #e8d8a0; }
  .divider { border: none; border-top: 1px solid #3a3020; margin: 18px 0; }
  .footer { padding: 16px 28px; font-size: 0.78rem; color: #6a5a3a;
            border-top: 1px solid #3a3020; text-align: center; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">WAVE<span>FM</span></div>
    <div class="badge">🎵 NEW REQUEST</div>
  </div>
  <div class="body">
    <div class="title">A listener wants to hear something!</div>
    <table>
      <tr><td>Song</td><td><strong>${esc(entry.songTitle)}</strong></td></tr>
      ${entry.artist    ? `<tr><td>Artist</td><td>${esc(entry.artist)}</td></tr>` : ''}
      <tr><td>From</td><td>${esc(entry.requestedBy)}</td></tr>
      ${channel         ? `<tr><td>Channel</td><td>${esc(channel)}</td></tr>` : ''}
      ${entry.dedication? `<tr><td>Dedication</td><td><em>${esc(entry.dedication)}</em></td></tr>` : ''}
    </table>
    <hr class="divider">
    <table>
      <tr><td>Received</td><td>${new Date(entry.ts).toUTCString()}</td></tr>
      <tr><td>Request ID</td><td style="font-family:monospace;font-size:0.8rem">${esc(entry.id)}</td></tr>
    </table>
  </div>
  <div class="footer">Open the DJ admin panel to find the video and approve this request.</div>
</div>
</body></html>`;

  const send = async () => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to:      [env.DJ_EMAIL],
          subject: `🎵 New request: ${entry.songTitle}${entry.artist ? ' — ' + entry.artist : ''}`,
          text,
          html,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('[WaveFM] Resend error', res.status, err);
      }
    } catch (e) {
      console.error('[WaveFM] Resend fetch failed:', e);
    }
  };

  // Use waitUntil so the email sends after the response is returned
  if (ctx?.waitUntil) {
    ctx.waitUntil(send());
  } else {
    await send(); // fallback for environments without ctx
  }
}

// Look up a channel name from KV (best-effort — used in the email only)
async function getChannelName(env, channelIdx) {
  if (!Number.isInteger(channelIdx)) return null;
  try {
    const raw = await env.WAVEFM_KV.get('channels');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.channels?.[channelIdx]?.name ?? null;
  } catch { return null; }
}

// Minimal HTML escaping for the email template
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ROUTE HANDLERS ────────────────────────────────────────────────────────────

// GET /api/requests — admin only, the pending-review queue.
export async function onRequestGet({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);
  const list = await loadRequests(env);
  list.sort((a, b) => a.ts - b.ts);
  return jsonResponse({ requests: list });
}

// POST /api/requests — public, called from index.html's request form.
// Listeners describe the song (title/artist) and an optional dedication —
// they don't provide a YouTube link. The DJ finds the actual video and
// attaches it when approving (see requests/[id]/approve.js).
// Body: { songTitle, artist, dedication, requestedBy, channelIdx }
export async function onRequestPost({ request, env, ctx }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const { songTitle, artist, dedication, requestedBy, channelIdx } = body || {};

  if (!songTitle || !songTitle.trim()) return errorResponse('Song title is required.');

  const list = await loadRequests(env);

  const norm = s => (s || '').trim().toLowerCase();
  const dupe = list.some(r => norm(r.songTitle) === norm(songTitle) && norm(r.artist) === norm(artist));
  if (dupe) return errorResponse('A very similar request is already pending review.', 409);

  const entry = {
    id: crypto.randomUUID(),
    songTitle: songTitle.trim().slice(0, 120),
    artist: (artist || '').toString().trim().slice(0, 120),
    dedication: (dedication || '').toString().trim().slice(0, 200),
    requestedBy: (requestedBy || 'Anonymous').toString().trim().slice(0, 60) || 'Anonymous',
    channelIdx: Number.isInteger(channelIdx) ? channelIdx : null,
    ts: Date.now()
  };
  list.push(entry);
  await saveRequests(env, list);

  // Notify the DJ — fire-and-forget, never blocks the listener's response
  await sendRequestNotification(env, entry, ctx);

  return jsonResponse({ ok: true, request: entry }, 201);
}
