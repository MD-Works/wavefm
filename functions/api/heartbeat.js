import { jsonResponse, errorResponse } from './_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const id = ((body && body.id) || '').toString().slice(0, 64);
  if (!id) return errorResponse('Missing client id.');

  try {
    await env.WAVEFM_KV.put('listener:' + id, '1', { expirationTtl: 60 });
  } catch (e) {
    return errorResponse('Failed to record heartbeat.', 500);
  }
  return jsonResponse({ ok: true });
}
