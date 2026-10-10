(function () {
  if (window.rhozeProjectViewInstalled) return;
  window.rhozeProjectViewInstalled = true;
  var dialog, frame, opener, previousTitle, pushed = false, openerHref = null;
  var OPENER_KEY = 'rhozeProjectOpener';
  function getReturnUrl() {
    try { return sessionStorage.getItem(OPENER_KEY); } catch (e) { return null; }
  }
  function clearReturnUrl() {
    try { sessionStorage.removeItem(OPENER_KEY); } catch (e) {}
  }
  var style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = '/project-view.css'; document.head.appendChild(style);
  function dismiss() {
    if (!dialog || !dialog.open) return;
    dialog.close(); frame.contentWindow.location.replace('about:blank');
    document.documentElement.classList.remove('project-view-open');
    document.title = previousTitle;
    if (opener && opener.isConnected) opener.focus();
  }
  function close() {
    if (pushed) { pushed = false; history.back(); }
    else dismiss();
  }
  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'project-view-dialog';
    dialog.setAttribute('aria-label', 'Project details');
    var x = document.createElement('button'); x.className = 'project-view-close'; x.type = 'button';
    x.setAttribute('aria-label', 'Close project'); x.title = 'Close project';
    x.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    x.addEventListener('click', close);
    frame = document.createElement('iframe'); frame.title = 'Project details'; frame.className = 'project-view-frame';
    frame.addEventListener('load', function () {
      try {
        var doc = frame.contentDocument;
        if (!doc || frame.contentWindow.location.href === 'about:blank') return;
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !doc.querySelector('.rz-modal,.wallet-adapter-modal')) close(); });
        doc.addEventListener('click', function (e) {
          var a = e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.getAttribute('href').charAt(0) === '#') return;
          var url = new URL(a.href, location.origin);
          if (url.origin === location.origin) {
            e.preventDefault();
            url.searchParams.delete('projectView');
            location.href = url.pathname + url.search + url.hash;
          }
        });
      } catch (e) {}
    });
    dialog.appendChild(x); dialog.appendChild(frame);
    (document.querySelector('#profile-root,#discover-root,#release-root,#root') || document.body).appendChild(dialog);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url = new URL(a.href, location.origin);
    if (url.origin !== location.origin || !/^\/release\/[^/]+\/?$/.test(url.pathname) || window.self !== window.top) return;
    e.preventDefault(); e.stopPropagation(); ensure();
    dialog.classList.toggle('is-discover', /^\/discover\/?$/.test(location.pathname));
    opener = a; previousTitle = document.title;
    history.pushState({ rhozeProjectPopup: true }, '', url.pathname + url.search); pushed = true;
    url.searchParams.set('projectView', '1');
    frame.contentWindow.location.replace(url.pathname + url.search); dialog.showModal();
    document.documentElement.classList.add('project-view-open');
  }, true);
  window.addEventListener('popstate', function () {
    if (dialog && dialog.open) { pushed = false; dismiss(); }
  });
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data === 'rhoze:close-project') close();
  });
})();