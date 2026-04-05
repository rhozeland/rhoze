import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Rocket, Copy, Check } from "lucide-react";

const CONTRACT_ADDRESS = "C4RrVR1GCNeEyHWa6mASBgyckY7671Rq3X4YfEgM4RMf";

const Support = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="support" className="py-32 px-6 bg-gradient-pastel" ref={ref}>
      <div className="container mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-card shadow-soft flex items-center justify-center mx-auto mb-8">
            <Rocket className="text-primary" size={28} />
          </div>

          <h2 className="text-4xl sm:text-5xl font-medium font-display mb-4 text-foreground">
            Join the movement
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg font-body mb-10">
            Support the vision. Buy $RHOZE on Solana and become part of a creator-owned future.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-body">Contract Address</p>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-all group shadow-soft"
          >
            <code className="text-sm font-mono text-foreground break-all">{CONTRACT_ADDRESS}</code>
            {copied ? (
              <Check size={16} className="text-primary flex-shrink-0" />
            ) : (
              <Copy size={16} className="text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3.5 rounded-full bg-gradient-mint font-semibold text-primary-foreground shadow-soft hover:shadow-lift transition-shadow text-base"
          >
            Buy on DexScreener
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Support;
