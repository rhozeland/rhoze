import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * "Support Rhozeland" orbit — three circular cards radiating from a central
 * SUPPORT node, mirroring the original mockup the user wants preserved.
 */

const nodes = [
  {
    n: "01",
    title: "Stay in the loop",
    desc: "Get releases, events, and updates first.",
    href: "/events.html",
  },
  {
    n: "02",
    title: "Build with us",
    desc: "Bring a project and we'll shape the launch.",
    href: "mailto:collab@rhozeland.com",
  },
  {
    n: "03",
    title: "Back the ecosystem",
    desc: "$RHOZE helps power the ecosystem.",
    href: "#tokenomics",
  },
];

export default function SupportOrbit() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative px-6 py-24 bg-gradient-pastel">
      <div className="container mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Ecosystem
          </div>
          <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-foreground">
            Support Rhozeland
          </h2>
          <a
            href="mailto:collab@rhozeland.com"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-foreground/60 bg-background/60 px-5 py-2 text-sm font-semibold text-foreground hover:bg-background"
          >
            Get involved <span aria-hidden>×</span>
          </a>
        </motion.div>

        <div className="relative mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Dashed connectors (desktop) */}
          <svg
            className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
          >
            <line x1="25%" y1="50%" x2="50%" y2="50%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" className="text-foreground/20" />
            <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" className="text-foreground/20" />
          </svg>

          {nodes.map((node, i) => (
            <motion.a
              key={node.n}
              href={node.href}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
              className="relative mx-auto flex aspect-square w-[240px] sm:w-[260px] flex-col items-center justify-center rounded-full bg-card p-8 text-center shadow-lift hover:shadow-soft transition-shadow"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border text-[11px] font-bold text-muted-foreground">
                {node.n}
              </span>
              <div className="text-lg font-bold text-foreground leading-tight">
                {node.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-snug max-w-[20ch]">
                {node.desc}
              </p>
            </motion.a>
          ))}

          {/* Central SUPPORT node */}
          <div className="md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 mx-auto mt-4 md:mt-0 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 shadow-soft">
            Support
          </div>
        </div>
      </div>
    </section>
  );
}