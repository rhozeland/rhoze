import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ShoppingBag, Briefcase, Music, RefreshCw, TrendingDown, Gift } from "lucide-react";

const pillars = [
  { icon: ShoppingBag, label: "Clothing Drops", desc: "Real fashion, real revenue flowing back to the ecosystem." },
  { icon: Briefcase, label: "Services Marketplace", desc: "Hire creators, freelancers & builders — all powered by $RHOZE." },
  { icon: Music, label: "Artist App", desc: "Tools for musicians, visual artists & content creators to earn and grow." },
  { icon: RefreshCw, label: "Buybacks", desc: "Revenue fuels token buybacks, strengthening the floor." },
  { icon: TrendingDown, label: "Burns", desc: "Deflationary by design. Supply shrinks as the ecosystem grows." },
  { icon: Gift, label: "Grants & Causes", desc: "Funding the dreamers, supporting the communities that need it most." },
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
          <p className="text-muted-foreground max-w-xl mx-auto text-lg font-body">
            Every piece of the ecosystem feeds the next. Revenue in, value out, community first.
          </p>
        </motion.div>

        {/* Flywheel SVG */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mx-auto mb-16 w-full max-w-[28rem]"
        >
          <svg viewBox="0 0 400 400" className="w-full h-auto" role="img" aria-label="Revenue flywheel diagram">
            {/* Outer ring segments */}
            <circle cx="200" cy="200" r="175" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
            <circle cx="200" cy="200" r="115" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />

            {/* Segment fills — four quadrants */}
            <path d="M200 25 A175 175 0 0 1 375 200 L315 200 A115 115 0 0 0 200 85 Z" fill="hsl(var(--primary) / 0.22)" />
            <path d="M375 200 A175 175 0 0 1 200 375 L200 315 A115 115 0 0 0 315 200 Z" fill="hsl(var(--primary) / 0.14)" />
            <path d="M200 375 A175 175 0 0 1 25 200 L85 200 A115 115 0 0 0 200 315 Z" fill="hsl(var(--primary) / 0.10)" />
            <path d="M25 200 A175 175 0 0 1 200 25 L200 85 A115 115 0 0 0 85 200 Z" fill="hsl(var(--primary) / 0.18)" />

            {/* Curved arrows between segments */}
            <defs>
              <marker id="fwArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8Z" fill="hsl(var(--primary) / 0.55)" />
              </marker>
            </defs>
            <path d="M310 105 A130 130 0 0 1 340 175" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M295 295 A130 130 0 0 1 225 340" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M90 295 A130 130 0 0 1 60 225" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />
            <path d="M105 105 A130 130 0 0 1 175 60" fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#fwArrow)" />

            {/* Quadrant labels */}
            <text x="280" y="120" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Revenue</text>
            <text x="310" y="270" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Buybacks</text>
            <text x="120" y="310" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Burns</text>
            <text x="90" y="150" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22" letterSpacing="-0.04em" fill="hsl(var(--foreground))">Value</text>

            {/* Inner circle */}
            <circle cx="200" cy="200" r="80" fill="hsl(var(--primary))" />
            <text x="200" y="192" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="28" letterSpacing="-0.04em" fill="white">Growth</text>
            <text x="200" y="216" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="400" fontSize="11" fill="white" opacity="0.8">
              <tspan x="200" dy="0">Every loop sends value</tspan>
              <tspan x="200" dy="14">back to the ecosystem.</tspan>
            </text>
          </svg>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.08 * i }}
              className="relative rounded-2xl border border-border bg-card p-6 transition-all group hover:border-primary/30 hover:shadow-lift"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="text-primary" size={20} />
                </div>
                <h3 className="font-display text-lg font-medium text-foreground">{p.label}</h3>
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
