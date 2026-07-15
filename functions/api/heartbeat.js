import { jsonResponse, errorResponse } from './_lib/auth.js';

// POST /api/heartbeat — public. Body: { id }
// Marks a listener as "active" for 45s. Called every 20s from index.html
// while a tab is open, so the count in /api/listeners reflects who's
// actually there instead of a random jittered number.
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const id = ((body && body.id) || '').toString().slice(0, 64);
  if (!id) return errorResponse('Missing client id.');

  await env.WAVEFM_KV.put('listener:' + id, '1', { expirationTtl: 45 });
  return jsonResponse({ ok: true });
}
