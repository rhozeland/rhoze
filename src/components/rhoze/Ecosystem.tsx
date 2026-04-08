import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ShoppingBag, Briefcase, Music, RefreshCw, TrendingDown, Gift, ArrowRight, Zap } from "lucide-react";

const revenueSources = [
  {
    icon: ShoppingBag,
    label: "Clothing Drops",
    desc: "Limited runs generate direct sales revenue that feeds the treasury.",
    flow: "Margins from every drop enter the buyback pool.",
  },
  {
    icon: Briefcase,
    label: "Marketplace Fees",
    desc: "A small fee on every service booking between creators and clients.",
    flow: "Platform fees accumulate and trigger periodic buybacks.",
  },
  {
    icon: Music,
    label: "Studio Sessions",
    desc: "Recording, production, and content creation sessions booked through the platform.",
    flow: "Session revenue is split between the creator and the treasury.",
  },
];

const mechanisms = [
  {
    icon: RefreshCw,
    label: "Buybacks",
    desc: "Treasury revenue is used to purchase $RHOZE from the open market, creating consistent buy pressure.",
  },
  {
    icon: TrendingDown,
    label: "Burns",
    desc: "A portion of bought-back tokens are permanently removed from supply, making each remaining token scarcer.",
  },
  {
    icon: Gift,
    label: "Grants & Causes",
    desc: "The remaining portion funds creator grants, community initiatives, and charitable causes.",
  },
];

const Ecosystem = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="ecosystem" className="py-32 px-6 bg-rhoze-surface" ref={ref}>
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-semibold font-display mb-4 text-foreground">
            The Flywheel
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-body">
            Real revenue from real products. Every dollar earned flows back into the token through buybacks, burns, and community grants.
          </p>
        </motion.div>

        {/* Flywheel SVG */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mx-auto mb-20 w-full max-w-[28rem]"
        >
          <svg viewBox="0 0 400 400" className="w-full h-auto" role="img" aria-label="Revenue flywheel diagram">
            <circle cx="200" cy="200" r="175" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
            <circle cx="200" cy="200" r="115" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />

            <path d="M200 25 A175 175 0 0 1 375 200 L315 200 A115 115 0 0 0 200 85 Z" fill="hsl(var(--primary) / 0.22)" />
            <path d="M375 200 A175 175 0 0 1 200 375 L200 315 A115 115 0 0 0 315 200 Z" fill="hsl(var(--primary) / 0.14)" />
            <path d="M200 375 A175 175 0 0 1 25 200 L85 200 A115 115 0 0 0 200 315 Z" fill="hsl(var(--primary) / 0.10)" />
            <path d="M25 200 A175 175 0 0 1 200 25 L200 85 A115 115 0 0 0 85 200 Z" fill="hsl(var(--primary) / 0.18)" />

            <defs>
              <marker id="fwArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8Z" fill="hsl(var(--primary) / 0.55)" />
              </marker>
            </defs>
            <path d="M310 105 A130 130 0 0 1 340 175" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M295 295 A130 130 0 0 1 225 340" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M90 295 A130 130 0 0 1 60 225" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M105 105 A130 130 0 0 1 175 60" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />

            <text x="280" y="120" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Revenue</text>
            <text x="310" y="270" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Buybacks</text>
            <text x="120" y="310" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Burns</text>
            <text x="90" y="150" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Value</text>

            <circle cx="200" cy="200" r="80" fill="hsl(var(--primary))" />
            <text x="200" y="192" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="28" letterSpacing="-0.04em" fill="white">Growth</text>
            <text x="200" y="216" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="400" fontSize="11" fill="white" opacity="0.8">
              <tspan x="200" dy="0">Every loop sends value</tspan>
              <tspan x="200" dy="14">back to the ecosystem.</tspan>
            </text>
          </svg>
        </motion.div>

        {/* Revenue Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="text-primary" size={16} />
            </div>
            <h3 className="font-display text-2xl font-semibold text-foreground">Revenue Sources</h3>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-16">
          {revenueSources.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.25 + 0.08 * i }}
              className="relative rounded-2xl border border-border bg-card p-6 transition-all group hover:border-primary/30 hover:shadow-lift"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="text-primary" size={20} />
                </div>
                <h4 className="font-display text-lg font-medium text-foreground">{p.label}</h4>
              </div>
              <p className="font-body text-sm leading-relaxed text-muted-foreground mb-4">{p.desc}</p>
              <div className="flex items-start gap-2 pt-3 border-t border-border">
                <ArrowRight className="text-primary mt-0.5 shrink-0" size={14} />
                <p className="font-body text-xs leading-relaxed text-muted-foreground/80">{p.flow}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Flow Arrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex justify-center mb-16"
        >
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <div className="w-px h-8 bg-border" />
            <span className="text-xs font-body tracking-wide uppercase">flows into</span>
            <div className="w-px h-8 bg-border" />
          </div>
        </motion.div>

        {/* Mechanisms */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {mechanisms.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.55 + 0.08 * i }}
              className="relative rounded-2xl border border-border bg-card p-6 transition-all group hover:border-primary/30 hover:shadow-lift"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="text-primary" size={20} />
                </div>
                <h4 className="font-display text-lg font-medium text-foreground">{p.label}</h4>
              </div>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Ecosystem;
