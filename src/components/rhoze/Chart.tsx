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
            Track $RHOZE in real-time on Birdeye.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl overflow-hidden border border-border shadow-lift"
        >
          <iframe
            src="https://birdeye.so/tv-widget/7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&theme=light"
            className="w-full"
            style={{ height: "500px", border: "none" }}
            title="Birdeye $RHOZE Chart"
            loading="lazy"
            allowFullScreen
          />
        </motion.div>

        <div className="mt-6 text-center">
          <a
            href="https://birdeye.so/token/7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump?chain=solana"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-body underline underline-offset-4"
          >
            View full chart on Birdeye →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Chart;
