// Shared helpers used by every function under /functions/api.
// Files/folders starting with "_" are not routed by Cloudflare Pages,
// so this module is safe to import without becoming its own endpoint.

export async function checkAdmin(request, env) {
  if (!env.ADMIN_PASSPHRASE) {
    return { ok: false, error: 'Server not configured: set the ADMIN_PASSPHRASE environment variable.', status: 500 };
  }
  const key = request.headers.get('X-Admin-Key') || '';
  if (key !== env.ADMIN_PASSPHRASE) {
    return { ok: false, error: 'Invalid admin key.', status: 401 };
  }
  return { ok: true };
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
