import { jsonResponse } from './_lib/auth.js';

// GET /api/listeners — public. Counts recent heartbeats (see heartbeat.js).
// Note: KV list() is eventually consistent, so this is a good-enough live
// count for a UI badge, not an exact real-time number.
export async function onRequestGet({ env }) {
  let count = 0;
  let cursor;
  do {
    const res = await env.WAVEFM_KV.list({ prefix: 'listener:', cursor });
    count += res.keys.length;
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);

  return jsonResponse({ count });
}
