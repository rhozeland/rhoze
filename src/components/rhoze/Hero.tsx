import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(0 0% 0% / 0.04) 1px, transparent 1px), linear-gradient(to bottom, hsl(0 0% 0% / 0.04) 1px, transparent 1px)",
          backgroundSize: "33.333% 25%",
        }}
      />

      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(0 0% 0%) 0.8px, transparent 0.8px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Animated gradient blobs */}
      <div className="absolute inset-0 z-[2] overflow-hidden">
        {/* Main iridescent blob */}
        <motion.div
          className="absolute w-[900px] h-[900px] rounded-full blur-[80px] opacity-70"
          style={{
            background:
              "conic-gradient(from 180deg, hsl(280 80% 60%), hsl(200 90% 50%), hsl(150 80% 50%), hsl(330 80% 60%), hsl(280 80% 60%))",
            top: "-20%",
            right: "-10%",
          }}
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
        />

        {/* Secondary flowing blob */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-50"
          style={{
            background:
              "conic-gradient(from 90deg, hsl(170 80% 55%), hsl(280 70% 65%), hsl(330 80% 70%), hsl(170 80% 55%))",
            bottom: "-10%",
            left: "-5%",
          }}
          animate={{
            rotate: [360, 0],
            x: [0, 80, 0],
            y: [0, -40, 0],
          }}
          transition={{
            rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            x: { duration: 12, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
          }}
        />

        {/* Accent streak */}
        <motion.div
          className="absolute w-[500px] h-[200px] blur-[60px] opacity-40"
          style={{
            background:
              "linear-gradient(135deg, hsl(340 90% 60%), hsl(30 90% 60%), transparent)",
            top: "30%",
            left: "20%",
            borderRadius: "50%",
          }}
          animate={{
            x: [0, 200, 0],
            y: [0, -60, 0],
            rotate: [0, 15, -15, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Content — bottom-left aligned */}
      <div className="relative z-10 container mx-auto px-6 lg:px-16 min-h-screen flex flex-col justify-end pb-16 lg:pb-24">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold font-display leading-[0.95] tracking-tight text-foreground mb-8"
          style={{ textShadow: "0 2px 30px hsl(0 0% 100% / 0.6)" }}
        >
          The Creator
          <br />
          Ecosystem
        </motion.h1>

        {/* Bottom row: CTA + description */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-start gap-6"
        >
          <a
            href="https://app.rhozeland.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-foreground text-background font-semibold hover:opacity-90 transition-opacity text-base"
          >
            Log In <ArrowUpRight size={16} />
          </a>

          <p className="text-sm sm:text-base text-muted-foreground max-w-sm font-body leading-relaxed">
            Studio sessions, content production, a services marketplace, artist
            tools, and a community that fuels your growth.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
