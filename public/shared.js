// Shared JS for all Rhozeland pages

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

function ensureCreateModal() {
  var existing = document.getElementById('createModal');
  if (existing) return existing;
  var modal = document.createElement('div');
  modal.id = 'createModal';
  modal.className = 'create-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'createModalTitle');
  modal.innerHTML = '<div class="create-modal-panel">' +
    '<button class="create-modal-close" type="button" aria-label="Close create options" onclick="closeCreateModal()">&times;</button>' +
    '<div class="create-modal-art" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
    '<span class="create-modal-kicker">✦ Create</span>' +
    '<h2 class="create-modal-title" id="createModalTitle">What are we building next?</h2>' +
    '<div class="create-choice-grid">' +
      '<a class="create-choice" href="/projects.html"><span class="create-choice-icon">🎛</span><svg class="create-choice-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg><h3>Produce</h3><p>Start a project with Rhozeland for studio, visuals, rollout support, and launch planning.</p></a>' +
      '<a class="create-choice" href="https://rhozeland.app/" target="_blank" rel="noopener noreferrer"><span class="create-choice-icon">📡</span><svg class="create-choice-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg><h3>Distribute</h3><p>Open the creator app to publish, connect, and keep your release moving through the network.</p></a>' +
    '</div>' +
  '</div>';
  modal.addEventListener('click', function(event) {
    if (event.target === modal) closeCreateModal();
  });
  document.body.appendChild(modal);
  return modal;
}

function openCreateModal() {
  var modal = ensureCreateModal();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  var closeBtn = modal.querySelector('.create-modal-close');
  if (closeBtn) closeBtn.focus();
}

function closeCreateModal() {
  var modal = document.getElementById('createModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') closeCreateModal();
});

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