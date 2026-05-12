import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const TOKEN = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const API_URL = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`;

type Stats = {
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
};

const fmtPrice = (n: number | null) => {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toPrecision(4)}`;
};
const fmtCompact = (n: number | null) => {
  if (n == null || !isFinite(n) || n <= 0) return "—";
  const u = ["", "K", "M", "B", "T"]; let i = 0; let v = n;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `$${v >= 10 ? v.toFixed(1) : v.toFixed(2)}${u[i]}`;
};
const fmtPct = (n: number | null) => {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
};

const Chart = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [stats, setStats] = useState<Stats>({ price: null, change24h: null, marketCap: null, volume24h: null });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inflight = false;
    const load = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const r = await fetch(API_URL, { cache: "no-store" });
        if (!r.ok) throw new Error(`http ${r.status}`);
        const d = await r.json();
        const pairs: any[] = d?.pairs ?? [];
        if (!pairs.length || cancelled) return;
        pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
        const p = pairs[0];
        setStats({
          price: parseFloat(p.priceUsd),
          change24h: p?.priceChange?.h24 != null ? parseFloat(p.priceChange.h24) : null,
          marketCap: p?.marketCap ?? p?.fdv ?? null,
          volume24h: p?.volume?.h24 != null ? parseFloat(p.volume.h24) : null,
        });
      } catch {
        // keep prior values
      } finally {
        inflight = false;
      }
    };
    const start = () => { load(); if (timer) clearInterval(timer); timer = setInterval(load, 30000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    start();
    const vis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", vis);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  const changeClass = stats.change24h == null ? "text-foreground" : stats.change24h >= 0 ? "text-emerald-500" : "text-rose-500";

  const StatCard = ({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) => (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-base font-extrabold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <section id="chart" className="py-32 px-6" ref={ref}>
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-semibold font-display mb-4 text-foreground">
            Live Chart
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto font-body">
            Track $RHOZE in real-time on Birdeye.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4"
          aria-live="polite"
        >
          <StatCard label="Price" value={fmtPrice(stats.price)} />
          <StatCard label="24h" value={fmtPct(stats.change24h)} valueClass={changeClass} />
          <StatCard label="Market Cap" value={fmtCompact(stats.marketCap)} />
          <StatCard label="24h Vol" value={fmtCompact(stats.volume24h)} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl overflow-hidden border border-border shadow-lift"
        >
          {inView && (
            <iframe
              src="https://birdeye.so/tv-widget/7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&theme=light"
              className="w-full"
              style={{ height: "500px", border: "none" }}
              title="Birdeye $RHOZE Chart"
              loading="lazy"
              allowFullScreen
            />
          )}
        </motion.div>

        <div className="mt-6 text-center">
          <a
            href="https://birdeye.so/token/7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump?chain=solana"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-body underline underline-offset-4"
          >
            View full chart on Birdeye →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Chart;
