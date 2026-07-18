import { checkAdmin, jsonResponse, errorResponse } from './_lib/auth.js';

const KEY = 'channels';

// Cache-Control for the GET response:
// - s-maxage=120  → Cloudflare edge caches for 2 minutes
// - stale-while-revalidate=30 → serve stale while fetching fresh in background
// - no-store for the client → browser doesn't cache; we manage that in localStorage
const GET_CACHE = 'public, s-maxage=120, stale-while-revalidate=30';

// GET /api/channels — public, used by both index.html and admin.html.
// Edge-cached for 2 minutes; cache is purged by the PUT handler on save.
export async function onRequestGet({ env, request }) {
  const raw = await env.WAVEFM_KV.get(KEY);
  if (!raw) {
    return jsonResponse(
      { channels: null, version: 0, updatedAt: null, seeded: false },
      200,
      { 'Cache-Control': GET_CACHE }
    );
  }
  const data = JSON.parse(raw);
  return jsonResponse(
    { ...data, seeded: true },
    200,
    { 'Cache-Control': GET_CACHE }
  );
}

// PUT /api/channels — admin only. Body: { channels: [...], version: N }
// Saves to KV, then purges the Cloudflare edge cache for /api/channels
// so listeners get fresh data immediately rather than waiting 2 minutes.
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

  // Purge the Cloudflare edge cache for this endpoint so the new data is
  // served immediately. Uses the Cache API available inside Pages Functions.
  try {
    const cache = caches.default;
    const url   = new URL(request.url);
    url.pathname = '/api/channels';
    await cache.delete(new Request(url.toString()));
  } catch (_) { /* cache purge is best-effort — not fatal */ }

  return jsonResponse(next);
}
