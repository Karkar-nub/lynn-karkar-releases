// Karkar & Lynn: the moving background behind the Us tab in the web app (iPhone).
//
// The browser animates it with CSS on the graphics chip, so Flutter never redraws the screen
// for it (Flutter-drawn floating hearts made the iPhone web app lag). The Us tab is see-through
// in the web build and the app steers this layer (lib/widgets/live_scene_js.dart):
//   lynnKarkarBg.setActive(bool)  the Us tab is showing (everything pauses otherwise)
//   lynnKarkarBg.setNight(bool)   night colours
//   lynnKarkarBg.setSeason(name)  '' | 'snow' | 'sakura' | 'fireworks' | 'hearts'
//   lynnKarkarBg.float(emoji, n)  n copies float up (a love tap, or hearts for a miss-you);
//                                 several emoji separated by spaces take turns
//   lynnKarkarBg.setBackdrop(style, look, url)
//                                 your background (lib/ui/background_settings.dart): style
//                                 'dreamy' | 'clear' | 'splash' | 'photo', look 'clear' | 'splash'
//                                 for a photo, url = the photo. Clear has no drifting hearts.
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09' +
    'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
  var STAR = 'M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z';

  function svg(path, fill) {
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='" + fill + "' d='" + path + "'/></svg>"
    ) + '")';
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function el(cls, parent, style) {
    var d = document.createElement('div');
    d.className = cls;
    for (var k in style || {}) {
      if (k.indexOf('--') === 0) d.style.setProperty(k, style[k]); else d.style[k] = style[k];
    }
    parent.appendChild(d);
    return d;
  }

  var root, backdrop, mascot, wash, ambient, seasonLayer, floatLayer;
  var active = true, night = false, season = '', fireworks = null;
  var chosen = { style: 'dreamy', look: 'splash', url: '' };

  function ready() {
    if (root) return true;
    root = document.getElementById('lk-bg');
    if (!root) return false;
    // Your background, under everything that moves (hidden for Dreamy: #lk-bg itself is Dreamy).
    backdrop = el('lk-backdrop', root);
    mascot = el('lk-mascot', root);
    wash = el('lk-backdrop', root);
    ambient = el('lk-layer lk-ambient', root);
    seasonLayer = el('lk-layer', root);
    floatLayer = el('lk-layer', root);
    buildAmbient();
    paintBackdrop();
    return true;
  }

  // The same colours as lib/widgets/love_background.dart.
  var PLAIN_DAY = 'linear-gradient(135deg, #FFE4EF 0%, #F8DDF3 50%, #E6DCFF 100%)';
  var PLAIN_NIGHT = 'linear-gradient(135deg, #120C2C 0%, #231442 50%, #3C1C50 100%)';
  var SPLASH_DAY = 'linear-gradient(180deg, #FDBECC 0%, #FDBECC 55%, #FCD6E0 100%)';
  var SPLASH_NIGHT = 'linear-gradient(180deg, #3B1535 0%, #2C1030 55%, #1C0C26 100%)';
  var WASH_DAY =
    'radial-gradient(circle at 12% 10%, rgba(255, 182, 207, .55), rgba(255, 182, 207, 0) 46vmin), ' +
    'radial-gradient(circle at 95% 35%, rgba(203, 184, 255, .50), rgba(203, 184, 255, 0) 44vmin), ' +
    'radial-gradient(circle at 25% 92%, rgba(255, 208, 192, .45), rgba(255, 208, 192, 0) 50vmin), ' +
    'linear-gradient(135deg, rgba(255, 228, 239, .5) 0%, rgba(248, 221, 243, .5) 50%, rgba(230, 220, 255, .5) 100%)';
  var WASH_NIGHT =
    'radial-gradient(circle at 15% 12%, rgba(242, 69, 111, .22), rgba(242, 69, 111, 0) 52vmin), ' +
    'radial-gradient(circle at 92% 40%, rgba(142, 91, 255, .28), rgba(142, 91, 255, 0) 50vmin), ' +
    'radial-gradient(circle at 30% 95%, rgba(74, 107, 255, .16), rgba(74, 107, 255, 0) 56vmin), ' +
    'linear-gradient(135deg, rgba(18, 12, 44, .6) 0%, rgba(35, 20, 66, .6) 50%, rgba(60, 28, 80, .6) 100%)';

  function paintBackdrop() {
    var s = chosen.style;
    var photo = s === 'photo' && chosen.url;
    var soft = chosen.look !== 'clear';
    var bg = '', over = '';
    if (s === 'clear') bg = night ? PLAIN_NIGHT : PLAIN_DAY;
    else if (s === 'splash') bg = night ? SPLASH_NIGHT : SPLASH_DAY;
    else if (photo) {
      bg = 'center / cover no-repeat url("' + String(chosen.url).replace(/"/g, '%22') + '"), ' +
        (night ? PLAIN_NIGHT : PLAIN_DAY);
      over = soft ? (night ? WASH_NIGHT : WASH_DAY) : (night ? 'rgba(0, 0, 0, .3)' : '');
    }
    backdrop.style.background = bg;
    backdrop.style.display = bg ? 'block' : 'none';
    mascot.style.display = s === 'splash' ? 'block' : 'none';
    wash.style.background = over;
    wash.style.display = over ? 'block' : 'none';
    // Clear, or a photo shown clear: no drifting hearts, bokeh or sparkles.
    root.classList.toggle('lk-plain', s === 'clear' || (photo && !soft));
  }

  // Hearts and bokeh drifting up, a few twinkling sparkles (and stars at night).
  function buildAmbient() {
    ambient.innerHTML = '';
    if (reduce) return;
    var heartColors = night ? ['#FF6F98', '#B9A4FF', '#FF9DBB'] : ['#FFFFFF', '#B9A4FF', '#FFC2D6'];
    for (var i = 0; i < 12; i++) {
      var s = rand(12, 30);
      var d = rand(16, 28);
      el('lk-heart', ambient, {
        left: rand(0, 95) + '%', width: s + 'px', height: s + 'px',
        backgroundImage: svg(HEART, heartColors[i % 3]),
        '--o': rand(0.3, 0.6).toFixed(2), '--sway': rand(-45, 45).toFixed(0) + 'px',
        animationDuration: d.toFixed(1) + 's', animationDelay: (-rand(0, d)).toFixed(1) + 's'
      });
    }
    var bokeh = night ? '255,120,175' : '255,255,255';
    for (var j = 0; j < 8; j++) {
      var b = rand(50, 150);
      el('lk-bokeh', ambient, {
        left: rand(-10, 90) + '%', top: rand(0, 90) + '%', width: b + 'px', height: b + 'px',
        background: 'radial-gradient(circle, rgba(' + bokeh + ',.55) 0%, rgba(' + bokeh + ',.18) 45%, rgba(' + bokeh + ',0) 70%)',
        '--o': rand(0.35, 0.75).toFixed(2),
        '--dx': rand(-50, 50).toFixed(0) + 'px', '--dy': rand(-70, 30).toFixed(0) + 'px',
        animationDuration: rand(9, 16).toFixed(1) + 's', animationDelay: (-rand(0, 16)).toFixed(1) + 's'
      });
    }
    var sparkles = night ? 22 : 10;
    for (var k = 0; k < sparkles; k++) {
      var z = rand(8, 15);
      el('lk-twinkle', ambient, {
        left: rand(2, 96) + '%', top: rand(2, 92) + '%', width: z + 'px', height: z + 'px',
        backgroundImage: svg(STAR, night ? '#FFF6D8' : '#FFFFFF'),
        '--o': rand(0.5, 0.95).toFixed(2),
        animationDuration: rand(2.5, 5).toFixed(1) + 's', animationDelay: (-rand(0, 5)).toFixed(1) + 's'
      });
    }
  }

  function faller(cls, style, duration, spin) {
    var d = duration();
    style.left = rand(-3, 98) + '%';
    style['--sway'] = rand(-60, 60).toFixed(0) + 'px';
    style['--spin'] = spin().toFixed(0) + 'deg';
    style.animationDuration = d.toFixed(1) + 's';
    style.animationDelay = (-rand(0, d)).toFixed(1) + 's';
    return el('lk-fall ' + cls, seasonLayer, style);
  }

  function buildSeason() {
    seasonLayer.innerHTML = '';
    if (fireworks) { clearInterval(fireworks); fireworks = null; }
    if (reduce) return;
    var i, s;
    if (season === 'snow') {
      for (i = 0; i < 34; i++) {
        s = rand(3, 9);
        faller('lk-flake', { width: s + 'px', height: s + 'px', opacity: rand(0.6, 1).toFixed(2) },
          function () { return rand(10, 20); }, function () { return 0; });
      }
    } else if (season === 'sakura') {
      for (i = 0; i < 22; i++) {
        s = rand(11, 18);
        faller('lk-petal', { width: s + 'px', height: (s * 0.85) + 'px' },
          function () { return rand(9, 16); }, function () { return rand(-540, 540); });
      }
    } else if (season === 'hearts') {
      var colors = ['#F2456F', '#FF7BA3', '#FFA9C4', '#D9418F'];
      for (i = 0; i < 26; i++) {
        s = rand(12, 24);
        faller('lk-rain', { width: s + 'px', height: s + 'px', backgroundImage: svg(HEART, colors[i % 4]) },
          function () { return rand(7, 13); }, function () { return rand(-120, 120); });
      }
    } else if (season === 'fireworks') {
      startFireworks();
    }
  }

  function boom() {
    if (!active || document.hidden) return;
    var colors = ['#FFD36E', '#FF6F98', '#FF3B3B', '#FFFFFF', '#FFB347', '#C59BFF'];
    var x = rand(12, 88), y = rand(10, 45);
    var color = colors[Math.floor(rand(0, colors.length))];
    var n = 28;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      var r = rand(75, 135);
      var p = el('lk-boom', seasonLayer, {
        left: x + '%', top: y + '%', background: i % 4 === 0 ? '#FFFFFF' : color,
        boxShadow: '0 0 6px ' + color,
        '--dx': (Math.cos(a) * r).toFixed(0) + 'px', '--dy': (Math.sin(a) * r + 30).toFixed(0) + 'px'
      });
      p.addEventListener('animationend', function (e) { e.target.remove(); });
    }
  }

  function startFireworks() {
    if (fireworks || season !== 'fireworks' || !active || reduce) return;
    boom();
    fireworks = setInterval(boom, 1200);
  }

  window.lynnKarkarBg = {
    setActive: function (on) {
      active = !!on;
      if (!ready()) return;
      root.classList.toggle('lk-paused', !active);
      if (active) startFireworks();
      else if (fireworks) { clearInterval(fireworks); fireworks = null; }
    },
    setNight: function (on) {
      on = !!on;
      if (!ready() || on === night) return;
      night = on;
      root.classList.toggle('lk-night', night);
      document.body.classList.toggle('lk-night', night);
      buildAmbient();
      paintBackdrop();
    },
    setSeason: function (name) {
      name = name || '';
      if (!ready() || name === season) return;
      season = name;
      buildSeason();
    },
    float: function (emoji, count) {
      if (!ready() || reduce || !emoji) return;
      var list = String(emoji).split(' ').filter(Boolean);
      var n = Math.min(Math.max(Number(count) || 8, 1), 60);
      for (var i = 0; i < n; i++) {
        var f = el('lk-float', floatLayer, {
          left: rand(6, 86) + '%', fontSize: rand(26, 46).toFixed(0) + 'px',
          '--sway': rand(-50, 50).toFixed(0) + 'px',
          animationDuration: rand(6, 9).toFixed(1) + 's',
          animationDelay: (i * 0.22 + rand(0, 0.6)).toFixed(2) + 's'
        });
        f.textContent = list[i % list.length];
        f.addEventListener('animationend', function (e) { e.target.remove(); });
      }
    },
    setBackdrop: function (style, look, url) {
      chosen = { style: String(style || 'dreamy'), look: String(look || 'splash'), url: String(url || '') };
      if (ready()) paintBackdrop();
    }
  };

  // The loading screen in index.html: gone once Flutter has drawn (the Us tab is see-through).
  window.addEventListener('flutter-first-frame', function () {
    var splash = document.getElementById('splash');
    if (splash) splash.remove();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
