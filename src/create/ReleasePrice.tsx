import { useState } from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function formatReleasePrice(price: number) {
  if (price === 0) return "$0.00";
  if (price < 0.00000001) return `$${price.toExponential(2)}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? Math.min(10, Math.max(4, 3 - Math.floor(Math.log10(price)))) : 4 })}`;
}

export default function ReleasePrice({ mint, ticker, price, change }: {
  mint: string; ticker: string; price: number | null; change: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const pumpUrl = `https://pump.fun/coin/${encodeURIComponent(mint)}`;
  return (
    <section className="rz-price" aria-label="Coin price">
      <Button variant="ghost" className="rz-price-toggle" aria-expanded={expanded} aria-controls="release-price-details" onClick={() => setExpanded(v => !v)}>
        <span className="rz-price-line">
          <span>{ticker ? `$${ticker}` : "Coin"}</span>
          <span>{price === null ? "Price unavailable" : formatReleasePrice(price)}</span>
          <span className="rz-price-change" aria-label={change === null ? "24 hour change unavailable" : `24 hour change ${change.toFixed(2)} percent`}>
            {change === null ? "24h unavailable" : `${change > 0 ? "▲" : change < 0 ? "▼" : ""} ${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 2 })}% · 24h`}
          </span>
        </span>
        <ChevronDown className={expanded ? "rz-price-chevron is-open" : "rz-price-chevron"} aria-hidden="true" />
      </Button>
      {expanded && (
        <div id="release-price-details" className="rz-price-details">
          <Button asChild variant="link" className="rz-price-chart-link">
            <a href={pumpUrl} target="_blank" rel="noopener noreferrer">Open chart on Pump.fun <ArrowUpRight aria-hidden="true" /></a>
          </Button>
        </div>
      )}
    </section>
  );
}