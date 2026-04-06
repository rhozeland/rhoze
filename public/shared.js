// Shared JS for all Rhozeland pages

// Time-based dark mode
(function() {
  function applyTheme() {
    var hour = new Date().getHours();
    var isDark = hour < 6 || hour >= 19;
    document.documentElement.classList.toggle('dark', isDark);
  }
  applyTheme();
  setInterval(applyTheme, 60000);
})();

// Mobile menu
function closeMobile() {
  document.getElementById('mobileMenu').classList.remove('open');
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