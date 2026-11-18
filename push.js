// Push notifications for the web app (iPhone: Safari -> Share -> Add to Home Screen, iOS 16.4+).
//
// Called from Dart (lib/push/web_push_js.dart). Firebase is only used to get an FCM token for
// this browser; the service worker firebase-messaging-sw.js shows the notifications itself.
// The Firebase SDK is loaded only when needed, so it never slows down opening the app.
(function () {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';

  function supported() {
    // A plain Safari tab on iPhone has no PushManager: the app must be opened from the Home Screen.
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function whenActive(worker) {
    if (!worker || worker.state === 'activated') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('service worker did not start')); }, 15000);
      worker.addEventListener('statechange', function () {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
        if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('service worker failed')); }
      });
    });
  }

  async function registration() {
    // Its own scope ("push/"), so it never replaces Flutter's service worker.
    var reg = await navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: 'push/' });
    await whenActive(reg.installing || reg.waiting || reg.active);
    return reg;
  }

  async function firebase(config) {
    var app = await import(SDK + 'firebase-app.js');
    var messaging = await import(SDK + 'firebase-messaging.js');
    var firebaseApp = app.getApps().length ? app.getApp() : app.initializeApp(JSON.parse(config));
    return { messaging: messaging, instance: messaging.getMessaging(firebaseApp) };
  }

  async function currentToken(config, vapidKey) {
    var reg = await registration();
    var fb = await firebase(config);
    return fb.messaging.getToken(fb.instance, { vapidKey: vapidKey, serviceWorkerRegistration: reg });
  }

  function message(e) {
    return e && e.message ? e.message : String(e);
  }

  // Tapped notifications: the service worker posts {type: 'lk-open', id} to an open app.
  var openHandler = null;
  var pendingOpen = null;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      var data = event.data || {};
      if (data.type !== 'lk-open' || !data.id) return;
      if (openHandler) openHandler(String(data.id)); else pendingOpen = String(data.id);
    });
    navigator.serviceWorker.startMessages();
  }

  window.lynnKarkarPush = {
    // The app was opened from a notification (?n=<id>): returns the id once and tidies the address.
    takeOpenRequest: function () {
      var url = new URL(window.location.href);
      var id = url.searchParams.get('n');
      if (!id) return '';
      url.searchParams.delete('n');
      window.history.replaceState(window.history.state, '', url.toString());
      return id;
    },

    // Dart registers fn(id) for notifications tapped while the app is open.
    setOpenHandler: function (fn) {
      openHandler = fn;
      if (pendingOpen) { var id = pendingOpen; pendingOpen = null; fn(id); }
    },

    // 'unsupported' | 'default' | 'granted' | 'denied'
    status: function () {
      return supported() ? Notification.permission : 'unsupported';
    },

    // Must run straight from a tap: iPhone only shows the "Allow notifications" prompt then.
    // Returns 'token:<fcm token>', or 'unsupported' | 'default' | 'denied' | 'error:<why>'.
    enable: async function (config, vapidKey) {
      try {
        if (!supported()) return 'unsupported';
        var permission = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
        if (permission !== 'granted') return permission;
        return 'token:' + await currentToken(config, vapidKey);
      } catch (e) {
        return 'error:' + message(e);
      }
    },

    // This browser's token if notifications are already allowed, else ''.
    token: async function (config, vapidKey) {
      try {
        if (!supported() || Notification.permission !== 'granted') return '';
        return await currentToken(config, vapidKey);
      } catch (e) {
        console.warn('Push token failed:', e);
        return '';
      }
    },

    // On sign-out: invalidates this browser's token and returns it ('' if there was none).
    remove: async function (config, vapidKey) {
      try {
        if (!supported() || Notification.permission !== 'granted') return '';
        var token = await currentToken(config, vapidKey);
        var fb = await firebase(config);
        await fb.messaging.deleteToken(fb.instance);
        return token;
      } catch (e) {
        console.warn('Push remove failed:', e);
        return '';
      }
    },
  };
})();
