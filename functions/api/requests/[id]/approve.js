import { checkAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

const REQ_KEY = 'requests';
const CH_KEY  = 'channels';

// POST /api/requests/:id/approve — admin only.
// The listener only described the song, so the DJ supplies the actual
// YouTube video they found, plus its length, when approving.
// Body: { videoId, title? (override), dur? (seconds, default 240), channelIdx? (override) }
export async function onRequestPost({ request, env, params }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }
  const { videoId, title, dur, channelIdx } = body || {};

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return errorResponse('A valid YouTube video ID is required to approve this request.');
  }
  const duration = Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 240;

  const reqRaw = await env.WAVEFM_KV.get(REQ_KEY);
  const list = reqRaw ? JSON.parse(reqRaw) : [];
  const idx = list.findIndex(r => r.id === params.id);
  if (idx === -1) return errorResponse('Request not found.', 404);
  const item = list[idx];

  const chRaw = await env.WAVEFM_KV.get(CH_KEY);
  if (!chRaw) return errorResponse('Channels have not been set up yet — save channels from the admin panel first.', 500);
  const chData = JSON.parse(chRaw);

  let targetIdx = Number.isInteger(channelIdx) ? channelIdx : item.channelIdx;
  if (!(Number.isInteger(targetIdx) && chData.channels[targetIdx])) {
    targetIdx = chData.channels.findIndex(c => c.synced === false);
  }
  if (targetIdx === -1 || targetIdx == null) return errorResponse('No target channel found to approve into.', 500);

  const target = chData.channels[targetIdx];
  const trackTitle = (title && title.trim())
    ? title.trim()
    : [item.songTitle, item.artist].filter(Boolean).join(' — ');

  const track = { id: videoId, title: trackTitle, dur: duration };
  if (item.dedication) track.dedication = item.dedication;
  if (item.requestedBy) track.requestedBy = item.requestedBy;

  if (!target.videos.some(v => v.id === videoId)) {
    target.videos.push(track);
  }

  chData.version = (chData.version || 0) + 1;
  chData.updatedAt = new Date().toISOString();
  await env.WAVEFM_KV.put(CH_KEY, JSON.stringify(chData));

  list.splice(idx, 1);
  await env.WAVEFM_KV.put(REQ_KEY, JSON.stringify(list));

  return jsonResponse({ ok: true, channels: chData.channels, version: chData.version });
}
