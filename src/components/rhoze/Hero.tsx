import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Pastel gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel opacity-60" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-card hidden lg:block" />

      <div className="relative z-10 container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left side - Hero copy */}
        <div className="py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-8 font-body">
              <span className="text-primary">✦</span> Crafting Visions, Building Futures
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display leading-[0.95] tracking-tight mb-8 text-foreground"
          >
            Your
            <br />
            Creative
            <br />
            Engine
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-base sm:text-lg text-muted-foreground max-w-md mb-10 font-body leading-relaxed"
          >
            Rhozeland is a creator-owned economy built on Solana — real clothing drops, a services marketplace, an artist app & a revenue flywheel funding buybacks, burns, grants & causes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            <a
              href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full bg-gradient-mint font-semibold text-primary-foreground shadow-soft hover:shadow-lift transition-shadow text-base"
            >
              Buy $RHOZE
            </a>
            <a
              href="#about"
              className="px-8 py-3.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors text-base font-body"
            >
              Learn More
            </a>
          </motion.div>
        </div>

        {/* Right side - decorative */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="relative w-80 h-80">
            <div className="absolute inset-0 rounded-3xl bg-gradient-pastel rotate-6 opacity-50" />
            <div className="absolute inset-4 rounded-2xl bg-card shadow-lift flex items-center justify-center">
              <span className="font-display text-6xl font-extrabold text-primary">R</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
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
