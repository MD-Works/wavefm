import { checkAdmin, jsonResponse, errorResponse } from './_lib/auth.js';

const KEY = 'shoutout';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// GET /api/shoutout — public. Returns { shoutout: null } if none or expired.
export async function onRequestGet({ env }) {
  const raw = await env.WAVEFM_KV.get(KEY);
  if (!raw) return jsonResponse({ shoutout: null });
  const d = JSON.parse(raw);
  if (!d.text || Date.now() - d.ts > TTL_MS) return jsonResponse({ shoutout: null });
  return jsonResponse({ shoutout: d });
}

// POST /api/shoutout — admin only. Body: { text }
export async function onRequestPost({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const text = ((body && body.text) || '').trim();
  if (!text) return errorResponse('Message text is required.');

  const d = { text: text.slice(0, 300), ts: Date.now() };
  await env.WAVEFM_KV.put(KEY, JSON.stringify(d));
  return jsonResponse({ ok: true, shoutout: d });
}

// DELETE /api/shoutout — admin only.
export async function onRequestDelete({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  await env.WAVEFM_KV.delete(KEY);
  return jsonResponse({ ok: true });
}
