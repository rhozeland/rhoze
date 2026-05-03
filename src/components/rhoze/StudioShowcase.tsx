import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Home, Compass, Network, Building2, Calendar, Search } from "lucide-react";

type Screen = {
  key: string;
  label: string;
  icon: typeof Home;
  title: string;
  subtitle: string;
  accent: string;
  body: () => JSX.Element;
};

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/70">
    {children}
  </span>
);

const Row = ({ title, meta }: { title: string; meta: string }) => (
  <div className="flex items-center justify-between rounded-xl bg-foreground/[0.04] px-3 py-2.5">
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold text-foreground">{title}</p>
      <p className="truncate text-[9px] text-foreground/55">{meta}</p>
    </div>
    <ArrowUpRight size={11} className="text-foreground/40 shrink-0" />
  </div>
);

const screens: Screen[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    title: "The creative network",
    subtitle: "Today's flow, projects, and rewards.",
    accent: "from-rhoze-pink/40 to-rhoze-peach/30",
    body: () => (
      <div className="space-y-2">
        <Row title="New brief — Cozal rollout" meta="Studio · Active" />
        <Row title="Your $RHOZE balance" meta="2,140 · +18 today" />
        <Row title="Open opportunities" meta="3 collabs nearby" />
      </div>
    ),
  },
  {
    key: "spaces",
    label: "Spaces",
    icon: Compass,
    title: "Spaces",
    subtitle: "Studios, events, and gatherings.",
    accent: "from-rhoze-lavender/40 to-rhoze-pink/30",
    body: () => (
      <div className="space-y-2">
        <Row title="Open studio night" meta="Fri · The Vault" />
        <Row title="Listening session" meta="Sat · Members only" />
        <Row title="Pop-up market" meta="Next week · Apply" />
      </div>
    ),
  },
  {
    key: "hub",
    label: "Hub",
    icon: Network,
    title: "The Hub",
    subtitle: "People, services, and credits.",
    accent: "from-rhoze-peach/40 to-rhoze-lavender/30",
    body: () => (
      <div className="space-y-2">
        <Row title="Hire a videographer" meta="12 verified · From 2 SOL" />
        <Row title="Mix & master" meta="Booking this week" />
        <Row title="Cover art designer" meta="Top rated · 5 open" />
      </div>
    ),
  },
  {
    key: "studios",
    label: "Studios",
    icon: Building2,
    title: "Studios",
    subtitle: "Book a room, run a session.",
    accent: "from-primary/30 to-rhoze-peach/30",
    body: () => (
      <div className="space-y-2">
        <Row title="Studio A — Recording" meta="Open · Tonight 8pm" />
        <Row title="Studio B — Visuals" meta="2 slots this week" />
        <Row title="Edit suite" meta="Members included" />
      </div>
    ),
  },
];

const pillars = [
  { num: "01", label: "Create & Contribute" },
  { num: "02", label: "Build Reputation" },
  { num: "03", label: "Spend & Unlock" },
  { num: "04", label: "Revenue Sharing" },
];

const Phone = ({ active }: { active: number }) => {
  const s = screens[active];
  const Body = s.body;
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border border-border bg-foreground/[0.04] p-2 shadow-[0_30px_60px_-20px_hsl(0_0%_0%_/_0.35)]">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-background">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/90" />

          <div className="relative h-[560px]">
            {/* Screen content (cross-fade) */}
            {screens.map((sc, i) => {
              const Active = sc.body;
              return (
                <motion.div
                  key={sc.key}
                  className="absolute inset-0"
                  initial={false}
                  animate={{ opacity: i === active ? 1 : 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  style={{ pointerEvents: i === active ? "auto" : "none" }}
                >
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-foreground/70">
                    <span>9:41</span>
                    <span className="opacity-0">·</span>
                  </div>

                  {/* Search */}
                  <div className="mx-4 mt-3 flex items-center gap-2 rounded-full bg-foreground/[0.06] px-3 py-1.5">
                    <Search size={11} className="text-foreground/50" />
                    <span className="text-[10px] text-foreground/50">Search Rhozeland…</span>
                  </div>

                  {/* Header card */}
                  <div
                    className={`mx-4 mt-3 rounded-2xl bg-gradient-to-br ${sc.accent} p-4`}
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/60">
                      {sc.label}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                      {sc.title}
                    </h3>
                    <p className="mt-1 text-[10px] leading-snug text-foreground/65">
                      {sc.subtitle}
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="mx-4 mt-3 flex gap-1.5">
                    {["Events", "Spaces", "Discover"].map((t, ti) => (
                      <span
                        key={t}
                        className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                          ti === 0
                            ? "bg-foreground text-background"
                            : "bg-foreground/[0.06] text-foreground/60"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* List */}
                  <div className="mx-4 mt-3">
                    <Active />
                  </div>

                  {/* Empty hint card */}
                  <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.06]">
                      <Calendar size={13} className="text-foreground/55" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground">Anchored on Solana</p>
                      <p className="truncate text-[9px] text-foreground/55">
                        Verifiable receipts for every move.
                      </p>
                    </div>
                  </div>

                  {/* Bottom nav */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-around rounded-2xl border border-border/60 bg-background/80 px-3 py-2 backdrop-blur">
                    {screens.map((nav, ni) => {
                      const Icon = nav.icon;
                      const isActive = ni === active;
                      return (
                        <div
                          key={nav.key}
                          className={`flex flex-col items-center gap-0.5 ${
                            isActive ? "text-foreground" : "text-foreground/40"
                          }`}
                        >
                          <Icon size={14} />
                          <span className="text-[8px] font-semibold">{nav.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StudioShowcase = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % screens.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="studio" className="py-24 sm:py-32 px-6" ref={ref}>
      <div className="container mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-16">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              The Rhozeland App
            </span>
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
              Your studio,
              <br />
              network, and rewards
              <br />
              in one app.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Book studio time, find collaborators, run releases, and earn $RHOZE for every move. The whole creator loop in your pocket.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="https://app.rhozeland.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Try the live app <ArrowUpRight size={14} />
              </a>
              <a
                href="/about.html"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card/70"
              >
                How it works
              </a>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 max-w-md">
              {pillars.map((p, i) => (
                <motion.button
                  type="button"
                  key={p.num}
                  onClick={() => setActive(i)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    active === i
                      ? "border-foreground/50 bg-foreground/[0.04] text-foreground"
                      : "border-border bg-card/50 text-foreground/75 hover:border-foreground/30"
                  }`}
                >
                  <span className="text-[10px] font-mono text-muted-foreground">{p.num}</span>
                  <span className="truncate">{p.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Right: phone */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            {/* Soft glow */}
            <div
              className="absolute inset-0 -z-10 mx-auto h-[420px] w-[420px] rounded-full blur-3xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)",
              }}
              aria-hidden="true"
            />
            <Phone active={active} />

            {/* Thumbnail strip */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {screens.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    active === i
                      ? "border-foreground/50 bg-foreground text-background"
                      : "border-border bg-card/50 text-foreground/60 hover:border-foreground/30"
                  }`}
                  aria-label={`Show ${s.label} screen`}
                >
                  <s.icon size={11} />
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default StudioShowcase;