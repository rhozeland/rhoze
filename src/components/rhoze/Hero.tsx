import { motion } from "framer-motion";
import { ArrowUpRight, Zap, Users, Music, ShoppingBag } from "lucide-react";

const cards = [
  { icon: Music, label: "Studio Sessions", delay: 0.3 },
  { icon: ShoppingBag, label: "Marketplace", delay: 0.45 },
  { icon: Users, label: "Community", delay: 0.6 },
  { icon: Zap, label: "Artist Tools", delay: 0.75 },
];

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel animate-float" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--rhoze-mint)/0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--rhoze-pink)/0.4),transparent_50%)]" />

      <div className="relative z-10 container mx-auto px-6 py-32">
        <div className="flex flex-col items-center text-center mb-16">
          {/* Logo */}
          <motion.img
            src="/images/rhozeland_official_logo_2025.png"
            alt="Rhozeland logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="w-20 h-20 object-contain mb-6"
          />

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display leading-[1] tracking-tight mb-5 text-foreground"
          >
            The Creator
            <br />
            <span className="text-gradient-pastel">Ecosystem</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-muted-foreground max-w-md mb-8 font-body leading-relaxed"
          >
            Everything you need to create, grow, and earn — all under one roof.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-3"
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

        {/* Glassmorphism cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {cards.map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: card.delay }}
              whileHover={{ y: -6, scale: 1.03 }}
              className="group relative rounded-2xl p-5 flex flex-col items-center gap-3
                backdrop-blur-xl bg-card/40 border border-border/50
                shadow-soft hover:shadow-lift transition-shadow cursor-default"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-mint flex items-center justify-center">
                <card.icon size={20} className="text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground font-body">
                {card.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
