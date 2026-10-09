(function () {
  const url = 'https://hdlpvcsxyxirywjkhsui.supabase.co/rest/v1/creator_directory?select=id,slug,display_name,photo_url,disciplines,membership_tier,hourly_rate_cents,hourly_rate_max_cents,completed_projects,rating,trending,bio,portfolio_url,website_url&approved=eq.true&is_public=eq.true&account_kind=neq.supporter&order=created_at.desc&limit=500';
  const callsUrl = 'https://hdlpvcsxyxirywjkhsui.supabase.co/rest/v1/releases?select=slug,title,creator_name,answers&status=eq.published&order=published_at.desc&limit=200';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbHB2Y3N4eXhpcnl3amtoc3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTAwMzQsImV4cCI6MjA5Mjk4NjAzNH0.mfI7RcFIMUEH3QzxhtYI7Z2gkm-V2VdKAcGaF6p523w';
  const $ = id => document.getElementById(id);
  const categories = ['Actor','Brand Strategist','Composer','Dancer','Designer','Editor','Influencer','Marketing Specialist','Model','Musician','Photographer','Rapper','Singer','Songwriter','Video Editor','Videographer'];
  let creators = [], calls = [], selected = /^#?open-calls$|view=open-calls/.test(location.hash + location.search) ? 'Open Calls' : 'All', page = 1, failed = false;
  const perPage = 15;
  const search = $('creatorSearch'), grid = $('creatorGrid'), filters = $('creatorFilters'), meta = $('directoryMeta'), pages = $('directoryPages'), dialog = $('creatorProfile');
  function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
  function image(creator, className) {
    if (creator.photo_url && /^https:\/\/|^\/__l5e\/|^\/images\/|^\/assets\//.test(creator.photo_url)) {
      const img = el('img', className); img.src = creator.photo_url; img.alt = creator.display_name; img.loading = 'lazy'; return img;
    }
    return el('div', className + ' creator-initial', (creator.display_name || '?').charAt(0).toUpperCase());
  }
  function rate(creator) { const c = creator.hourly_rate_cents; if (c == null || c <= 0) return 'Rate on request'; const f = (n) => '$' + (n / 100).toLocaleString('en-CA'); const m = creator.hourly_rate_max_cents; return 'Starting from ' + (m != null && m > c ? f(c) + '–' + f(m) : f(c)) + '/hr'; }
  function validLink(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
  function renderFilters() {
    filters.replaceChildren();
    ['All', ...categories, 'Open Calls'].forEach(category => {
      const count = category === 'All' ? creators.length : category === 'Open Calls' ? calls.length : creators.filter(c => (c.disciplines || []).some(d => d.toLowerCase() === category.toLowerCase())).length;
      const button = el('button', 'filter-pill'); button.type = 'button'; button.setAttribute('aria-pressed', String(selected === category));
      if (selected === category) button.append(el('span', 'tick', '✓ '));
      button.append(document.createTextNode(category + (count ? ' (' + count + ')' : '')));
      button.addEventListener('click', () => { selected = category; page = 1; render(); }); filters.append(button);
    });
  }
  function openProfile(creator) {
    const content = $('profileContent'); content.replaceChildren();
    content.append(image(creator, 'profile-portrait'), el('h2', '', creator.display_name));
    const facts = el('div', 'profile-facts');
    (creator.disciplines || []).forEach(d => facts.append(el('span', '', d)));
    facts.append(el('span', '', rate(creator)));
    if (creator.completed_projects > 0) facts.append(el('span', '', creator.completed_projects + ' completed projects'));
    if (creator.rating != null) facts.append(el('span', '', Number(creator.rating).toFixed(1) + ' ★'));
    content.append(facts, el('p', 'profile-bio', creator.bio || 'Explore this creator’s work and get in touch about a project.'));
    const actions = el('div', 'profile-actions');
    const book = el('a', '', 'Book a project'); book.href = '/book/?creator=' + encodeURIComponent(creator.display_name); actions.append(book);
    const portfolio = validLink(creator.portfolio_url) || validLink(creator.website_url);
    if (portfolio) { const link = el('a', '', 'View portfolio ↗'); link.href = portfolio; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link); }
    const contact = el('a', '', 'Get in touch'); contact.href = 'mailto:collab@rhozeland.com?subject=' + encodeURIComponent('Project inquiry for ' + creator.display_name); actions.append(contact);
    content.append(actions); dialog.showModal();
    history.replaceState(null, '', '#creator-' + encodeURIComponent(creator.id));
  }
  function closeProfile() { dialog.close(); if (location.hash.startsWith('#creator-')) history.replaceState(null, '', location.pathname + location.search); }
  $('closeProfile').addEventListener('click', closeProfile);
  dialog.addEventListener('click', e => { if (e.target === dialog) closeProfile(); });
  dialog.addEventListener('close', () => { if (location.hash.startsWith('#creator-')) history.replaceState(null, '', location.pathname + location.search); });
  function renderCalls() {
    const q = search.value.trim().toLocaleLowerCase();
    const visible = calls.filter(c => !q || [c.creator_name, c.title, ...((c.answers && c.answers.roles) || []).map(r => r.name)].join(' ').toLocaleLowerCase().includes(q));
    grid.replaceChildren(); pages.replaceChildren();
    meta.textContent = visible.length + (visible.length === 1 ? ' open call' : ' open calls');
    if (!visible.length) { grid.append(el('div', 'directory-empty', 'No open calls right now. Check back soon.')); return; }
    visible.forEach(c => {
      const roles = (c.answers && c.answers.roles) || [];
      const card = el('a', 'creator-card call-card'); card.href = '/brand/' + slugify(c.creator_name || ''); card.setAttribute('aria-label', 'View brand profile: ' + (c.creator_name || c.title));
      const top = el('div', 'creator-top'); top.append(el('h2', '', c.title)); top.append(el('span', 'creator-badge', 'OPEN CALL'));
      card.append(top, el('div', 'creator-tier', (c.creator_name || 'Brand') + ' · Brand project'));
      const list = el('div', 'call-roles');
      roles.forEach((r, ri) => {
        if (!r || !String(r.name || '').trim()) return;
        const chip = el('span', 'call-role', r.name + (Number(r.count) > 1 ? ' ×' + r.count : '') + (r.rate ? ' · ' + r.rate : '') + ' · Apply');
        chip.setAttribute('role', 'button'); chip.tabIndex = 0; chip.style.cursor = 'pointer';
        const go = e => { e.preventDefault(); e.stopPropagation(); location.href = '/release/' + encodeURIComponent(c.slug) + '?apply=' + ri; };
        chip.addEventListener('click', go); chip.addEventListener('keydown', e => { if (e.key === 'Enter') go(e); });
        list.append(chip);
      });
      card.append(list, el('div', 'creator-muted', roles.length + (roles.length === 1 ? ' role needed' : ' roles needed') + ' · tap a role to apply'));
      grid.append(card);
    });
  }
  function render() {
    const opportunities = selected === 'Open Calls';
    document.querySelector('.community-head h1').textContent = opportunities ? 'Find Work' : 'Creators';
    document.querySelector('.community-head p').textContent = opportunities ? 'Find open roles and collaborate on creative projects.' : 'Discover new artists, connect with creatives, and collaborate.';
    document.title = opportunities ? 'Find Work — Rhozeland' : 'Creators — Rhozeland';
    search.placeholder = opportunities ? 'Search by project, brand or role...' : 'Search by artist name or skill...';
    search.setAttribute('aria-label', opportunities ? 'Search by project, brand or role' : 'Search by artist name or skill');
    const currentUrl = new URL(location.href);
    if (opportunities) currentUrl.searchParams.set('view', 'open-calls');
    else currentUrl.searchParams.delete('view');
    history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
    document.querySelectorAll('.sn-links a, #mobileMenu a').forEach(link => {
      const target = new URL(link.href, location.origin);
      if (!/^\/community(?:\.html|\/)?$/.test(target.pathname)) return;
      const active = (target.searchParams.get('view') === 'open-calls') === opportunities;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    renderFilters();
    if (selected === 'Open Calls') { renderCalls(); return; }
    const q = search.value.trim().toLocaleLowerCase();
    const visible = creators.filter(c => (selected === 'All' || (c.disciplines || []).some(d => d.toLowerCase() === selected.toLowerCase())) && (!q || [c.display_name, c.bio, ...(c.disciplines || [])].join(' ').toLocaleLowerCase().includes(q)));
    grid.replaceChildren(); pages.replaceChildren();
    meta.textContent = failed ? 'Creators could not load right now.' : visible.length + (visible.length === 1 ? ' creator' : ' creators');
    if (!visible.length) { const empty = el('div', 'directory-empty', failed ? 'Please try again in a moment.' : creators.length ? 'No creators match your search.' : 'No creators listed yet. Check back soon.'); grid.append(empty); if (failed) { const retry = el('button', '', 'Try again'); retry.addEventListener('click', load); empty.append(retry); } return; }
    const totalPages = Math.ceil(visible.length / perPage); page = Math.min(page, totalPages);
    visible.slice((page - 1) * perPage, page * perPage).forEach(creator => {
      const card = el('article', 'creator-card'); card.append(image(creator, 'creator-photo'));
      const top = el('div', 'creator-top'); top.append(el('h2', '', creator.display_name)); const badges = el('div', 'creator-badges');
      if (creator.trending) badges.append(el('span', 'creator-badge', 'TRENDING ◉'));
      if (creator.rating != null) badges.append(el('span', 'creator-badge rating', Number(creator.rating).toFixed(1) + ' ★'));
      top.append(badges); card.append(top, el('div', 'creator-detail', [(creator.disciplines || []).join(' · '), rate(creator)].filter(Boolean).join(' · ')), el('div', 'creator-muted', creator.completed_projects ? creator.completed_projects + ' completed projects' : 'New to the directory'));
      const view = el('a', 'creator-view', 'View Profile'); view.href = '/creator/' + encodeURIComponent(creator.slug); view.style.textDecoration = 'none'; card.style.cursor = 'pointer'; card.addEventListener('click', e => { if (!e.target.closest('a')) location.href = view.href; }); view.setAttribute('aria-label', 'View profile for ' + creator.display_name); card.append(view); grid.append(card);
    });
    if (totalPages > 1) for (let i = 1; i <= totalPages; i++) { const b = el('button', '', String(i)); b.type = 'button'; b.setAttribute('aria-label', 'Page ' + i); if (i === page) b.setAttribute('aria-current', 'page'); b.addEventListener('click', () => { page = i; render(); grid.scrollIntoView({behavior:'smooth',block:'start'}); }); pages.append(b); }
  }
  async function load() {
    meta.textContent = 'Loading creators…'; failed = false;
    const headers = { apikey: key, Authorization: 'Bearer ' + key };
    try {
      const [cr, rl] = await Promise.all([fetch(url, { headers }), fetch(callsUrl, { headers })]);
      if (!cr.ok) throw Error('Unable to load');
      creators = await cr.json();
      if (rl.ok) { const releases = await rl.json(); calls = (releases || []).filter(r => r.answers && r.answers.project_type === 'brand' && Array.isArray(r.answers.roles) && r.answers.roles.length); }
    } catch { failed = true; creators = []; }
    render();
    const match = decodeURIComponent(location.hash.replace(/^#creator-/, '')); const initial = creators.find(c => c.id === match); if (initial && !dialog.open) openProfile(initial);
  }
  search.addEventListener('input', () => { page = 1; render(); });
  $('clearFilters').addEventListener('click', () => { search.value = ''; selected = 'All'; page = 1; render(); });
  load();
})();
