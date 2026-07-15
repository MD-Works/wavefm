import { checkAdmin, jsonResponse, errorResponse } from '../_lib/auth.js';

const KEY = 'requests';

async function loadRequests(env) {
  const raw = await env.WAVEFM_KV.get(KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveRequests(env, list) {
  await env.WAVEFM_KV.put(KEY, JSON.stringify(list));
}

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
export async function onRequestPost({ request, env }) {
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
  return jsonResponse({ ok: true, request: entry }, 201);
}
