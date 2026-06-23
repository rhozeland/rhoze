import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Camera, AudioLines, Activity, Calendar, ArrowUpRight } from "lucide-react";

/**
 * Four-tile category grid (Visual / Audio / Development / Events).
 * Pastel gradient tiles on a dark inset, echoing the original homepage
 * mockup the user wants preserved.
 */

const tiles = [
  {
    label: "Visual",
    icon: Camera,
    href: "/projects.html",
    bg: "linear-gradient(160deg, hsl(28 95% 88%), hsl(20 90% 78%))",
    note: "Music videos, photography, art direction.",
  },
  {
    label: "Audio",
    icon: AudioLines,
    href: "/projects.html",
    bg: "linear-gradient(160deg, hsl(230 95% 92%), hsl(245 80% 86%))",
    note: "Records, mixes, releases, sessions.",
  },
  {
    label: "Development",
    icon: Activity,
    href: "#tokenomics",
    bg: "linear-gradient(160deg, hsl(50 100% 86%), hsl(40 95% 78%))",
    note: "Rhoze App, $RHOZE, creator infrastructure.",
  },
  {
    label: "Events",
    icon: Calendar,
    href: "/events.html",
    bg: "linear-gradient(160deg, hsl(340 90% 92%), hsl(320 85% 86%))",
    note: "Showcases, livestreams, IRL drops.",
  },
];

export default function Categories() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative px-6 py-20">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-end justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              What we do
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold font-display tracking-tight text-foreground">
              Four lanes. One studio.
            </h2>
          </div>
          <a
            href="/projects.html"
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-70"
          >
            See the full catalogue <ArrowUpRight size={14} />
          </a>
        </motion.div>

        <div className="rounded-3xl bg-foreground p-3 sm:p-4 shadow-lift">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t, i) => (
              <motion.a
                key={t.label}
                href={t.href}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.05 + i * 0.07 }}
                className="group relative aspect-square rounded-2xl overflow-hidden p-5 flex flex-col justify-between"
                style={{ background: t.bg }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/55 backdrop-blur-sm text-foreground/80">
                  <t.icon size={18} />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase text-foreground/90">
                    {t.label}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-foreground/65 max-w-[18ch]">
                    {t.note}
                  </p>
                </div>
                <ArrowUpRight
                  size={16}
                  className="absolute top-4 right-4 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}