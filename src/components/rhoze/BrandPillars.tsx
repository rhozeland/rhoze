import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Two-pillar brand architecture: Rhozeland Media vs Rhozeland Tech.
 * Renders below the hero on the homepage. Compact, editorial, near-black on near-white,
 * matches the existing site tokens (Inter, hsl(var(--ink))).
 */

const mediaItems = [
  { label: "Artists & Talent", href: "/projects.html" },
  { label: "Podcast · The Angry Mortgage", href: "https://www.youtube.com/@angrymortgage" },
  { label: "Vlogs & Series", href: "/projects.html" },
  { label: "Livestreams", href: "/events.html" },
  { label: "Brand Partners", href: "/about.html" },
  { label: "Services & Production", href: "/contact.html" },
];

const techItems = [
  { label: "Rhoze App", href: "/start.html", badge: "Beta" },
  { label: "$RHOZE Tokenomics", href: "#tokenomics" },
  { label: "Community Leaderboard", href: "/leaderboard.html", badge: "Live" },
  { label: "Web3 & Wallet", href: "#tokenomics" },
];

export default function BrandPillars() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-end justify-between gap-6 flex-wrap"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              The Rhozeland universe
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold font-display tracking-tight text-foreground">
              One name, two engines.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground font-body">
            Rhozeland is a media house and a Web3 platform. Pick a door.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* MEDIA */}
          <motion.a
            href="/projects.html"
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="group relative flex flex-col rounded-2xl border border-border bg-card p-7 hover:border-foreground/40 hover:shadow-lift transition-all"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pillar 01
                </div>
                <div className="mt-1 text-2xl font-semibold font-display text-foreground">
                  Rhozeland Media
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-foreground" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground border-l-2 border-foreground/60 pl-3 mb-6">
              A creative house — artists, podcasts, vlogs, livestreams, brand partners, and the
              production team behind it all.
            </p>
            <ul className="divide-y divide-border text-sm">
              {mediaItems.map((it) => (
                <li key={it.label} className="py-2.5 flex items-center justify-between">
                  <span className="text-foreground/85">{it.label}</span>
                  <ArrowUpRight size={14} className="opacity-30 group-hover:opacity-90 transition-opacity" />
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em]">
                Enter media hub <ArrowUpRight size={14} />
              </span>
            </div>
          </motion.a>

          {/* TECH */}
          <motion.a
            href="#tokenomics"
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="group relative flex flex-col rounded-2xl border border-border bg-muted/40 p-7 hover:border-foreground/40 hover:shadow-lift transition-all"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pillar 02
                </div>
                <div className="mt-1 text-2xl font-semibold font-display text-foreground">
                  Rhozeland Tech
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full border border-foreground" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              The Web3 layer — $RHOZE token, creator app, community leaderboard, wallet-native
              ownership for the people doing the work.
            </p>
            <ul className="divide-y divide-border text-sm">
              {techItems.map((it) => (
                <li key={it.label} className="py-2.5 flex items-center justify-between">
                  <span className="text-foreground/85">{it.label}</span>
                  {it.badge ? (
                    <span className="text-[10px] uppercase tracking-[0.15em] bg-foreground text-background px-2 py-0.5 rounded">
                      {it.badge}
                    </span>
                  ) : (
                    <ArrowUpRight size={14} className="opacity-30 group-hover:opacity-90 transition-opacity" />
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-foreground text-foreground px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em]">
                Access platform <ArrowUpRight size={14} />
              </span>
            </div>
          </motion.a>
        </div>
      </div>
    </section>
  );
}