import { checkAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

const REQ_KEY = 'requests';
const CH_KEY  = 'channels';

// POST /api/requests/:id/approve — admin only.
// Moves the request into the channel it was requested for (or Listener
// Picks, i.e. the first channel with synced === false, if none was given
// or it no longer exists), bumping the channels version.
export async function onRequestPost({ request, env, params }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return errorResponse(auth.error, auth.status || 401);

  const reqRaw = await env.WAVEFM_KV.get(REQ_KEY);
  const list = reqRaw ? JSON.parse(reqRaw) : [];
  const idx = list.findIndex(r => r.id === params.id);
  if (idx === -1) return errorResponse('Request not found.', 404);
  const item = list[idx];

  const chRaw = await env.WAVEFM_KV.get(CH_KEY);
  if (!chRaw) return errorResponse('Channels have not been set up yet — save channels from the admin panel first.', 500);
  const chData = JSON.parse(chRaw);

  let targetIdx = item.channelIdx;
  if (!(Number.isInteger(targetIdx) && chData.channels[targetIdx])) {
    targetIdx = chData.channels.findIndex(c => c.synced === false);
  }
  if (targetIdx === -1 || targetIdx == null) return errorResponse('No target channel found to approve into.', 500);

  const target = chData.channels[targetIdx];
  if (!target.videos.some(v => v.id === item.videoId)) {
    target.videos.push({ id: item.videoId, title: item.title, dur: 240 });
  }

  chData.version = (chData.version || 0) + 1;
  chData.updatedAt = new Date().toISOString();
  await env.WAVEFM_KV.put(CH_KEY, JSON.stringify(chData));

  list.splice(idx, 1);
  await env.WAVEFM_KV.put(REQ_KEY, JSON.stringify(list));

  return jsonResponse({ ok: true, channels: chData.channels, version: chData.version });
}
