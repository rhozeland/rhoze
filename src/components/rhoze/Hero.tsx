import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Calendar, Music, Palette, Users, Zap } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import logoBlack from "@/assets/logo-black.png";

const offerCards = [
  {
    icon: Music,
    title: "Studio sessions",
    desc: "Recording, development, and release-ready support without the usual handoff chaos.",
  },
  {
    icon: Palette,
    title: "Content production",
    desc: "Creative direction, visuals, edits, and rollout assets built as one system.",
  },
  {
    icon: Zap,
    title: "Creator OS",
    desc: "Tools, services, and launch infrastructure that keep momentum compounding.",
  },
];

const networkPoints = [
  {
    icon: Users,
    title: "Community touchpoints",
    desc: "Creator conversations, collaborations, and support loops that keep the work circulating.",
  },
  {
    icon: Calendar,
    title: "IRL + digital programming",
    desc: "Showcases, social nights, drops, and activations that make the brand feel alive.",
  },
  {
    icon: Zap,
    title: "Launch support",
    desc: "A tighter path from idea to rollout so the next move actually ships.",
  },
];

const Hero = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(0 0% 50% / 0.04) 1px, transparent 1px), linear-gradient(to bottom, hsl(0 0% 50% / 0.04) 1px, transparent 1px)",
          backgroundSize: "33.333% 25%",
        }}
      />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 0.6px, transparent 0.6px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Animated gradient blobs */}
      <div className="absolute inset-0 z-[2] overflow-hidden" style={{ mixBlendMode: 'normal' }}>
        <motion.div
          className="absolute h-[640px] w-[640px] rounded-full blur-[100px] opacity-50"
          style={{
            background:
              "conic-gradient(from 180deg, hsl(var(--primary) / 0.9), hsl(var(--accent) / 0.88), hsl(var(--secondary) / 0.9), hsl(var(--primary) / 0.9))",
            top: "-18%",
            right: "-12%",
          }}
          animate={
            shouldReduceMotion
              ? undefined
              : { rotate: [0, 360], scale: [1, 1.05, 0.95, 1] }
          }
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
          aria-hidden="true"
        />
        <motion.div
          className="absolute h-[460px] w-[460px] rounded-full blur-[120px] opacity-35"
          style={{
            background:
              "conic-gradient(from 90deg, hsl(var(--secondary) / 0.8), hsl(var(--primary) / 0.82), hsl(var(--accent) / 0.75), hsl(var(--secondary) / 0.8))",
            bottom: "-10%",
            left: "-8%",
          }}
          animate={
            shouldReduceMotion
              ? undefined
              : { rotate: [360, 0], x: [0, 80, 0], y: [0, -40, 0] }
          }
          transition={{
            rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            x: { duration: 12, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
          }}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto max-w-6xl px-6 py-28 lg:pb-20 lg:pt-36 [&_h1]:drop-shadow-[0_1px_1px_hsl(var(--background)/0.5)] [&_h2]:drop-shadow-[0_1px_1px_hsl(var(--background)/0.3)]">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:gap-14">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-6 flex flex-wrap items-center gap-4"
            >
              <img src={logoWhite} alt="Rhozeland" className="hidden h-11 w-auto dark:block" />
              <img src={logoBlack} alt="Rhozeland" className="h-11 w-auto dark:hidden" />
              <span className="inline-flex items-center rounded-full border border-border/70 bg-card/55 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-sm">
                Creator OS + Studio
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: "easeOut" }}
              className="text-5xl font-semibold leading-[0.92] tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-[5.9rem]"
            >
              One studio. Every moving part.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: "easeOut" }}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Record, produce, launch, and grow with one system built for creators.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.26, ease: "easeOut" }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <a
                href="https://app.rhozeland.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:px-8"
              >
                Enter Creator OS <ArrowUpRight size={16} />
              </a>
              <a
                href="/projects.html"
                className="inline-flex items-center gap-3 rounded-full border border-border bg-background/40 px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-card/70 sm:px-8"
              >
                See projects
              </a>
            </motion.div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {offerCards.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.34 + index * 0.08, ease: "easeOut" }}
                  className="rounded-[1.5rem] border border-border/70 bg-card/55 p-4 backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <item.icon size={18} />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 p-6 shadow-lift backdrop-blur-xl sm:p-7 lg:p-8"
          >
            <motion.div
              className="absolute -right-8 -top-10 h-40 w-40 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)",
              }}
              animate={
                shouldReduceMotion
                  ? undefined
                  : { x: [0, 16, -8, 0], y: [0, -18, 10, 0], scale: [1, 1.08, 0.96, 1] }
              }
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
            <motion.div
              className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, hsl(var(--secondary) / 0.28), transparent 68%)",
              }}
              animate={
                shouldReduceMotion
                  ? undefined
                  : { x: [0, -24, 10, 0], y: [0, 18, -8, 0], scale: [1, 0.94, 1.06, 1] }
              }
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
            <motion.div
              className="absolute left-10 top-1/2 h-28 w-40 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, hsl(var(--accent) / 0.24), transparent 72%)",
              }}
              animate={
                shouldReduceMotion
                  ? undefined
                  : { x: [0, 12, -12, 0], y: [0, -12, 12, 0], opacity: [0.6, 1, 0.7, 0.6] }
              }
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              <span className="mb-4 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                The Network
              </span>
              <h2 className="max-w-sm text-3xl font-semibold leading-tight text-foreground sm:text-[2.35rem]">
                Rhozeland moves in public.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                From studio sessions and rollout support to showcases, creator conversations, and digital
                tools, the ecosystem is designed to keep people meeting, making, and shipping together.
              </p>

              <div className="mt-6 space-y-3">
                {networkPoints.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.35rem] border border-border/70 bg-background/45 p-4 backdrop-blur-sm"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                      <item.icon size={18} />
                    </div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-border/70 bg-background/55 p-5 backdrop-blur-sm">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Stay close to the drops
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Explore projects, events, and creator opportunities from the same intro area instead of a
                  separate oversized newsletter block.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/events.html"
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Explore events
                  </a>
                  <a
                    href="/contact.html"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-card/70"
                  >
                    Join the network
                  </a>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
};

export default Hero;
