import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const Chart = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="chart" className="py-32 px-6" ref={ref}>
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-semibold font-display mb-4 text-foreground">
            Live Chart
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto font-body">
            Track $RHOZE in real-time on DexScreener.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl overflow-hidden border border-border shadow-lift"
        >
          <iframe
            src="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf?embed=1&theme=light&info=0"
            className="w-full"
            style={{ height: "500px", border: "none" }}
            title="DexScreener $RHOZE Chart"
            loading="lazy"
          />
        </motion.div>

        <div className="mt-6 text-center">
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-body underline underline-offset-4"
          >
            View full chart on DexScreener →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Chart;
