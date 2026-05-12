import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Menu, X, Sparkles, ArrowUpRight } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

const navLinks = [
  { label: "About", href: "/about.html" },
  { label: "Projects", href: "/projects.html" },
  { label: "Shop", href: "https://rhozeland.shop", external: true },
  { label: "Contact", href: "/contact.html" },
];

const produceShots = [
  { src: "/images/ooak-the-mask-thumb.jpg",      title: "The Mask",     artist: "Ooak",         tag: "Music Video" },
  { src: "/images/fingaz-mansa-musa-thumb.png",  title: "Mansa Musa",   artist: "MONEE FINGAZ", tag: "Music Video" },
  { src: "/images/iimpct-media-thumb.png",       title: "iiMPCT Media", artist: "In Studio",    tag: "Web Series" },
  { src: "/images/carina-lucky-charm-thumb.jpg", title: "Lucky Charm",  artist: "Carina",       tag: "Single" },
  { src: "/images/cozal-holy-water-thumb.png",   title: "Holy Water",   artist: "Cozal",        tag: "Music Video" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const timer = window.setInterval(() => {
      setSlide((s) => (s + 1) % produceShots.length);
    }, 3200);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
      window.clearInterval(timer);
    };
  }, [createOpen]);

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

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Create
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
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted-foreground hover:text-foreground transition-colors font-body"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); setCreateOpen(true); }}
            className="mt-3 inline-block px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground"
          >
            Create
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
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[hsl(240_12%_7%)] text-white shadow-2xl"
          >
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(330 90% 70%), hsl(28 95% 65%), hsl(48 95% 65%), hsl(150 70% 60%), hsl(195 90% 65%), hsl(260 80% 70%))",
              }}
            />
            <div className="p-6 sm:p-10">
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                  <Sparkles size={12} /> Create
                </span>
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
                className="mb-8 max-w-[12ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl"
              >
                What are we building next?
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Produce — carousel */}
                <a
                  href="/start.html"
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[hsl(240_18%_5%)] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[hsl(240_18%_7%)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[hsl(240_30%_4%)]">
                    <AnimatePresence>
                      <motion.img
                        key={slide}
                        src={produceShots[slide].src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{ opacity: 1, scale: 1.08 }}
                        exit={{ opacity: 0 }}
                        transition={{ opacity: { duration: 0.7 }, scale: { duration: 6, ease: "linear" } }}
                      />
                    </AnimatePresence>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[hsl(240_30%_4%)]/85 to-transparent p-4 pt-8">
                      <span className="inline-block rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.18em] text-white">
                        {produceShots[slide].tag}
                      </span>
                      <div className="mt-1 text-base font-bold tracking-tight text-white">{produceShots[slide].title}</div>
                      <div className="text-xs text-white/70">{produceShots[slide].artist}</div>
                    </div>
                    <div className="absolute bottom-2 right-2 z-10 flex gap-1">
                      {produceShots.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Show project ${i + 1}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSlide(i); }}
                          className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold tracking-tight">Produce</h3>
                      <ArrowUpRight size={16} className="text-white/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <p className="max-w-[38ch] text-sm leading-relaxed text-white/70">
                      Start a project with Rhozeland for studio, visuals, rollout support, and launch planning.
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
                    className="relative aspect-[16/10] p-3"
                    style={{
                      background:
                        "radial-gradient(60% 80% at 20% 0%, hsl(280 60% 30% / 0.35), transparent 70%), radial-gradient(60% 80% at 100% 100%, hsl(200 70% 35% / 0.35), transparent 70%), hsl(240 30% 4%)",
                    }}
                  >
                    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[hsl(240_18%_7%)] shadow-[0_14px_40px_hsl(240_50%_2%/0.55)]">
                      <div className="flex items-center gap-1.5 border-b border-white/5 bg-[hsl(240_18%_5%)] px-2 py-1.5 text-[0.6rem] text-white/55">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="ml-2 font-mono text-white/75">rhozeland.app <span className="opacity-55">/ creator</span></span>
                      </div>
                      <div className="flex flex-1 min-h-0 flex-col gap-2 p-2.5 text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[0.78rem] font-bold">
                            <span
                              className="h-4 w-4 rounded"
                              style={{
                                background:
                                  "linear-gradient(135deg, hsl(330 90% 65%), hsl(28 95% 60%) 40%, hsl(48 95% 60%) 65%, hsl(200 90% 60%))",
                                boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.2)",
                              }}
                            />
                            Creator OS
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[0.5rem] font-bold tracking-[0.18em] text-white/90">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(135_80%_55%/0.7)]" />
                            LIVE
                          </span>
                        </div>
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-white/5 bg-[hsl(240_18%_9%)] px-2 py-1.5">
                          <span
                            className="h-7 w-7 rounded-full ring-2 ring-[hsl(240_18%_9%)]"
                            style={{
                              background:
                                "conic-gradient(from 180deg, hsl(330 90% 65%), hsl(28 95% 60%), hsl(200 90% 60%), hsl(330 90% 65%))",
                            }}
                          />
                          <div>
                            <div className="text-[0.78rem] font-bold leading-tight">Your studio name</div>
                            <div className="text-[0.6rem] text-white/55">@yourhandle · 12.4k network</div>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[0.6rem] font-bold tracking-wide text-[hsl(240_18%_7%)]">
                            Go live
                          </span>
                        </div>
                        <div className="flex gap-1 rounded-full border border-white/5 bg-[hsl(240_18%_5%)] p-0.5">
                          {["Drops", "Releases", "Earnings", "Network"].map((t, i) => (
                            <span
                              key={t}
                              className={`flex-1 rounded-full px-1 py-1 text-center text-[0.6rem] font-semibold ${
                                i === 0 ? "bg-white/10 text-white" : "text-white/55"
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { t: "New Drop", m: "Live · 2.1k holders", g: "linear-gradient(135deg, hsl(280 60% 45%), hsl(220 70% 38%))" },
                            { t: "Single", m: "Stream · 48h boost",   g: "linear-gradient(135deg, hsl(345 70% 50%), hsl(20 80% 50%))" },
                            { t: "Earnings", m: "+ $3,290 / wk",      g: "linear-gradient(135deg, hsl(170 70% 42%), hsl(200 70% 38%))" },
                          ].map((c) => (
                            <div key={c.t} className="flex flex-col gap-1 rounded-md border border-white/5 bg-[hsl(240_18%_9%)] p-1.5">
                              <div className="h-7 rounded" style={{ background: c.g }} />
                              <div className="text-[0.62rem] font-bold leading-tight">{c.t}</div>
                              <div className="text-[0.55rem] text-white/55">{c.m}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto flex flex-wrap gap-1">
                          {["Publish", "Schedule", "Collab"].map((c) => (
                            <span key={c} className="rounded-full border border-white/10 bg-[hsl(240_18%_5%)] px-2 py-0.5 text-[0.58rem] font-semibold text-white/75">
                              {c}
                            </span>
                          ))}
                          <span
                            className="rounded-full border border-transparent px-2 py-0.5 text-[0.58rem] font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, hsl(280 60% 35%), hsl(330 70% 45%))" }}
                          >
                            $RHOZE rewards
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold tracking-tight">Distribute</h3>
                      <ArrowUpRight size={16} className="text-white/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <p className="max-w-[38ch] text-sm leading-relaxed text-white/70">
                      Open the creator app to publish, connect, and keep your release moving through the network.
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