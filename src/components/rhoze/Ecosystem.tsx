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
    <section id="ecosystem" className="py-32 px-6 bg-card" ref={ref}>
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-extrabold font-display mb-4">
            The <span className="text-gradient-fire">Flywheel</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg font-body">
            Every piece of the ecosystem feeds the next. Revenue in, value out, community first.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.08 * i }}
              className="relative p-6 rounded-2xl border border-border bg-background hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <p.icon className="text-primary" size={20} />
                </div>
                <h3 className="font-display font-bold text-lg">{p.label}</h3>
              </div>
              <p className="text-muted-foreground text-sm font-body leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Flywheel visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex items-center gap-3 flex-wrap justify-center">
            {["Revenue", "→", "Buybacks", "→", "Burns", "→", "Value", "→", "Growth", "→", "Revenue"].map((item, i) => (
              <span
                key={i}
                className={
                  item === "→"
                    ? "text-primary text-xl"
                    : "px-4 py-2 rounded-full border border-border text-sm font-body text-foreground bg-muted"
                }
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Ecosystem;
