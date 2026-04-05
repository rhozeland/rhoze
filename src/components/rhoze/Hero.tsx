import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Soft gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel" />

      <div className="relative z-10 container mx-auto px-6 lg:px-16 py-24 lg:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[calc(100vh-6rem)]">
          {/* Left — Text content */}
          <div className="flex flex-col gap-6 lg:gap-8 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <span className="inline-block px-4 py-1.5 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 font-body">
                Creator OS
              </span>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold font-display leading-[0.95] tracking-tight text-foreground">
                The
                <br />
                Creator
                <br />
                <span className="text-gradient-pastel">Ecosystem</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-base sm:text-lg text-muted-foreground max-w-md font-body leading-relaxed"
            >
              Studio sessions, content production, a services marketplace,
              artist tools, and a community that fuels your growth — all under
              one roof.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-start gap-3 pt-2"
            >
              <a
                href="https://app.rhozeland.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-semibold hover:opacity-90 transition-opacity text-base"
              >
                Log In <ArrowUpRight size={16} />
              </a>
              <a
                href="#about"
                className="px-8 py-3.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors text-base font-body"
              >
                Explore
              </a>
            </motion.div>
          </div>

          {/* Right — Logo graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="flex items-center justify-center order-1 lg:order-2"
          >
            <div className="relative">
              {/* Decorative glow behind logo */}
              <div className="absolute -inset-16 rounded-full bg-[radial-gradient(circle,hsl(var(--rhoze-pink)/0.3)_0%,transparent_70%)] blur-2xl" />
              <div className="absolute -inset-20 rounded-full bg-[radial-gradient(circle,hsl(var(--rhoze-mint)/0.2)_0%,transparent_70%)] blur-3xl" />
              <img
                src="/images/rhozeland_official_logo_2025.png"
                alt="Rhozeland logo"
                className="relative w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96 object-contain drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
