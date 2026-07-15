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
// Body: { videoId, title, requestedBy, channelIdx }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const { videoId, title, requestedBy, channelIdx } = body || {};

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return errorResponse('Invalid YouTube video ID.');
  }
  if (!title || !title.trim()) return errorResponse('Title is required.');

  const list = await loadRequests(env);
  if (list.some(r => r.videoId === videoId)) {
    return errorResponse('This video is already pending review.', 409);
  }

  const entry = {
    id: crypto.randomUUID(),
    videoId,
    title: title.trim().slice(0, 200),
    requestedBy: (requestedBy || 'Anonymous').toString().trim().slice(0, 60) || 'Anonymous',
    channelIdx: Number.isInteger(channelIdx) ? channelIdx : null,
    ts: Date.now()
  };
  list.push(entry);
  await saveRequests(env, list);
  return jsonResponse({ ok: true, request: entry }, 201);
}
