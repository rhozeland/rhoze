(function () {
  function start() {
    var track = document.querySelector('.fh-marquee-track');
    var spotlight = document.getElementById('fh-project-spotlight');
    if (!track || !spotlight) return;
    var projects = Array.from(track.querySelectorAll('.fh-project'));
    if (!projects.length) return;
    var selected = -1;
    function showProject() {
      var next = Math.floor(Math.random() * projects.length);
      if (next === selected) next = (next + 1) % projects.length;
      selected = next;
      spotlight.replaceChildren(projects[next].cloneNode(true));
    }
    showProject();
    var set = document.createElement('div');
    set.className = 'fh-work-set';
    projects.forEach(function (project) { set.appendChild(project); });
    track.appendChild(set);
    var duplicate = set.cloneNode(true);
    duplicate.setAttribute('aria-hidden', 'true');
    duplicate.querySelectorAll('a').forEach(function (link) { link.tabIndex = -1; });
    track.appendChild(duplicate);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.setInterval(function () {
        if (!document.hidden && !spotlight.matches(':hover') && !spotlight.contains(document.activeElement)) showProject();
      }, 18000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();