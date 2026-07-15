import { checkAdmin, jsonResponse, errorResponse } from '../_lib/auth.js';

const KEY = 'requests';

// DELETE /api/requests/:id — admin only, rejects/removes a pending request.
export async function onRequestDelete({ request, env, params }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  const raw = await env.WAVEFM_KV.get(KEY);
  const list = raw ? JSON.parse(raw) : [];
  const next = list.filter(r => r.id !== params.id);
  if (next.length === list.length) return errorResponse('Request not found.', 404);

  await env.WAVEFM_KV.put(KEY, JSON.stringify(next));
  return jsonResponse({ ok: true });
}
