import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Menu, X, Sparkles, ArrowUpRight, BookOpen, Layers, MessageCircle } from "lucide-react";
import logoBlack from "@/assets/logo-black.webp";
import logoWhite from "@/assets/logo-white.webp";
import logoColor from "@/assets/logo-color.webp";

const navLinks: { label: string; href: string; icon: typeof BookOpen; external?: boolean }[] = [
  { label: "About", href: "/about.html", icon: BookOpen },
  { label: "Work", href: "/projects.html", icon: Layers },
  { label: "Connect", href: "/contact.html", icon: MessageCircle },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [produceIdx, setProduceIdx] = useState(0);
  const [distIdx, setDistIdx] = useState(0);

  const distributeSlides = [
    {
      kind: "music" as const,
      tag: "Now Playing",
      title: "FUS — Rhozeland",
      cover:
        "radial-gradient(120% 80% at 0% 0%, hsl(330 90% 65% / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(200 90% 60% / 0.85), transparent 60%), linear-gradient(135deg, hsl(280 70% 35%), hsl(20 80% 45%))",
    },
    {
      kind: "drop" as const,
      tag: "New Drop",
      title: "Saint Flair West · Ooak",
      cover:
        "radial-gradient(120% 80% at 0% 0%, hsl(20 95% 60% / 0.9), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(330 85% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(340 70% 35%), hsl(10 80% 45%))",
    },
    {
      kind: "space" as const,
      tag: "Live Space",
      title: "Creator Roundtable · 12",
      cover:
        "radial-gradient(120% 80% at 0% 0%, hsl(160 80% 55% / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(200 90% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(190 70% 30%), hsl(150 70% 35%))",
    },
    {
      kind: "event" as const,
      tag: "Upcoming Event",
      title: "Land Sessions · LA",
      cover:
        "radial-gradient(120% 80% at 0% 0%, hsl(48 95% 60% / 0.9), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(20 90% 55% / 0.9), transparent 60%), linear-gradient(135deg, hsl(30 80% 35%), hsl(48 80% 45%))",
    },
    {
      kind: "rewards" as const,
      tag: "$Rhoze Rewards",
      title: "Tier 3 · Citizen +250",
      cover:
        "radial-gradient(120% 80% at 0% 0%, hsl(48 95% 65% / 0.95), transparent 60%), radial-gradient(120% 80% at 100% 100%, hsl(330 90% 60% / 0.85), transparent 60%), linear-gradient(135deg, hsl(48 80% 40%), hsl(20 85% 45%))",
    },
  ];

  const producePool = [
    { img: "/images/ooak-the-mask-thumb.webp", tag: "Music Video", title: "The Mask", artist: "Ooak" },
    { img: "/images/fingaz-mansa-musa-thumb.webp", tag: "Music Video", title: "Mansa Musa", artist: "MONEE FINGAZ" },
    { img: "/images/rhozeland-fus-thumb.webp", tag: "EP", title: "FUS", artist: "Rhozeland" },
    { img: "/images/holy-water-thumb.webp", tag: "Music Video", title: "Holy Water", artist: "Cozal" },
    { img: "/images/vampurp-2027-thumb.webp", tag: "Music Video", title: "2027", artist: "Vampurp" },
    { img: "/images/fingaz-superhero-thumb.webp", tag: "Music Video", title: "Feel Like A Superhero", artist: "MONEE FINGAZ" },
    { img: "/images/carina-lucky-charm-thumb.webp", tag: "Music Video", title: "Lucky Charm", artist: "Carina" },
    { img: "/images/steelo-u-outta-know-thumb.webp", tag: "Music Video", title: "U Outta Know", artist: "YOUNG $TEELO" },
    { img: "/images/rc1-thumb.webp", tag: "Campaign", title: "Who Runs The World?", artist: "Runner's Club" },
    { img: "/images/straightdizzy-the-only-reason-thumb.webp", tag: "Music Video", title: "The Only Reason", artist: "Straightdizzy" },
    { img: "/images/bk-whiskey-mma-thumb.webp", tag: "Campaign", title: "United MMA", artist: "BK Whiskey" },
    { img: "/images/ooak-saint-flair-west-thumb.webp", tag: "Album", title: "Saint Flair West", artist: "Ooak" },
  ];
  const [produceSlides, setProduceSlides] = useState(() => pickRandom(producePool, 3));

  function pickRandom<T>(arr: T[], n: number): T[] {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  useEffect(() => {
    if (!createOpen) return;
    setProduceSlides(pickRandom(producePool, 3));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    setProduceIdx(0);
    const t = setInterval(() => setProduceIdx((i) => (i + 1) % produceSlides.length), 3200);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
      clearInterval(t);
    };
  }, [createOpen, produceSlides.length]);

  useEffect(() => {
    if (!createOpen) return;
    setDistIdx(0);
    const t = setInterval(() => setDistIdx((i) => (i + 1) % distributeSlides.length), 2800);
    return () => clearInterval(t);
  }, [createOpen, distributeSlides.length]);

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border"
    >
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        <a
          href="#"
          className="flex items-center gap-2.5 group"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="relative w-8 h-8">
            {/* Default logos */}
            <img
              src={logoBlack}
              alt="Rhozeland logo"
              className="absolute inset-0 w-8 h-8 object-contain dark-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            <img
              src={logoWhite}
              alt="Rhozeland logo"
              className="absolute inset-0 w-8 h-8 object-contain light-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            {/* Color logo on hover */}
            <img
              src={logoColor}
              alt="Rhozeland Toybox logo"
              className="absolute inset-0 w-8 h-8 object-contain transition-all duration-300"
              style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(20deg)' }}
            />
          </div>
          <span className="font-display text-xl font-semibold text-foreground tracking-normal">Rhozeland</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.label}
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex items-center gap-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-transparent group-hover:border-border/60 group-hover:bg-muted/30 transition-all">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-xs font-medium group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-out">
                  {link.label}
                </span>
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Sparkles size={15} />
            <span>Build</span>
          </button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden bg-card border-t border-border px-6 pb-6"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.label}
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 py-3 text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                <Icon size={18} strokeWidth={1.8} />
                {link.label}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => { setOpen(false); setCreateOpen(true); }}
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground"
          >
            <Sparkles size={15} />
            Build
          </button>
        </motion.div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setCreateOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-[hsl(240_12%_7%)] text-white shadow-2xl"
          >
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(330 90% 70%), hsl(28 95% 65%), hsl(48 95% 65%), hsl(150 70% 60%), hsl(195 90% 65%), hsl(260 80% 70%))",
              }}
            />
            <div className="p-6 sm:p-10">
              <div className="mb-6 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/90 transition-colors hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
              <h2
                id="create-modal-title"
                className="mb-6 whitespace-nowrap overflow-hidden text-ellipsis text-lg font-extrabold leading-[1.02] tracking-tight sm:text-2xl lg:text-3xl"
              >
                What are we building next?
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Produce — project carousel */}
                <a
                  href="/start.html"
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[hsl(240_18%_5%)] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[hsl(240_18%_7%)]"
                >
                  <div className="relative h-[132px] overflow-hidden border-b border-white/[0.06] bg-[hsl(240_30%_4%)]">
                    {produceSlides.map((s, i) => (
                      <div
                        key={s.title}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{ opacity: i === produceIdx ? 1 : 0, zIndex: i === produceIdx ? 1 : 0 }}
                      >
                        <img src={s.img} alt={`${s.title} — ${s.artist}`} className="h-full w-full object-cover" loading="lazy" />
                        <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-5" style={{ background: "linear-gradient(180deg, transparent, hsl(240 30% 4% / 0.85) 70%)" }}>
                          <span className="mb-1 inline-block rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white">{s.tag}</span>
                          <div className="text-sm font-bold tracking-tight text-white">{s.title}</div>
                          <div className="text-[0.7rem] text-white/75">{s.artist}</div>
                        </div>
                      </div>
                    ))}
                    <div className="absolute bottom-2 right-2.5 z-[2] flex gap-1.5">
                      {produceSlides.map((s, i) => (
                        <button
                          key={s.title}
                          type="button"
                          aria-label={`Slide ${i + 1}`}
                          onClick={(e) => { e.preventDefault(); setProduceIdx(i); }}
                          className="h-1.5 rounded-full bg-white/40 transition-all"
                          style={{ width: i === produceIdx ? 18 : 6, background: i === produceIdx ? "white" : undefined }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="relative flex flex-col gap-1 px-4 pb-3.5 pt-3">
                    <ArrowUpRight size={16} className="absolute right-3 top-3 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    <h3 className="text-xl font-bold tracking-tight">Produce</h3>
                    <p className="max-h-0 overflow-hidden text-[0.78rem] leading-snug text-white/60 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-[4em] group-hover:opacity-100">
                      Studio, visuals, rollout, launch planning.
                    </p>
                  </div>
                </a>

                {/* Distribute — Creator OS preview */}
                <a
                  href="https://rhozeland.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[hsl(240_18%_5%)] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[hsl(240_18%_7%)]"
                >
                  <div
                    className="relative h-[132px] overflow-hidden border-b border-white/[0.06] p-2.5"
                    style={{
                      background:
                        "radial-gradient(60% 80% at 20% 0%, hsl(280 60% 30% / 0.35), transparent 70%), radial-gradient(60% 80% at 100% 100%, hsl(200 70% 35% / 0.35), transparent 70%), hsl(240 30% 4%)",
                    }}
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-[hsl(240_18%_7%)] shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[hsl(240_18%_5%)] px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold">
                          <span
                            className="h-3 w-3 rounded"
                            style={{ background: "linear-gradient(135deg, hsl(330 90% 65%), hsl(28 95% 60%) 40%, hsl(48 95% 60%) 65%, hsl(200 90% 60%))", boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.2)" }}
                          />
                          Creator OS
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-1.5 py-0.5 text-[0.5rem] font-bold tracking-[0.18em] text-white/90">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-[hsl(135_80%_55%)]" />
                          LIVE
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-2 min-h-0">
                        <div className="grid flex-1 grid-cols-[42px_1fr_auto] items-center gap-2 rounded-lg border border-white/[0.06] bg-[hsl(240_18%_9%)] px-2 py-1.5 min-h-0">
                          <div className="relative h-[42px] w-[42px] overflow-hidden rounded-md" style={{ boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.12)" }}>
                            <div
                              key={`cover-${distIdx}`}
                              className="absolute inset-0 rounded-md animate-fade-in"
                              style={{ background: distributeSlides[distIdx].cover }}
                            />
                          </div>
                          <div className="relative flex min-w-0 flex-col gap-1">
                            <div key={`meta-${distIdx}`} className="flex min-w-0 flex-col gap-1 animate-fade-in">
                                <span className="self-start rounded-full bg-white/10 px-1.5 py-[1px] text-[0.45rem] font-bold uppercase tracking-[0.16em] text-white/85">{distributeSlides[distIdx].tag}</span>
                                <div className="truncate text-[0.7rem] font-bold leading-tight">{distributeSlides[distIdx].title}</div>
                                <div className="flex h-[10px] items-center gap-1.5 text-[0.5rem] font-semibold text-white/70" aria-hidden="true">
                                  {distributeSlides[distIdx].kind === "music" && (
                                    <span className="flex h-full items-end gap-[2px]">
                                      {Array.from({ length: 10 }).map((_, i) => (
                                        <span
                                          key={i}
                                          className="block w-[2px] rounded-[1px]"
                                          style={{
                                            background: "linear-gradient(180deg, hsl(330 90% 70%), hsl(200 90% 65%))",
                                            animation: "cm-eq 1.1s ease-in-out infinite",
                                            animationDelay: `${-(((i * 37) % 100) / 100).toFixed(2)}s`,
                                            height: "60%",
                                          }}
                                        />
                                      ))}
                                    </span>
                                  )}
                                  {distributeSlides[distIdx].kind === "drop" && (
                                    <span className="leading-none tracking-[0.14em] uppercase text-white/85">Out now · Album</span>
                                  )}
                                  {distributeSlides[distIdx].kind === "space" && (
                                    <>
                                      <span className="h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-[hsl(135_80%_55%)]" />
                                      <span className="leading-none tracking-[0.06em] text-white/85">12 in space</span>
                                    </>
                                  )}
                                  {distributeSlides[distIdx].kind === "event" && (
                                    <span className="leading-none tracking-[0.14em] uppercase text-white/85">Sat · 8 PM · RSVP</span>
                                  )}
                                  {distributeSlides[distIdx].kind === "rewards" && (
                                    <span className="relative block h-[5px] w-full shrink overflow-hidden rounded-full bg-white/15">
                                      <span className="absolute inset-y-0 left-0 w-[62%] rounded-full" style={{ background: "linear-gradient(90deg, hsl(48 95% 60%), hsl(330 90% 60%))" }} />
                                    </span>
                                  )}
                                </div>
                            </div>
                          </div>
                          <span
                            key={`act-${distIdx}`}
                            className="inline-flex h-[26px] w-[26px] shrink-0 animate-scale-in items-center justify-center rounded-full bg-white text-[hsl(240_18%_7%)] shadow-md"
                          >
                              {distributeSlides[distIdx].kind === "music" && (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                              )}
                              {distributeSlides[distIdx].kind === "drop" && (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                              )}
                              {distributeSlides[distIdx].kind === "space" && (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
                              )}
                              {distributeSlides[distIdx].kind === "event" && (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                              )}
                              {distributeSlides[distIdx].kind === "rewards" && (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5h-4a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3h-4M12 7.5V9M12 15v1.5" /></svg>
                              )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex flex-col gap-1 px-4 pb-3.5 pt-3">
                    <ArrowUpRight size={16} className="absolute right-3 top-3 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    <h3 className="text-xl font-bold tracking-tight">Distribute</h3>
                    <p className="max-h-0 overflow-hidden text-[0.78rem] leading-snug text-white/60 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-[4em] group-hover:opacity-100">
                      Publish, connect, and keep your release moving.
                    </p>
                  </div>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.nav>
  );
};

export default Navbar;