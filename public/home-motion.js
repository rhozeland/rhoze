(function () {
  async function start() {
    var track = document.querySelector('.fh-marquee-track');
    var spotlight = document.getElementById('fh-project-spotlight');
    if (!track || !spotlight) return;
    var projects = Array.from(track.querySelectorAll('.fh-project'));
    try {
      var response = await fetch('/home-projects.json');
      if (response.ok) {
        var entries = await response.json();
        var expanded = entries.map(function (entry) {
          var link = document.createElement('a');
          link.className = 'fh-project';
          link.href = entry.href;
          if (/^https?:/.test(entry.href)) { link.target = '_blank'; link.rel = 'noopener'; }
          var image = document.createElement('img');
          image.src = entry.image; image.alt = entry.title + ' — ' + entry.artist;
          var tag = document.createElement('span'); tag.className = 'fh-project-tag'; tag.textContent = entry.tag;
          var meta = document.createElement('span'); meta.className = 'fh-project-meta';
          var title = document.createElement('strong'); title.textContent = entry.title;
          var artist = document.createElement('span'); artist.textContent = entry.artist;
          meta.append(title, artist); link.append(image, tag, meta);
          return link;
        });
        if (expanded.length) { projects = expanded; track.replaceChildren(); }
      }
    } catch (_) { /* Keep the existing artwork if the larger selection is unavailable. */ }
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