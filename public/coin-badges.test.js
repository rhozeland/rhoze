import { describe, it, expect, beforeEach } from 'vitest';
import { indexCoinPairs, coinBadgeLabel, applyCoinBadges } from './coin-badges.js';

describe('Discover coin badges', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="grid">' +
      '<a class="work-card" href="/release/rhozeland"></a>' +
      '<a class="work-card" href="/project/sefra-cozal"></a>' +
      '<a class="work-card" href="/project/unpaired"></a>' +
      '</div>';
  });

  it('marks only the cards whose own record carries a mint', () => {
    const pairs = indexCoinPairs([
      { slug: 'rhozeland', coin_mint: '2bf8UbibdRF8wsi8pAeHHEgUnrsYXcAT4GBvzA5Cpump', coin_ticker: 'RHOZE' },
      { slug: 'sefra-cozal', coin_mint: '', coin_ticker: 'FAKE' },
    ]);
    const grid = document.getElementById('grid');
    expect(applyCoinBadges(grid, pairs)).toBe(1);
    expect(grid.querySelectorAll('.work-coin-badge')).toHaveLength(1);
    expect(grid.querySelector('a[href="/release/rhozeland"] .work-coin-badge').textContent).toBe('$RHOZE');
  });

  it('badges archive cards from portfolio details too', () => {
    const pairs = indexCoinPairs([{ slug: 'sefra-cozal', coin_mint: '7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump', coin_ticker: 'rhoze' }]);
    expect(applyCoinBadges(document.getElementById('grid'), pairs)).toBe(1);
    expect(document.querySelector('a[href="/project/sefra-cozal"] .work-coin-badge').textContent).toBe('$rhoze');
  });

  it('never badges a card twice', () => {
    const pairs = indexCoinPairs([{ slug: 'rhozeland', coin_mint: 'abc', coin_ticker: 'RHOZE' }]);
    const grid = document.getElementById('grid');
    applyCoinBadges(grid, pairs);
    applyCoinBadges(grid, pairs);
    expect(grid.querySelectorAll('.work-coin-badge')).toHaveLength(1);
  });

  it('falls back to a plain label when no ticker is stored', () => {
    expect(coinBadgeLabel('')).toBe('Coin');
    expect(coinBadgeLabel('$RHOZE')).toBe('$RHOZE');
  });
});
