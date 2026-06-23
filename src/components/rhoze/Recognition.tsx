import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * Recognition & Partners pill row. Preserves the original partner-badge
 * strip from the previous homepage so the credibility signals stay visible.
 */

const partners = [
  { label: "CAPACOA Program Cohort", mark: "C" },
  { label: "Pump.fun Hackathon Participant", mark: "◍" },
  { label: "Colosseum Participant", mark: "▦" },
  { label: "VoyageHouston Feature", mark: "V" },
  { label: "Solana Coliseum Frontier", mark: "◇" },
  { label: "Founder Institute", mark: "F" },
];

export default function Recognition() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="px-6 pb-16">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4"
        >
          Recognition & Partners
        </motion.div>
        <div className="flex flex-wrap gap-3">
          {partners.map((p, i) => (
            <motion.span
              key={p.label}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.04 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/85 shadow-soft"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground/80">
                {p.mark}
              </span>
              {p.label}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}