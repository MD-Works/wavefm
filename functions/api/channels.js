import { checkAdmin, jsonResponse, errorResponse } from './_lib/auth.js';

const KEY = 'channels';

// GET /api/channels — public, used by both index.html and admin.html.
export async function onRequestGet({ env }) {
  const raw = await env.WAVEFM_KV.get(KEY);
  if (!raw) {
    return jsonResponse({ channels: null, version: 0, updatedAt: null, seeded: false });
  }
  const data = JSON.parse(raw);
  return jsonResponse({ ...data, seeded: true });
}

// PUT /api/channels — admin only. Body: { channels: [...], version: N }
// `version` must match the version currently stored in KV (the one the
// client last fetched). If someone else saved in the meantime, this
// returns 409 instead of silently overwriting their changes — this is
// what fixes the "stale data creeps in" bug from the manual copy/paste
// workflow.
export async function onRequestPut({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const { channels, version } = body || {};
  if (!Array.isArray(channels)) return errorResponse('Missing or invalid channels array.');
  if (typeof version !== 'number') return errorResponse('Missing version.');

  const raw = await env.WAVEFM_KV.get(KEY);
  const current = raw ? JSON.parse(raw) : { version: 0 };

  if (current.version !== version) {
    return jsonResponse({
      error: 'Conflict: channels were updated by someone else since you loaded this page.',
      current
    }, 409);
  }

  const next = { channels, version: version + 1, updatedAt: new Date().toISOString() };
  await env.WAVEFM_KV.put(KEY, JSON.stringify(next));
  return jsonResponse(next);
}
