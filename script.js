// ═══ البيانات الحساسة (مشفرة بطريقة Base64) ═══
const _0x1a2 = {
  n: "bWluYQ==", // مينا
  e: "bWluYWRldmVsb3BlcjQzQGdtYWlsLmNvbQ==", // الإيميل
  p: "KzIwMTU1NDQxNjA5NA==", // الرقم المحلي بالكود الدولي
  w: "MjAxNTU0NDE2MDk0" // الرقم الدولي للواتساب
};

function _dec(str) { return atob(str); }
function _getName() { return _dec(_0x1a2.n); }

// ═══ تطبيق البيانات المفكوكة عند تحميل الصفحة ═══
document.addEventListener("DOMContentLoaded", function() {
  const el = document.getElementById('aboutName');
  if (el) {
    el.textContent = '';
    const bold = function(t){ const s = document.createElement('strong'); s.textContent = t; return s; };
    el.append('أنا ', bold(_getName() + ' (M.A.S.H)'), '، باحث أمني مستقل من ', bold('سوهاج، مصر'),
      '. تعلمت الأمن السيبراني بنفسي، وعندي شغف كبير بـ ', bold('الـ Red Teaming'), ' وأمن تطبيقات الويب.');
  }
});

// ═══ دوال التواصل المباشر ═══
function handleWhatsApp() {
  var phone = _dec(_0x1a2.w); 
  var message = encodeURIComponent("السلام عليكم، عايز أتكلم معاك في مشروع");
  
  // 1. محاولة فتح تطبيق الواتساب العادي (المسنجر) الأول
  var normalAppUrl = "whatsapp://send?phone=" + phone + "&text=" + message;
  
  // 2. لو التطبيق العادي مش موجود، نفتح الواتساب ويب
  var webUrl = "https://wa.me/" + phone + "?text=" + message;

  // محاولة فتح التطبيق العادي
  window.location.href = normalAppUrl;

  // بعد ثانية ونص، لو التطبيق مفتحش، نفتح الواتساب ويب
  setTimeout(function() {
    window.open(webUrl, '_blank');
  }, 1500);
}

function handlePhone() {
  var phone = _dec(_0x1a2.p);
  window.location.href = "tel:" + phone;
}

function handleEmail() {
  var email = _dec(_0x1a2.e);
  window.location.href = "mailto:" + email;
}

// ═══ Theme Toggle Logic ═══
var themeToggle = document.getElementById('themeToggle');
var html = document.documentElement;

try {
  if (localStorage.getItem('theme') === 'light') {
    html.setAttribute('data-theme', 'light');
    themeToggle.textContent = '☀️';
  }
} catch (e) {}

themeToggle.addEventListener('click', function() {
    if (html.getAttribute('data-theme') === 'light') {
        html.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    } else {
        html.setAttribute('data-theme', 'light');
        themeToggle.textContent = '☀️';
        try { localStorage.setItem('theme', 'light'); } catch (e) {}
    }
});

// ═══ Intro Animation (حوالي 4.5 ثانية) ═══
(function(){
  var name = "M.A.S.H";
  var container = document.getElementById('introName');
  var chars = name.split('');
  
  chars.forEach(function(char, i){
    var span = document.createElement('span');
    span.className = 'intro-letter';
    if(char === ' '){ span.innerHTML = '&nbsp;'; } else { span.textContent = char; }
    span.style.animationDelay = (0.4 + i * 0.12) + 's';
    container.appendChild(span);
  });
  
  // اختفاء الأنيميشن بعد 4.5 ثانية
  setTimeout(function(){
    document.getElementById('intro').classList.add('hide');
    setTimeout(function(){ document.getElementById('intro').style.display = 'none'; }, 1000);
  }, 4500);
})();

// ═══ Sidebar Toggle ═══
var menuBtn = document.getElementById('menuBtn');
var sidebar = document.getElementById('sidebar');
var overlay = document.getElementById('overlay');
menuBtn.addEventListener('click', function(){
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
});
overlay.addEventListener('click', function(){
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
});

// ═══ Navigation & Scroll Reveal ═══
var navBtns = document.querySelectorAll('.nav-btn');
navBtns.forEach(function(btn){
  btn.addEventListener('click', function(){
    var pageId = this.getAttribute('data-page');
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    document.getElementById('page-' + pageId).classList.add('active');
    navBtns.forEach(function(b){ b.classList.remove('active'); });
    this.classList.add('active');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    window.scrollTo({top:0, behavior:'smooth'});
    
    if(pageId === 'skills'){
      setTimeout(function(){
        document.querySelectorAll('.skill-bar-fill').forEach(function(bar, i){
          bar.style.transition = 'none';
          bar.style.transform = 'scaleX(0)';
          setTimeout(function(){
            bar.style.transition = 'transform 1s cubic-bezier(.34,1.56,.64,1)';
            bar.style.transform = 'scaleX(1)';
          }, 100 + i * 100);
        });
      }, 100);
    }
  });
});

// ═══ Modal Logic for Security Report ═══
function openReportModal() {
  document.getElementById('reportModal').classList.add('show');
}
function closeReportModal() {
  document.getElementById('reportModal').classList.remove('show');
}
document.getElementById('reportModal').addEventListener('click', function(e) {
  if (e.target === this) closeReportModal();
});

// ═══ Modal Logic for ReconXplorer ═══
function openReconModal() {
  document.getElementById('reconModal').classList.add('show');
}
function closeReconModal() {
  document.getElementById('reconModal').classList.remove('show');
}
document.getElementById('reconModal').addEventListener('click', function(e) {
  if (e.target === this) closeReconModal();
});

// ═══ Scroll Reveal Observer ═══
document.addEventListener("DOMContentLoaded", function() {
  var reveals = document.querySelectorAll(".reveal");
  
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target); 
    }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  reveals.forEach(function(reveal) {
    observer.observe(reveal);
  });
});


// ═══ ربط الأزرار (بدل onclick المضمّنة، علشان الـ CSP) ═══
(function(){
  var actions = {
    'open-report': openReportModal, 'close-report': closeReportModal,
    'open-recon': openReconModal, 'close-recon': closeReconModal,
    'whatsapp': handleWhatsApp, 'phone': handlePhone, 'email': handleEmail
  };
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-action]');
    if (t && actions[t.getAttribute('data-action')]) actions[t.getAttribute('data-action')]();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') { closeReportModal(); closeReconModal(); }
  });

  // بدائل الصور لو فشل التحميل
  function applyFallback(img){
    if (img.getAttribute('data-fallback') === 'initials') {
      img.style.display = 'none';
      if (img.parentElement) img.parentElement.textContent = 'M.A.S.H';
    } else { img.style.display = 'none'; }
  }
  document.querySelectorAll('img[data-fallback]').forEach(function(img){
    img.addEventListener('error', function(){ applyFallback(img); });
    if (img.complete && img.naturalWidth === 0) applyFallback(img);
  });
})();
