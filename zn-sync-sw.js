/* =====================================================================
 * ZyroNex · Sync-only Service Worker (zn-sync-sw.js)
 * ⚠️ ΔΕΝ ΚΑΝΕΙ CACHING. Καθόλου fetch-handler που σερβίρει cached HTML/JS
 * (αυτό προκαλούσε το stale-code bug). Μόνο: (1) Background Sync event για
 * flush της ουράς, (2) μήνυμα από τη σελίδα για χειροκίνητο flush.
 * Ο πραγματικός commit γίνεται από τη σελίδα (ZN_OFFLINE.flush) — εδώ απλώς
 * ειδοποιούμε τους clients να τρέξουν flush.
 * ===================================================================== */
'use strict';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  // Καθάρισε τυχόν ΠΑΛΙΑ caches από προηγούμενο (caching) SW.
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ΔΕΝ υπάρχει fetch handler → ο browser πάει πάντα στο δίκτυο (no staleness).

// Background Sync: όταν επανέλθει το δίκτυο, ζήτα από τους clients flush.
self.addEventListener('sync', function (e) {
  if (e.tag === 'zn-flush') {
    e.waitUntil(_notifyClients());
  }
});

// Μήνυμα από τη σελίδα (π.χ. «κάνε flush τώρα»)
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'zn-flush') {
    _notifyClients();
  }
});

function _notifyClients() {
  return self.clients.matchAll({ includeUncontrolled: true }).then(function (clients) {
    clients.forEach(function (c) { c.postMessage({ type: 'zn-do-flush' }); });
  });
}
