// Early access popup: shown once to new visitors, lists upcoming features, joins via waitlist_join.
(function(){
  if (window.__rzWaitlistPopup) return; window.__rzWaitlistPopup = true;
  var KEY = 'rz-waitlist-popup', p = location.pathname;
  if (/^\/(waitlist|team|admin|deck|submissions)/.test(p) || /team\.html|deck/.test(p) || window.self !== window.top && /[?&]embed=/.test(location.search)) return;
  try { var seen = JSON.parse(localStorage.getItem(KEY) || 'null'); if (seen && (seen.joined || Date.now() - seen.at < 14*864e5)) return; } catch(e) {}
  var URL_ = 'https://hdlpvcsxyxirywjkhsui.supabase.co/rest/v1/rpc/waitlist_join';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbHB2Y3N4eXhpcnl3amtoc3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTAwMzQsImV4cCI6MjA5Mjk4NjAzNH0.mfI7RcFIMUEH3QzxhtYI7Z2gkm-V2VdKAcGaF6p523w';
  var FEATURES = [
    ['Find Work', 'Open calls and creator listings.'],
    ['School', 'Learn the craft, project by project.'],
    ['Database', 'Find collaborators in the network.']
  ];
  var ROLES = [['artist','Artist'],['brand','Brand'],['creative','Creative for hire'],['fan','Fan']];
  function remember(joined){ try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), joined: !!joined })); } catch(e) {} }
  var css = '.rzwl-back{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,14,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;animation:rzwl-in .25s ease both}'
   + '.rzwl{position:relative;width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:20px;padding:24px;background:linear-gradient(135deg,#fff3ea,#fff9e0 50%,#e6f8f6);color:#141418;box-shadow:0 24px 70px rgba(0,0,0,.35)}'
   + 'html.dark .rzwl,html.release-mode .rzwl{background:linear-gradient(135deg,#2a211d,#26241a 50%,#1a2726);color:#f3f1ec}'
   + '.rzwl h2{font-size:24px;line-height:1.15;font-weight:700;margin:4px 0 8px}.rzwl p{margin:0;font-size:13px;line-height:1.5;opacity:.75}'
   + '.rzwl-eye{font-size:11px;text-transform:uppercase;letter-spacing:.12em;opacity:.6}'
   + '.rzwl-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:999px;border:0;background:rgba(0,0,0,.08);color:inherit;font-size:18px;cursor:pointer}'
   + '.rzwl ul{list-style:none;padding:0;margin:16px 0;display:grid;gap:8px}.rzwl li{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.6)}'
   + 'html.dark .rzwl li,html.release-mode .rzwl li{background:rgba(255,255,255,.06)}.rzwl li b{display:block;font-size:13px}.rzwl li span{font-size:12px;opacity:.7}'
   + '.rzwl li i{font-style:normal;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:3px 7px;border-radius:999px;background:#141418;color:#fff;margin-left:auto;white-space:nowrap}'
   + 'html.dark .rzwl li i,html.release-mode .rzwl li i{background:#f3f1ec;color:#141418}'
   + '.rzwl input{width:100%;height:42px;box-sizing:border-box;border-radius:10px;border:1px solid rgba(0,0,0,.18);padding:0 12px;font:inherit;font-size:14px;background:#fff;color:#141418}'
   + '.rzwl-roles{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.rzwl-roles button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}'
   + '.rzwl-roles button[aria-pressed=true]{background:#141418;color:#fff;border-color:#141418}html.dark .rzwl-roles button[aria-pressed=true],html.release-mode .rzwl-roles button[aria-pressed=true]{background:#f3f1ec;color:#141418;border-color:#f3f1ec}'
   + '.rzwl-go{width:100%;height:44px;border:0;border-radius:999px;background:#141418;color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer}.rzwl-go:disabled{opacity:.6;cursor:default}'
   + 'html.dark .rzwl-go,html.release-mode .rzwl-go{background:#f3f1ec;color:#141418}'
   + '.rzwl-err{color:#b3261e;font-size:12px;margin:8px 0 0}html.dark .rzwl-err,html.release-mode .rzwl-err{color:#ff9b93}.rzwl-later{display:block;margin:10px auto 0;border:0;background:none;color:inherit;opacity:.65;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}'
   + '@keyframes rzwl-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.rzwl-back{animation:none}}';
  function el(tag, attrs, text){ var n = document.createElement(tag); for (var k in attrs||{}) n.setAttribute(k, attrs[k]); if (text) n.textContent = text; return n; }
  function open(){
    if (document.querySelector('.rzwl-back')) return;
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var back = el('div', { 'class': 'rzwl-back' }), box = el('div', { 'class': 'rzwl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rzwl-t' });
    var x = el('button', { 'class': 'rzwl-x', type: 'button', 'aria-label': 'Close' }, '×');
    function close(){ remember(false); back.remove(); document.removeEventListener('keydown', esc); }
    function esc(e){ if (e.key === 'Escape') close(); }
    x.onclick = close; back.addEventListener('click', function(e){ if (e.target === back) close(); }); document.addEventListener('keydown', esc);
    box.appendChild(x); box.appendChild(el('div', { 'class': 'rzwl-eye' }, 'Early access'));
    box.appendChild(el('h2', { id: 'rzwl-t' }, 'Where creators and brands build together.'));
    box.appendChild(el('p', {}, 'These features are coming next. Join the list to get in first.'));
    var ul = el('ul'); FEATURES.forEach(function(f){ var li = el('li'), d = el('div'); d.appendChild(el('b', {}, f[0])); d.appendChild(el('span', {}, f[1])); li.appendChild(d); li.appendChild(el('i', {}, 'Soon')); ul.appendChild(li); }); box.appendChild(ul);
    var form = el('form', { novalidate: '' }), email = el('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', maxlength: '254', 'aria-label': 'Email' });
    var roles = el('div', { 'class': 'rzwl-roles', role: 'group', 'aria-label': 'I’m a...' }), role = '';
    ROLES.forEach(function(r){ var b = el('button', { type: 'button', 'aria-pressed': 'false' }, r[1]); b.onclick = function(){ role = r[0]; roles.querySelectorAll('button').forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); }; roles.appendChild(b); });
    var go = el('button', { 'class': 'rzwl-go', type: 'submit' }, 'Join the waitlist'), err = el('p', { 'class': 'rzwl-err', role: 'alert' });
    var later = el('button', { 'class': 'rzwl-later', type: 'button' }, 'Maybe later'); later.onclick = close;
    form.appendChild(email); form.appendChild(roles); form.appendChild(go); form.appendChild(err); form.appendChild(later);
    form.onsubmit = function(e){
      e.preventDefault(); err.textContent = '';
      var v = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 254) { err.textContent = 'Enter a valid email address.'; return; }
      if (!role) { err.textContent = 'Choose how you create.'; return; }
      var ref = (new URLSearchParams(location.search).get('ref') || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
      go.disabled = true; go.textContent = 'Joining…';
      fetch(URL_, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_email: v, p_role: role, p_project_line: '', p_referrer: ref }) })
        .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
        .then(function(d){
          if (d && d.status === 'duplicate') { err.textContent = 'You’re already on the list.'; remember(true); return; }
          if (!d || !d.share_code) { err.textContent = 'Please try again in a moment.'; return; }
          remember(true); form.innerHTML = '';
          var link = location.origin + '/waitlist?ref=' + d.share_code;
          form.appendChild(el('h2', {}, 'You’re on the list.')); form.appendChild(el('p', {}, 'Invite creators you’d want to work with.'));
          var inp = el('input', { readonly: '', 'aria-label': 'Your share link' }); inp.value = link; inp.style.marginTop = '12px'; inp.onfocus = function(){ inp.select(); }; form.appendChild(inp);
          var done = el('button', { 'class': 'rzwl-later', type: 'button' }, 'Close'); done.onclick = function(){ back.remove(); }; form.appendChild(done);
        })
        .catch(function(){ err.textContent = 'We couldn’t add you right now. Please try again.'; })
        .finally(function(){ go.disabled = false; go.textContent = 'Join the waitlist'; });
    };
    box.appendChild(form); back.appendChild(box); document.body.appendChild(back); setTimeout(function(){ email.focus(); }, 50);
  }
  window.rzOpenWaitlist = open;
  setTimeout(open, 6000);
})();
