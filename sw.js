// WaveFM Service Worker — install-only
// Registers to satisfy the PWA installability requirement.
// No caching: WaveFM streams live YouTube content so there is no
// meaningful offline experience to offer. Network failures surface
// naturally to the user rather than showing stale cached pages.

const VERSION = 'wavefm-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// No fetch handler — all requests go straight to the network.
