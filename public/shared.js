// Shared JS for all Rhozeland pages
// Embedded sections inherit the outer homepage frame instead of adding a second gutter.
(function(){
  var embedded = new URLSearchParams(location.search).get('embed') === '1';
  try { embedded = embedded || window.self !== window.top; } catch(e) { embedded = true; }
  document.documentElement.classList.toggle('site-embedded', embedded);
})();

// The floating booking action belongs on the landing page only.
(function(){
  function mountBookingAction(){
    if (!/^(?:\/(?:index\.html)?)$/.test(location.pathname)) return;
    if (!document.querySelector('.site-nav') || document.querySelector('.site-book-float')) return;
    var link = document.createElement('a');
    link.className = 'site-book-float';
    link.href = '/book.html';
    link.setAttribute('aria-label', 'Book a project');
    link.innerHTML = '<span class="site-book-float__mark" aria-hidden="true">✳</span><span>Book a project</span>';
    document.body.appendChild(link);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBookingAction);
  else mountBookingAction();
})();

// Create modal — injected once on every page
(function(){
  // Pool of recent projects — 3 random are picked each time the modal opens
  var producePool = [
    { img: '/images/ooak-the-mask-thumb.webp', tag: 'Music Video', title: 'The Mask', artist: 'Ooak' },
    { img: '/images/fingaz-mansa-musa-thumb.webp', tag: 'Music Video', title: 'Mansa Musa', artist: 'MONEE FINGAZ' },
    { img: '/images/rhozeland-fus-thumb.webp', tag: 'EP', title: 'FUS', artist: 'Rhozeland' },
    { img: '/images/holy-water-thumb.webp', tag: 'Music Video', title: 'Holy Water', artist: 'Cozal' },
    { img: '/images/vampurp-2027-thumb.webp', tag: 'Music Video', title: '2027', artist: 'Vampurp' },
    { img: '/images/fingaz-superhero-thumb.webp', tag: 'Music Video', title: 'Feel Like A Superhero', artist: 'MONEE FINGAZ' },
    { img: '/images/carina-lucky-charm-thumb.webp', tag: 'Music Video', title: 'Lucky Charm', artist: 'Carina' },
    { img: '/images/steelo-u-outta-know-thumb.webp', tag: 'Music Video', title: 'U Outta Know', artist: 'YOUNG $TEELO' },
    { img: '/images/rc1-thumb.webp', tag: 'Campaign', title: "Who Runs The World?", artist: "Runner's Club" },
    { img: '/images/straightdizzy-the-only-reason-thumb.webp', tag: 'Music Video', title: 'The Only Reason', artist: 'Straightdizzy' },
    { img: '/images/bk-whiskey-mma-thumb.webp', tag: 'Campaign', title: 'United MMA', artist: 'BK Whiskey' },
    { img: '/images/ooak-saint-flair-west-thumb.webp', tag: 'Album', title: 'Saint Flair West', artist: 'Ooak' }
  ];
  var produceSlides = pickRandom(producePool, 3);
  function pickRandom(arr, n){
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy.slice(0, n);
  }
  function reshuffleProduce(){ produceSlides = pickRandom(producePool, 3); }

  // Distribute card — Creator OS preview rotates through content types
  var EQ_HTML = (function(){
    var bars = '';
    for (var i = 0; i < 10; i++) {
      bars += '<span></span>';
    }
    return bars;
  })();
  var ICON = {
    music: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    drop: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>',
    space: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    event: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    rewards: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5h-4a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3h-4M12 7.5V9M12 15v1.5"/></svg>'
  };
  var INDICATOR = {
    music: EQ_HTML,
    drop: '<span style="font-size:0.5rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85)">Out now · Album</span>',
    space: '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.5rem;font-weight:600;color:rgba(255,255,255,0.85)"><span style="width:6px;height:6px;border-radius:50%;background:hsl(135 80% 55%);animation:cm-eq 1.4s ease-in-out infinite"></span>12 in space</span>',
    event: '<span style="font-size:0.5rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85)">Sat · 8 PM · RSVP</span>',
    rewards: '<span style="position:relative;display:block;height:5px;width:100%;border-radius:999px;background:rgba(255,255,255,0.15);overflow:hidden"><span style="position:absolute;inset:0;width:62%;border-radius:999px;background:linear-gradient(90deg,hsl(48 95% 60%),hsl(330 90% 60%))"></span></span>'
  };
  var distSlides = [
    { kind:'music',   tag: 'Now Playing',     title: 'FUS — Rhozeland',         cover: 'radial-gradient(120% 80% at 0% 0%, hsl(330 90% 65% / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(200 90% 60% / 0.85), transparent 60%), linear-gradient(135deg, hsl(280 70% 35%), hsl(20 80% 45%))' },
    { kind:'drop',    tag: 'New Drop',        title: 'Saint Flair West · Ooak', cover: 'radial-gradient(120% 80% at 0% 0%, hsl(20 95% 60% / 0.9), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(330 85% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(340 70% 35%), hsl(10 80% 45%))' },
    { kind:'space',   tag: 'Live Space',      title: 'Creator Roundtable · 12', cover: 'radial-gradient(120% 80% at 0% 0%, hsl(160 80% 55% / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(200 90% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(190 70% 30%), hsl(150 70% 35%))' },
    { kind:'event',   tag: 'Upcoming Event',  title: 'Land Sessions · LA',      cover: 'radial-gradient(120% 80% at 0% 0%, hsl(48 95% 60% / 0.9), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(20 90% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(30 80% 35%), hsl(48 80% 45%))' },
    { kind:'rewards', tag: '$Rhoze Rewards',  title: 'Tier 3 · Citizen +250',   cover: 'radial-gradient(120% 80% at 0% 0%, hsl(48 95% 65% / 0.95), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(330 90% 60% / 0.85), transparent 60%), linear-gradient(135deg, hsl(48 80% 40%), hsl(20 85% 45%))' }
  ];
  var distIdx = 0;
  var distTimer = null;
  function applyDistSlide(i){
    var modal = document.getElementById('createModal');
    if (!modal) return;
    var cover = modal.querySelector('.cm-app__cover');
    var tag = modal.querySelector('.cm-app__tag');
    var title = modal.querySelector('.cm-app__drop-title');
    var meta = modal.querySelector('.cm-app__player-meta');
    var eq = modal.querySelector('.cm-app__eq');
    var play = modal.querySelector('.cm-app__play');
    if (!cover || !tag || !title || !meta) return;
    var s = distSlides[i % distSlides.length];
    meta.style.transition = 'opacity .28s ease, transform .28s ease';
    cover.style.transition = 'opacity .35s ease';
    if (play) play.style.transition = 'opacity .28s ease';
    meta.style.opacity = '0';
    meta.style.transform = 'translateY(-3px)';
    cover.style.opacity = '0';
    if (play) play.style.opacity = '0';
    setTimeout(function(){
      tag.textContent = s.tag;
      title.textContent = s.title;
      cover.style.background = s.cover;
      if (eq) {
        // Swap class so non-music slides don't inherit `.cm-app__eq span` height animation
        eq.className = s.kind === 'music' ? 'cm-app__eq' : 'cm-app__indicator';
        if (s.kind !== 'music') {
          eq.style.cssText = 'display:flex;align-items:center;gap:6px;height:10px;margin-top:1px';
        } else {
          eq.style.cssText = '';
        }
        eq.innerHTML = INDICATOR[s.kind] || '';
      }
      if (play) play.innerHTML = ICON[s.kind] || ICON.music;
      meta.style.opacity = '1';
      meta.style.transform = 'translateY(0)';
      cover.style.opacity = '1';
      if (play) play.style.opacity = '1';
    }, 200);
  }
  function startDistAuto(){
    stopDistAuto();
    distIdx = 0;
    applyDistSlide(0);
    distTimer = setInterval(function(){ distIdx = (distIdx + 1) % distSlides.length; applyDistSlide(distIdx); }, 2800);
  }
  function stopDistAuto(){ if (distTimer) { clearInterval(distTimer); distTimer = null; } }

  function ensureModal(){
    var existing = document.getElementById('createModal');
    if (existing) existing.parentNode.removeChild(existing);
    var arrow = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>';
    var slidesHtml = produceSlides.map(function(s, i){
      return '<div class="cm-slide' + (i===0?' is-active':'') + '" data-cm-slide="' + i + '">'
        + '<img src="' + s.img + '" alt="' + s.title + ' — ' + s.artist + '" loading="lazy" />'
        + '<div class="cm-slide__meta">'
        +   '<span class="cm-slide__tag">' + s.tag + '</span>'
        +   '<div class="cm-slide__title">' + s.title + '</div>'
        +   '<div class="cm-slide__artist">' + s.artist + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    var dotsHtml = produceSlides.map(function(_, i){
      return '<button type="button" class="cm-dot' + (i===0?' is-active':'') + '" data-cm-dot="' + i + '" aria-label="Slide ' + (i+1) + '"></button>';
    }).join('');

    var html = ''
      + '<div class="create-modal" id="createModal" role="dialog" aria-modal="true" aria-labelledby="createModalTitle" hidden>'
      +   '<div class="create-modal__overlay" data-create-close></div>'
      +   '<div class="create-modal__panel">'
      +     '<div class="create-modal__rainbow" aria-hidden="true"></div>'
      +     '<div class="create-modal__inner">'
      +       '<div class="create-modal__head" style="justify-content:flex-end">'
      +         '<button type="button" class="create-modal__close" aria-label="Close" data-create-close>'
      +           '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
      +         '</button>'
      +       '</div>'
      +       '<h2 id="createModalTitle" class="create-modal__title">What are we building next?</h2>'
      +       '<div class="create-modal__grid">'
      +         '<a class="create-card create-card--visual" href="/start.html">'
      +           '<div class="cm-visual cm-visual--produce">'
      +             '<div class="cm-slides" id="cmProduceSlides">' + slidesHtml + '</div>'
      +             '<div class="cm-dots">' + dotsHtml + '</div>'
      +           '</div>'
      +           '<div class="create-card__body create-card__body--compact">'
      +             '<span class="create-card__arrow" aria-hidden="true">' + arrow + '</span>'
      +             '<h3 class="create-card__title">Produce</h3>'
      +             '<p class="create-card__desc create-card__desc--hover">Studio, visuals, rollout, launch planning.</p>'
      +           '</div>'
      +         '</a>'
      +         '<a class="create-card create-card--visual" href="https://rhozeland.app/" target="_blank" rel="noopener noreferrer">'
      +           '<div class="cm-visual cm-visual--distribute">'
      +             '<div class="cm-app">'
      +               '<div class="cm-app__bar">'
      +                 '<span class="cm-app__brand"><span class="cm-app__logo"></span><span class="cm-app__brand-text">Creator OS</span></span>'
      +                 '<span class="cm-app__live"><span class="cm-app__live-dot"></span>LIVE</span>'
      +               '</div>'
      +               '<div class="cm-app__body">'
      +                 '<div class="cm-app__player">'
      +                   '<div class="cm-app__cover"></div>'
      +                   '<div class="cm-app__player-meta">'
      +                     '<span class="cm-app__tag">Now Playing</span>'
      +                     '<div class="cm-app__drop-title">FUS — Rhozeland</div>'
      +                     '<div class="cm-app__eq" aria-hidden="true">'
      +                       '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>'
      +                     '</div>'
      +                   '</div>'
      +                   '<button type="button" class="cm-app__play" tabindex="-1" aria-hidden="true">'
      +                     '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
      +                   '</button>'
      +                 '</div>'
      +               '</div>'
      +             '</div>'
      +           '</div>'
      +           '<div class="create-card__body create-card__body--compact">'
      +             '<span class="create-card__arrow" aria-hidden="true">' + arrow + '</span>'
      +             '<h3 class="create-card__title">Distribute</h3>'
      +             '<p class="create-card__desc create-card__desc--hover">Publish, connect, and keep your release moving.</p>'
      +           '</div>'
      +         '</a>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    var modal = document.getElementById('createModal');
    modal.addEventListener('click', function(e){
      var dot = e.target.closest('[data-cm-dot]');
      if (dot) { e.preventDefault(); setProduceSlide(parseInt(dot.getAttribute('data-cm-dot'), 10)); return; }
      if (e.target.closest('[data-create-close]')) closeCreateModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeCreateModal();
    });
  }

  var produceIdx = 0;
  var produceTimer = null;
  function setProduceSlide(i){
    var slides = document.querySelectorAll('#cmProduceSlides .cm-slide');
    var dots = document.querySelectorAll('#createModal .cm-dot');
    if (!slides.length) return;
    produceIdx = ((i % slides.length) + slides.length) % slides.length;
    slides.forEach(function(el, idx){ el.classList.toggle('is-active', idx === produceIdx); });
    dots.forEach(function(el, idx){ el.classList.toggle('is-active', idx === produceIdx); });
  }
  function startProduceAuto(){
    stopProduceAuto();
    produceTimer = setInterval(function(){ setProduceSlide(produceIdx + 1); }, 3200);
  }
  function stopProduceAuto(){
    if (produceTimer) { clearInterval(produceTimer); produceTimer = null; }
  }

  function open(){
    reshuffleProduce();
    ensureModal();
    var m = document.getElementById('createModal');
    if (!m) return;
    m.hidden = false;
    requestAnimationFrame(function(){ m.classList.add('is-open'); });
    document.documentElement.style.overflow = 'hidden';
    produceIdx = 0;
    setProduceSlide(0);
    startProduceAuto();
    startDistAuto();
  }
  function close(){
    var m = document.getElementById('createModal');
    if (!m) return;
    m.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    stopProduceAuto();
    stopDistAuto();
    setTimeout(function(){ if (!m.classList.contains('is-open')) m.hidden = true; }, 220);
  }
  window.openCreateModal = open;
  window.closeCreateModal = close;
  if (document.readyState !== 'loading') ensureModal();
  else document.addEventListener('DOMContentLoaded', ensureModal);
})();


// System-preference dark mode with manual override
(function() {
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var override = localStorage.getItem('theme-override');
    if (override === 'light' || override === 'dark') {
      document.documentElement.classList.toggle('dark', override === 'dark');
      return;
    }
    document.documentElement.classList.toggle('dark', !!(mq && mq.matches));
  }
  applyTheme();
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  window.applyTheme = applyTheme;
})();

// Theme toggle
function toggleTheme() {
  var isDark = document.documentElement.classList.contains('dark');
  var newMode = isDark ? 'light' : 'dark';
  localStorage.setItem('theme-override', newMode);
  document.documentElement.classList.toggle('dark', newMode === 'dark');
  // Update toggle button icon
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = newMode === 'dark'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> <span>Light</span>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> <span>Dark</span>';
  }
}

