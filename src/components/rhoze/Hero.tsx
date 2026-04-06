import { motion } from "framer-motion";
import { ArrowUpRight, Music, Palette, Users, Zap } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import logoBlack from "@/assets/logo-black.png";

const pillars = [
  { icon: Music, label: "Studio Sessions", delay: 0.4 },
  { icon: Palette, label: "Content Production", delay: 0.5 },
  { icon: Users, label: "Community", delay: 0.6 },
  { icon: Zap, label: "Artist Tools", delay: 0.7 },
];

const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
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
      <div className="absolute inset-0 z-[2] overflow-hidden">
        <motion.div
          className="absolute w-[900px] h-[900px] rounded-full blur-[100px] opacity-60"
          style={{
            background:
              "conic-gradient(from 180deg, hsl(280 80% 60%), hsl(200 90% 50%), hsl(150 80% 50%), hsl(330 80% 60%), hsl(280 80% 60%))",
            top: "-30%",
            right: "-20%",
          }}
          animate={{ rotate: [0, 360], scale: [1, 1.05, 0.95, 1] }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-40"
          style={{
            background:
              "conic-gradient(from 90deg, hsl(170 80% 55%), hsl(280 70% 65%), hsl(330 80% 70%), hsl(170 80% 55%))",
            bottom: "-15%",
            left: "-10%",
          }}
          animate={{ rotate: [360, 0], x: [0, 80, 0], y: [0, -40, 0] }}
          transition={{
            rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            x: { duration: 12, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 lg:px-16 flex flex-col items-center text-center py-32">
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8"
        >
          <img
            src={logoWhite}
            alt="Rhozeland"
            className="h-16 w-auto hidden dark:block"
          />
          <img
            src={logoBlack}
            alt="Rhozeland"
            className="h-16 w-auto dark:hidden"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold font-display leading-[0.95] tracking-tight text-foreground mb-6"
        >
          The Creator
          <br />
          Ecosystem
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-base sm:text-lg text-muted-foreground max-w-lg font-body leading-relaxed mb-10"
        >
          Studio sessions, content production, a services marketplace, artist
          tools, and a community that fuels your growth — all under one roof.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-16"
        >
          <a
            href="https://app.rhozeland.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-10 py-4 bg-foreground text-background font-semibold rounded-full hover:opacity-90 transition-opacity text-base"
          >
            Log In <ArrowUpRight size={16} />
          </a>
          <a
            href="#about"
            className="inline-flex items-center gap-3 px-10 py-4 border border-border text-foreground font-semibold rounded-full hover:bg-foreground/5 transition-colors text-base"
          >
            Explore
          </a>
        </motion.div>

        {/* Pillar chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {pillars.map((p) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/60 bg-background/50 backdrop-blur-sm text-sm text-muted-foreground"
            >
              <p.icon size={14} className="text-foreground/70" />
              {p.label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
