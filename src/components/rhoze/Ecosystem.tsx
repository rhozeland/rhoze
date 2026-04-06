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

const cycleLabels = [
  { label: "Revenue", className: "top-[13%] left-1/2 -translate-x-1/2 -rotate-6" },
  { label: "Buybacks", className: "top-1/2 right-[8%] -translate-y-1/2 rotate-90" },
  { label: "Burns", className: "bottom-[13%] left-1/2 -translate-x-1/2" },
  { label: "Value", className: "top-1/2 left-[8%] -translate-y-1/2 -rotate-90" },
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

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.08 }}
          className="relative mx-auto mb-16 aspect-square w-full max-w-[34rem]"
        >
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker id="ecosystemArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0 0L6 3L0 6Z" fill="hsl(var(--primary))" />
              </marker>
            </defs>
            <path d="M21 40 A36 36 0 0 1 39 21" fill="none" stroke="hsl(var(--primary) / 0.78)" strokeWidth="1.6" strokeLinecap="round" markerEnd="url(#ecosystemArrow)" />
            <path d="M61 21 A36 36 0 0 1 79 40" fill="none" stroke="hsl(var(--primary) / 0.78)" strokeWidth="1.6" strokeLinecap="round" markerEnd="url(#ecosystemArrow)" />
            <path d="M79 60 A36 36 0 0 1 61 79" fill="none" stroke="hsl(var(--primary) / 0.78)" strokeWidth="1.6" strokeLinecap="round" markerEnd="url(#ecosystemArrow)" />
            <path d="M39 79 A36 36 0 0 1 21 60" fill="none" stroke="hsl(var(--primary) / 0.78)" strokeWidth="1.6" strokeLinecap="round" markerEnd="url(#ecosystemArrow)" />
          </svg>

          <div
            className="absolute inset-[10%] rounded-full border border-border shadow-soft"
            style={{
              background:
                "conic-gradient(from -90deg, hsl(var(--primary)) 0deg 84deg, hsl(var(--primary) / 0.12) 84deg 92deg, hsl(var(--primary) / 0.24) 92deg 174deg, hsl(var(--primary) / 0.12) 174deg 182deg, hsl(var(--primary) / 0.18) 182deg 264deg, hsl(var(--primary) / 0.12) 264deg 272deg, hsl(var(--primary) / 0.3) 272deg 354deg, hsl(var(--primary) / 0.12) 354deg 360deg)",
            }}
          />
          <div className="absolute inset-[24%] rounded-full border border-border bg-rhoze-surface" />

          {cycleLabels.map((item) => (
            <span
              key={item.label}
              className={`absolute z-10 whitespace-nowrap font-display text-sm font-semibold tracking-tight text-foreground sm:text-lg ${item.className}`}
            >
              {item.label}
            </span>
          ))}

          <div className="absolute inset-[35%] z-10 flex flex-col items-center justify-center rounded-full bg-primary px-4 text-center text-primary-foreground shadow-lift">
            <span className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Growth</span>
            <p className="mt-2 max-w-[11rem] text-[0.7rem] leading-relaxed text-primary-foreground/80 sm:text-sm">
              Every loop sends value back to the ecosystem.
            </p>
          </div>
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
