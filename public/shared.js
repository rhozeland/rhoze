// Shared JS for all Rhozeland pages

// Create modal — injected once on every page
(function(){
  var produceShots = [
    { src: '/images/ooak-the-mask-thumb.jpg',       title: 'The Mask',     artist: 'Ooak',          tag: 'Music Video' },
    { src: '/images/fingaz-mansa-musa-thumb.png',   title: 'Mansa Musa',   artist: 'MONEE FINGAZ',  tag: 'Music Video' },
    { src: '/images/iimpct-media-thumb.png',        title: 'iiMPCT Media', artist: 'In Studio',     tag: 'Web Series' },
    { src: '/images/carina-lucky-charm-thumb.jpg',  title: 'Lucky Charm',  artist: 'Carina',        tag: 'Single' },
    { src: '/images/cozal-holy-water-thumb.png',    title: 'Holy Water',   artist: 'Cozal',         tag: 'Music Video' }
  ];

  function buildProducePreview(){
    var slides = produceShots.map(function(s, i){
      return ''
        + '<div class="cm-slide' + (i === 0 ? ' is-active' : '') + '" data-cm-slide="' + i + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '">'
        +   '<img src="' + s.src + '" alt="" loading="lazy" />'
        +   '<div class="cm-slide__meta">'
        +     '<span class="cm-slide__tag">' + s.tag + '</span>'
        +     '<div class="cm-slide__title">' + s.title + '</div>'
        +     '<div class="cm-slide__artist">' + s.artist + '</div>'
        +   '</div>'
        + '</div>';
    }).join('');
    var dots = produceShots.map(function(_, i){
      return '<button type="button" class="cm-dot' + (i === 0 ? ' is-active' : '') + '" data-cm-dot="' + i + '" aria-label="Show project ' + (i + 1) + '"></button>';
    }).join('');
    return ''
      + '<div class="cm-visual cm-visual--produce" data-cm-carousel>'
      +   '<div class="cm-slides">' + slides + '</div>'
      +   '<div class="cm-dots" role="tablist" aria-label="Featured projects">' + dots + '</div>'
      + '</div>';
  }

  function buildDistributePreview(){
    return ''
      + '<div class="cm-visual cm-visual--distribute" aria-hidden="true">'
      +   '<div class="cm-app">'
      +     '<div class="cm-app__bar">'
      +       '<span class="cm-app__dot"></span><span class="cm-app__dot"></span><span class="cm-app__dot"></span>'
      +       '<span class="cm-app__url">rhozeland.app <span style="opacity:.55">/ creator</span></span>'
      +     '</div>'
      +     '<div class="cm-app__body">'
      +       '<div class="cm-app__head">'
      +         '<div class="cm-app__brand"><span class="cm-app__logo"></span><span class="cm-app__brand-text">Creator OS</span></div>'
      +         '<span class="cm-app__live"><span class="cm-app__live-dot"></span>LIVE</span>'
      +       '</div>'
      +       '<div class="cm-app__profile">'
      +         '<div class="cm-app__avatar"></div>'
      +         '<div class="cm-app__profile-text">'
      +           '<div class="cm-app__name">Your studio name</div>'
      +           '<div class="cm-app__handle">@yourhandle · 12.4k network</div>'
      +         '</div>'
      +         '<span class="cm-app__cta">Go live</span>'
      +       '</div>'
      +       '<div class="cm-app__tabs">'
      +         '<span class="cm-app__tab is-active">Drops</span>'
      +         '<span class="cm-app__tab">Releases</span>'
      +         '<span class="cm-app__tab">Earnings</span>'
      +         '<span class="cm-app__tab">Network</span>'
      +       '</div>'
      +       '<div class="cm-app__cards">'
      +         '<div class="cm-app__card cm-app__card--a"><div class="cm-app__thumb"></div><div class="cm-app__card-title">New Drop</div><div class="cm-app__card-meta">Live · 2.1k holders</div></div>'
      +         '<div class="cm-app__card cm-app__card--b"><div class="cm-app__thumb"></div><div class="cm-app__card-title">Single</div><div class="cm-app__card-meta">Stream · 48h boost</div></div>'
      +         '<div class="cm-app__card cm-app__card--c"><div class="cm-app__thumb"></div><div class="cm-app__card-title">Earnings</div><div class="cm-app__card-meta">+ $3,290 / wk</div></div>'
      +       '</div>'
      +       '<div class="cm-app__footer">'
      +         '<span class="cm-app__chip">Publish</span>'
      +         '<span class="cm-app__chip">Schedule</span>'
      +         '<span class="cm-app__chip">Collab</span>'
      +         '<span class="cm-app__chip cm-app__chip--accent">$RHOZE rewards</span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  function ensureModal(){
    if (document.getElementById('createModal')) return;
    var arrow = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>';
    var html = ''
      + '<div class="create-modal" id="createModal" role="dialog" aria-modal="true" aria-labelledby="createModalTitle" hidden>'
      +   '<div class="create-modal__overlay" data-create-close></div>'
      +   '<div class="create-modal__panel">'
      +     '<div class="create-modal__rainbow" aria-hidden="true"></div>'
      +     '<div class="create-modal__inner">'
      +       '<div class="create-modal__head">'
      +         '<span class="create-modal__chip">'
      +           '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z"/></svg>'
      +           'Create'
      +         '</span>'
      +         '<button type="button" class="create-modal__close" aria-label="Close" data-create-close>'
      +           '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
      +         '</button>'
      +       '</div>'
      +       '<h2 id="createModalTitle" class="create-modal__title">What are we building next?</h2>'
      +       '<div class="create-modal__grid">'
      +         '<a class="create-card" href="/start.html">'
      +           buildProducePreview()
      +           + '<div class="create-card__body">'
      +             '<div class="create-card__row"><h3 class="create-card__title">Produce</h3><span class="create-card__arrow" aria-hidden="true">' + arrow + '</span></div>'
      +             '<p class="create-card__desc">Start a project with Rhozeland for studio, visuals, rollout support, and launch planning.</p>'
      +           '</div>'
      +         '</a>'
      +         '<a class="create-card" href="https://rhozeland.app/" target="_blank" rel="noopener noreferrer">'
      +           buildDistributePreview()
      +           + '<div class="create-card__body">'
      +             '<div class="create-card__row"><h3 class="create-card__title">Distribute</h3><span class="create-card__arrow" aria-hidden="true">' + arrow + '</span></div>'
      +             '<p class="create-card__desc">Open the creator app to publish, connect, and keep your release moving through the network.</p>'
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
      if (e.target.closest('[data-create-close]')) closeCreateModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeCreateModal();
    });
    // Carousel
    var carousel = modal.querySelector('[data-cm-carousel]');
    if (carousel) {
      var slides = carousel.querySelectorAll('.cm-slide');
      var dots = carousel.querySelectorAll('.cm-dot');
      var idx = 0, timer = null;
      function show(n){
        idx = (n + slides.length) % slides.length;
        slides.forEach(function(el, i){
          el.classList.toggle('is-active', i === idx);
          el.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        });
        dots.forEach(function(el, i){ el.classList.toggle('is-active', i === idx); });
      }
      function start(){ stop(); timer = setInterval(function(){ show(idx + 1); }, 3200); }
      function stop(){ if (timer) { clearInterval(timer); timer = null; } }
      dots.forEach(function(d, i){
        d.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); show(i); start(); });
      });
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      var observer = new MutationObserver(function(){
        if (modal.classList.contains('is-open')) start(); else stop();
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  }
  function open(){
    ensureModal();
    var m = document.getElementById('createModal');
    if (!m) return;
    m.hidden = false;
    requestAnimationFrame(function(){ m.classList.add('is-open'); });
    document.documentElement.style.overflow = 'hidden';
  }
  function close(){
    var m = document.getElementById('createModal');
    if (!m) return;
    m.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(function(){ if (!m.classList.contains('is-open')) m.hidden = true; }, 220);
  }
  window.openCreateModal = open;
  window.closeCreateModal = close;
  if (document.readyState !== 'loading') ensureModal();
  else document.addEventListener('DOMContentLoaded', ensureModal);
})();


// Time-based dark mode with manual override
(function() {
  function applyTheme() {
    var override = localStorage.getItem('theme-override');
    if (override === 'light' || override === 'dark') {
      document.documentElement.classList.toggle('dark', override === 'dark');
      return;
    }
    var hour = new Date().getHours();
    var isDark = hour < 6 || hour >= 19;
    document.documentElement.classList.toggle('dark', isDark);
  }
  applyTheme();
  setInterval(applyTheme, 60000);
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