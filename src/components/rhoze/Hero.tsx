import { motion } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Pastel gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel opacity-60" />

      <div className="relative z-10 container mx-auto px-6 flex flex-col items-center text-center py-32">
        {/* Logo */}
        <motion.img
          src="/images/rhozeland_official_logo_2025.png"
          alt="Rhozeland logo"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="w-40 h-40 sm:w-48 sm:h-48 object-contain mb-6"
        />

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display leading-[1] tracking-tight mb-6 text-foreground"
        >
          The Creator
          <br />
          Ecosystem
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-base sm:text-lg text-muted-foreground max-w-lg mb-10 font-body leading-relaxed"
        >
          Studio sessions, content production, a services marketplace, artist tools, and a community that fuels your growth — all under one roof.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-semibold hover:opacity-90 transition-opacity text-base"
          >
            Buy $RHOZE <ArrowUpRight size={16} />
          </a>
          <a
            href="#about"
            className="px-8 py-3.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors text-base font-body"
          >
            Explore
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ArrowDown className="text-muted-foreground" size={20} />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
