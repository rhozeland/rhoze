// Shared JS for all Rhozeland pages

// Create modal — injected once on every page
(function(){
  var produceIcon = ''
    + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    +   '<rect x="3" y="3" width="18" height="18" rx="4"/>'
    +   '<circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/>'
    +   '<circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/>'
    +   '<circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/>'
    +   '<circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>'
    +   '<circle cx="12" cy="12" r="1.1" fill="currentColor"/>'
    + '</svg>';
  var distributeIcon = ''
    + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    +   '<path d="M5 14a9 9 0 0 1 9 9"/>'
    +   '<path d="M5 9a14 14 0 0 1 14 14"/>'
    +   '<circle cx="5.5" cy="18.5" r="1.6" fill="currentColor"/>'
    + '</svg>';

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
      +           '<div class="create-card__body">'
      +             '<span class="create-card__icon create-card__icon--produce">' + produceIcon + '</span>'
      +             '<span class="create-card__arrow" aria-hidden="true">' + arrow + '</span>'
      +             '<h3 class="create-card__title">Produce</h3>'
      +             '<p class="create-card__desc">Start a project with Rhozeland for studio, visuals, rollout support, and launch planning.</p>'
      +           '</div>'
      +         '</a>'
      +         '<a class="create-card" href="https://rhozeland.app/" target="_blank" rel="noopener noreferrer">'
      +           '<div class="create-card__body">'
      +             '<span class="create-card__icon create-card__icon--distribute">' + distributeIcon + '</span>'
      +             '<span class="create-card__arrow" aria-hidden="true">' + arrow + '</span>'
      +             '<h3 class="create-card__title">Distribute</h3>'
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