// Mobile menu
function toggleMenu() {
  var menu = document.getElementById('mobileMenu');
  var button = document.querySelector('.menu-toggle');
  var isOpen = menu.classList.toggle('open');
  if (button) button.setAttribute('aria-expanded', String(isOpen));
}

function closeMenu() {
  var menu = document.getElementById('mobileMenu');
  var button = document.querySelector('.menu-toggle');
  menu.classList.remove('open');
  if (button) button.setAttribute('aria-expanded', 'false');
}

function closeMobile() {
  closeMenu();
}

// Copy address
function copyAddress(btn, text) {
  navigator.clipboard.writeText(text).then(function() {
    var icon = btn.querySelector('svg');
    if (icon) {
      var original = icon.innerHTML;
      icon.innerHTML = '<polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      setTimeout(function() { icon.innerHTML = original; }, 2000);
    }
  });
}

// Scroll-triggered fade-in animations
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '-50px' });

document.querySelectorAll('.fade-in').forEach(function(el) {
  observer.observe(el);
});

// Count-up animation
function animateCountUp(el) {
  var target = parseInt(el.getAttribute('data-target'));
  var duration = 2000;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

function setupHoverVideos() {
  document.querySelectorAll('[data-hover-video]').forEach(function(card) {
    if (card.dataset.hoverVideoBound === 'true') return;

    var video = card.querySelector('.work-video');
    if (!video) return;

    card.dataset.hoverVideoBound = 'true';

    function startPreview() {
      card.classList.add('is-hover-preview');
      video.currentTime = 0;
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function() {
          card.classList.remove('is-hover-preview');
        });
      }
    }

    function stopPreview() {
      card.classList.remove('is-hover-preview');
      video.pause();
      video.currentTime = 0;
    }

    card.addEventListener('mouseenter', startPreview);
    card.addEventListener('mouseleave', stopPreview);
    card.addEventListener('focusin', startPreview);
    card.addEventListener('focusout', stopPreview);
  });
}

var countObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      animateCountUp(entry.target);
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.count-up').forEach(function(el) {
  countObserver.observe(el);
});

// Update theme toggle button on load
document.addEventListener('DOMContentLoaded', function() {
  var isDark = document.documentElement.classList.contains('dark');
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = isDark
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> <span>Light</span>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> <span>Dark</span>';
  }

  setupHoverVideos();
});

setupHoverVideos();
// Same account controls as the React menu: Sign in, or My profile + Sign out.
(function(){
  var KEY = 'sb-hdlpvcsxyxirywjkhsui-auth-token';
  function session(){ try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.access_token ? s : null; } catch(e) { return null; } }
  function signOut(e){ e.preventDefault(); localStorage.removeItem(KEY); location.reload(); }
  function mount(){
    var nav = document.querySelector('.site-nav');
    if (!nav || nav.querySelector('.sn-brand')) return;
    var legacyHud = document.getElementById('rSignedInHUD');
    if (legacyHud) legacyHud.remove();
    var cta = nav.querySelector('.nav-cta');
    var menu = document.getElementById('mobileMenu');
    var mCta = menu && Array.prototype.find.call(menu.querySelectorAll('a'), function(a){ return /sign in/i.test(a.textContent); });
    var sess = session();
    var signedIn = !!sess;
    function build(cls){
      var wrap = document.createDocumentFragment();
      if (!signedIn) { var a = document.createElement('a'); a.className = cls; a.href = '/me'; a.textContent = 'Sign in'; wrap.appendChild(a); return wrap; }
      // Same gray account cluster as the landing page: profile identity + Messages.
      var w = document.createElement('div'); w.className = 'nav-auth-wrap';
      var cluster = document.createElement('div'); cluster.className = 'nav-auth'; cluster.setAttribute('role', 'group'); cluster.setAttribute('aria-label', 'Your Rhozeland account');
      var b = document.createElement('a'); b.href = '/me'; b.className = 'nav-auth-identity'; b.setAttribute('aria-label', 'My profile'); b.title = 'Your profile';
      var meta = (sess.user && sess.user.user_metadata) || {};
      var fullName = meta.display_name || meta.full_name || (sess.user && sess.user.email) || 'You';
      var firstName = String(fullName).split(/\s|@/)[0] || 'You';
      b.innerHTML = '<span class="nav-auth-avatar" aria-hidden="true">' + (firstName.charAt(0) || 'R').toUpperCase() + '</span><span class="nav-auth-name">' + firstName.replace(/</g, '&lt;') + '</span>';
      var mm = document.createElement('a'); mm.href = '/messages'; mm.className = 'nav-auth-chip'; mm.setAttribute('aria-label', 'Messages');
      mm.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      cluster.appendChild(mm); cluster.appendChild(b);
      var m = document.createElement('div'); m.className = 'sn-menu'; m.style.display = 'none';
      var p = document.createElement('a'); p.href = '/me?settings=1'; p.textContent = 'Settings';
      var o = document.createElement('button'); o.type = 'button'; o.textContent = 'Sign out'; o.addEventListener('click', signOut);
      m.appendChild(p); m.appendChild(o);
      function showMenu(){ m.style.display = 'flex'; b.setAttribute('aria-expanded', 'true'); }
      function hideMenu(){ m.style.display = 'none'; b.setAttribute('aria-expanded', 'false'); }
      w.addEventListener('mouseenter', showMenu);
      w.addEventListener('mouseleave', hideMenu);
      w.addEventListener('focusin', showMenu);
      w.addEventListener('focusout', function(e){ if (!w.contains(e.relatedTarget)) hideMenu(); });
      w.appendChild(cluster); w.appendChild(m); wrap.appendChild(w);
      // Fill in the profile photo and display name when available.
      try {
        fetch('https://hdlpvcsxyxirywjkhsui.supabase.co/rest/v1/creator_directory?select=photo_url,name&user_id=eq.' + encodeURIComponent(sess.user.id), {
          headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbHB2Y3N4eXhpcnl3amtoc3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTAwMzQsImV4cCI6MjA5Mjk4NjAzNH0.mfI7RcFIMUEH3QzxhtYI7Z2gkm-V2VdKAcGaF6p523w', Authorization: 'Bearer ' + sess.access_token }
        }).then(function(r){ return r.json(); }).then(function(rows){
          var row = rows && rows[0]; if (!row) return;
          var av = b.querySelector('.nav-auth-avatar'), nm = b.querySelector('.nav-auth-name');
          if (row.photo_url && av) av.innerHTML = '<img src="' + row.photo_url + '" alt="" />';
          if (row.name && nm) { var fn = String(row.name).split(/\s|@/)[0]; nm.textContent = fn; if (av && !row.photo_url) av.textContent = (fn.charAt(0) || 'R').toUpperCase(); }
        }).catch(function(){});
      } catch(e) {}
      return wrap;
    }
    if (cta) cta.replaceWith(build('nav-cta'));
    if (mCta) mCta.replaceWith(build(''));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
