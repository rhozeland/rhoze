import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Soft gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel" />

      <div className="relative z-10 container mx-auto px-6 flex flex-col items-center text-center pt-24 pb-32">
        {/* Logo */}
        <motion.img
          src="/images/rhozeland_official_logo_2025.png"
          alt="Rhozeland logo"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-36 h-36 object-contain mb-6"
        />

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display leading-[1.05] tracking-tight mb-6 text-foreground"
        >
          The Creator
          <br />
          Ecosystem
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-base sm:text-lg text-muted-foreground max-w-lg mb-10 font-body leading-relaxed"
        >
          Studio sessions, content production, a services marketplace, artist
          tools, and a community that fuels your growth — all under one roof.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <a
            href="https://app.rhozeland.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-foreground text-background font-semibold hover:opacity-90 transition-opacity text-base"
          >
            Log In <ArrowUpRight size={16} />
          </a>
          <a
            href="#about"
            className="px-10 py-4 rounded-full border border-border text-foreground hover:bg-muted transition-colors text-base font-body"
          >
            Explore
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
