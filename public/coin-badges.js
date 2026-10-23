// Coin pairing is stored per project (releases.coin_mint, portfolio_details.coin_mint).
// Only a card whose own record carries a mint gets the badge — never name matching.
const COIN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="8.5"/>' +
  '<path d="M12 6.8v10.4"/>' +
  '<path d="M14.6 9.6c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.7-2.4 1.7 0 2.4 5 1.2 5 3.7 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.6-1.2"/>' +
  '</svg>';

export function indexCoinPairs(rows) {
  const pairs = Object.create(null);
  for (const row of rows || []) {
    if (!row || !row.slug) continue;
    const mint = (row.coin_mint || '').trim();
    if (!mint) continue;
    const slug = String(row.slug).normalize('NFC').trim().toLowerCase();
    if (!slug) continue;
    const ticker = (row.coin_ticker || '').trim();
    if (!pairs[slug] || !pairs[slug].ticker) pairs[slug] = { mint, ticker };
  }
  return pairs;
}

export function coinBadgeLabel(ticker) {
  const t = (ticker || '').trim().replace(/^\$+/, '');
  return t ? '$' + t : 'Coin';
}

export function matchesCoinFilter(card, connectedOnly) {
  return !connectedOnly || Boolean(card?.dataset.coinMint?.trim());
}

function slugFromHref(href) {
  const m = (href || '').match(/^\/(?:project|release)\/([^/?#]+)/);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]).normalize('NFC').trim().toLowerCase();
  } catch (err) {
    return '';
  }
}

export function applyCoinBadges(grid, pairs) {
  if (!grid || !pairs) return 0;
  let added = 0;
  for (const card of grid.querySelectorAll('a.work-card[href]')) {
    if (card.querySelector('.work-coin-badge')) continue;
    const slug = slugFromHref(card.getAttribute('href'));
    if (!slug) continue;
    const pair = pairs[slug];
    if (!pair) continue;
    card.dataset.coinMint = pair.mint;
    const label = coinBadgeLabel(pair.ticker);
    const badge = document.createElement('span');
    badge.className = 'work-coin-badge';
    badge.title = 'Linked to coin ' + label;
    badge.setAttribute('aria-label', 'Linked to coin ' + label);
    badge.innerHTML = COIN_ICON;
    const text = document.createElement('span');
    text.textContent = label;
    badge.appendChild(text);
    card.appendChild(badge);
    added++;
  }
  return added;
}
