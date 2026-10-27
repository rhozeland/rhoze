import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
export function formatReleasePrice(price: number) {
  if (price === 0) return "$0.00";
  if (price < 0.00000001) return `$${price.toExponential(2)}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? Math.min(10, Math.max(4, 3 - Math.floor(Math.log10(price)))) : 4 })}`;
}

export default function ReleasePrice({ mint, ticker, price, change }: {
  mint: string; ticker: string; price: number | null; change: number | null;
}) {
  const chartUrl = `https://embed.birdeye.so/tv-widget/${encodeURIComponent(mint)}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=UTC&chartLeftToolbar=hide&theme=light`;
  return (
    <section className="rz-price" aria-label="Coin price">
        <div className="rz-price-line">
          <span>{ticker ? `$${ticker}` : "Coin"}</span>
          <span>{price === null ? "Price unavailable" : formatReleasePrice(price)}</span>
          <span className="rz-price-change" aria-label={change === null ? "24 hour change unavailable" : `24 hour change ${change.toFixed(2)} percent`}>
            {change === null ? "24h unavailable" : `${change > 0 ? "▲" : change < 0 ? "▼" : ""} ${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 2 })}% · 24h`}
          </span>
        </div>
        <iframe className="rz-price-chart" src={chartUrl} title={`${ticker ? `$${ticker}` : "Project coin"} live price chart powered by Birdeye`} allowFullScreen />
    </section>
  );
}
/** Chart that loads its own live price; used in the owner workspace. */
export function LiveReleasePrice({ mint, ticker }: { mint: string; ticker: string }) {
  const [p, setP] = React.useState<{ price: number | null; change: number | null }>({ price: null, change: null });
  React.useEffect(() => {
    let alive = true;
    supabase.functions.invoke("pumpfun-coin", { body: { mint } }).then(({ data }: any) => {
      if (!alive) return;
      const ok = (n: any) => typeof n === "number" && Number.isFinite(n);
      setP({ price: ok(data?.priceUsd) && data.priceUsd >= 0 ? data.priceUsd : null, change: ok(data?.change24h) ? data.change24h : null });
    }).catch(() => {});
    return () => { alive = false; };
  }, [mint]);
  return <ReleasePrice mint={mint} ticker={ticker} price={p.price} change={p.change} />;
}
