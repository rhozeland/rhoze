import { motion } from "framer-motion";

/**
 * Ecosystem hub strip — a thin marquee of live signals from across Rhozeland
 * (drops, livestreams, leaderboard, podcast, on-chain). Sits between the
 * Navbar and the Hero. Editorial, single-line, near-monochrome — designed to
 * add hub-energy without disturbing the existing homepage layout.
 */

type Tick = { tag: string; label: string; href: string; live?: boolean };

const ticks: Tick[] = [
  { tag: "Live", label: "Community Leaderboard · weekly snapshot", href: "/leaderboard.html", live: true },
  { tag: "Drop", label: "Saint Flair West · Ooak", href: "/projects.html" },
  { tag: "Podcast", label: "The Angry Mortgage · new episode", href: "https://www.youtube.com/@angrymortgage" },
  { tag: "Vlog", label: "Studio Sessions: 004", href: "/projects.html" },
  { tag: "On-chain", label: "$RHOZE · supply locked", href: "#tokenomics" },
  { tag: "Event", label: "Land Sessions · LA", href: "/events.html" },
  { tag: "Build", label: "Rhoze App · Beta open", href: "/start.html" },
];

const row = [...ticks, ...ticks];

export default function EcosystemTicker() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative z-40 border-b border-border/60 bg-background/70 backdrop-blur-md"
      aria-label="Rhozeland ecosystem activity"
    >
      <div className="flex items-stretch">
        <div className="hidden sm:flex items-center gap-2 border-r border-border/60 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(135_70%_45%)]" />
          Ecosystem
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex gap-10 whitespace-nowrap py-2 will-change-transform"
            style={{ animation: "ticker-scroll 60s linear infinite" }}
          >
            {row.map((t, i) => (
              <a
                key={`${t.label}-${i}`}
                href={t.href}
                {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                  {t.live && <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[hsl(135_70%_45%)]" />}
                  {t.tag}
                </span>
                <span>{t.label}</span>
                <span className="text-foreground/30">·</span>
              </a>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
        </div>
        <a
          href="/leaderboard.html"
          className="hidden md:inline-flex items-center gap-1 border-l border-border/60 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground hover:bg-muted/30 transition-colors"
        >
          Hub →
        </a>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </motion.div>
  );
}