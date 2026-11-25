// Service worker for push notifications in the web app (registered by push.js with scope "push/").
//
// No Firebase code is needed here: Firebase Cloud Messaging delivers a standard Web Push whose
// JSON looks like { "notification": { "title", "body" }, "data": { ... } }, and we show it.
// iPhone requires every push to show a notification, so this always does.

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }
  var n = payload.notification || {};
  var data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(n.title || 'Karkar & Lynn', {
      body: n.body || '',
      icon: 'icons/Icon-192.png',
      badge: 'icons/Icon-192.png',
      tag: data.notification_id || undefined,
      data: data,
    })
  );
});

// Tapping a notification opens the app on what it's about: an open app gets a message
// (push.js passes it to Dart), a closed one opens with ?n=<notification id>.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var appUrl = new URL('../', self.registration.scope).href; // .../lynn-karkar-releases/
  var id = (event.notification.data && event.notification.data.notification_id) || '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (w.url.indexOf(appUrl) === 0 && 'focus' in w) {
          if (id) w.postMessage({ type: 'lk-open', id: String(id) });
          return w.focus();
        }
      }
      return self.clients.openWindow(id ? appUrl + '?n=' + encodeURIComponent(id) : appUrl);
    })
  );
});
