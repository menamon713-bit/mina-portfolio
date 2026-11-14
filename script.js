(function () {
  'use strict';

  // ═══ بيانات التواصل (Base64 = تمويه فقط وليس تشفير) ═══
  var DATA = Object.freeze({
    n: "bWluYQ==",
    e: "bWluYWRldmVsb3BlcjQzQGdtYWlsLmNvbQ==",
    p: "KzIwMTU1NDQxNjA5NA==",
    w: "MjAxNTU0NDE2MDk0"
  });

  function dec(str) {
    try { return atob(str); } catch (err) { return ''; }
  }

  // ═══ تطبيق الاسم في صفحة "عني" ═══
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('aboutName');
    if (!el) return;
    el.textContent = '';
    var bold = function (t) {
      var s = document.createElement('strong');
      s.textContent = t;
      return s;
    };
    el.append('أنا ', bold(dec(DATA.n) + ' (M.A.S.H)'), '، باحث أمني مستقل من ', bold('سوهاج، مصر'),
      '. تعلمت الأمن السيبراني بنفسي، وعندي شغف كبير بـ ', bold('الـ Red Teaming'), ' وأمن تطبيقات الويب.');
  });

  // ═══ حماية من الضغط المتكرر على أزرار التواصل ═══
  var lastContact = 0;
  function throttled() {
    var now = Date.now();
    if (now - lastContact < 1500) return true;
    lastContact = now;
    return false;
  }

  // ═══ دوال التواصل ═══
  function handleWhatsApp() {
    if (throttled()) return;
    var phone = dec(DATA.w);
    if (!/^\d{8,15}$/.test(phone)) return;
    var msg = encodeURIComponent('السلام عليكم، عايز أتكلم معاك في مشروع');
    var webUrl = 'https://wa.me/' + phone + '?text=' + msg;

    // أندرويد: رابط intent بيظهر قائمة "فتح باستخدام" (واتساب / واتساب للأعمال)
    // ولو مفيش أي تطبيق، المتصفح بيروح لـ wa.me تلقائيًا (من غير فتح مرتين)
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = 'intent://send?phone=' + phone + '&text=' + msg +
        '#Intent;scheme=whatsapp;S.browser_fallback_url=' + encodeURIComponent(webUrl) + ';end';
      return;
    }

    // آيفون والكمبيوتر: wa.me
    window.location.href = webUrl;
  }

  function handlePhone() {
    if (throttled()) return;
    var phone = dec(DATA.p);
    if (!/^\+?\d{8,15}$/.test(phone)) return;
    window.location.href = 'tel:' + phone;
  }

  function handleEmail() {
    if (throttled()) return;
    var email = dec(DATA.e);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    window.location.href = 'mailto:' + email;
  }

  // ═══ Theme Toggle ═══
  var themeToggle = document.getElementById('themeToggle');
  var html = document.documentElement;

  function setTheme(mode) {
    if (mode === 'light') {
      html.setAttribute('data-theme', 'light');
      themeToggle.textContent = '☀️';
    } else {
      html.removeAttribute('data-theme');
      themeToggle.textContent = '🌙';
    }
    try { localStorage.setItem('theme', mode); } catch (err) {}
  }

  try {
    if (localStorage.getItem('theme') === 'light') {
      html.setAttribute('data-theme', 'light');
      themeToggle.textContent = '☀️';
    }
  } catch (err) {}

  themeToggle.addEventListener('click', function () {
    setTheme(html.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });

  // ═══ Intro Animation ═══
  (function () {
    var container = document.getElementById('introName');
    var intro = document.getElementById('intro');
    if (!container || !intro) return;

    'M.A.S.H'.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = 'intro-letter';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.animationDelay = (0.4 + i * 0.12) + 's';
      container.appendChild(span);
    });

    setTimeout(function () {
      intro.classList.add('hide');
      setTimeout(function () { intro.style.display = 'none'; }, 1000);
    }, 4500);
  })();

  // ═══ Sidebar ═══
  var menuBtn = document.getElementById('menuBtn');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  menuBtn.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', closeSidebar);

  // ═══ التنقل بين الصفحات (مع whitelist) ═══
  var ALLOWED_PAGES = ['home', 'about', 'skills', 'projects', 'contact'];
  var navBtns = document.querySelectorAll('.nav-btn');

  navBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pageId = this.getAttribute('data-page');
      if (ALLOWED_PAGES.indexOf(pageId) === -1) return;
      var target = document.getElementById('page-' + pageId);
      if (!target) return;

      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      target.classList.add('active');
      navBtns.forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      closeSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (pageId === 'skills') {
        setTimeout(function () {
          document.querySelectorAll('.skill-bar-fill').forEach(function (bar, i) {
            bar.style.transition = 'none';
            bar.style.transform = 'scaleX(0)';
            setTimeout(function () {
              bar.style.transition = 'transform 1s cubic-bezier(.34,1.56,.64,1)';
              bar.style.transform = 'scaleX(1)';
            }, 100 + i * 100);
          });
        }, 100);
      }
    });
  });

  // ═══ Modals ═══
  function modalToggle(id, show) {
    var m = document.getElementById(id);
    if (m) m.classList[show ? 'add' : 'remove']('show');
  }
  function openReport()  { modalToggle('reportModal', true); }
  function closeReport() { modalToggle('reportModal', false); }
  function openRecon()   { modalToggle('reconModal', true); }
  function closeRecon()  { modalToggle('reconModal', false); }

  ['reportModal', 'reconModal'].forEach(function (id) {
    var m = document.getElementById(id);
    if (m) m.addEventListener('click', function (e) {
      if (e.target === m) modalToggle(id, false);
    });
  });

  // ═══ Scroll Reveal ═══
  document.addEventListener('DOMContentLoaded', function () {
    var reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (r) { r.classList.add('visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(function (r) { observer.observe(r); });
  });

  // ═══ ربط الأزرار (data-action) ═══
  var actions = Object.freeze({
    'open-report': openReport, 'close-report': closeReport,
    'open-recon': openRecon, 'close-recon': closeRecon,
    'whatsapp': handleWhatsApp, 'phone': handlePhone, 'email': handleEmail
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var name = t.getAttribute('data-action');
    if (Object.prototype.hasOwnProperty.call(actions, name)) actions[name]();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeReport(); closeRecon(); }
  });

  // ═══ بدائل الصور ═══
  function applyFallback(img) {
    if (img.getAttribute('data-fallback') === 'initials') {
      img.style.display = 'none';
      if (img.parentElement) img.parentElement.textContent = 'M.A.S.H';
    } else {
      img.style.display = 'none';
    }
  }
  document.querySelectorAll('img[data-fallback]').forEach(function (img) {
    img.addEventListener('error', function () { applyFallback(img); });
    if (img.complete && img.naturalWidth === 0) applyFallback(img);
  });
})();
