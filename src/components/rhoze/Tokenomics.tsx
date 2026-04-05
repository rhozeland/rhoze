import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Wallet, Megaphone, Gift, Lock, Copy, Check } from "lucide-react";

const wallets = [
  {
    icon: Wallet,
    label: "Main Wallet",
    pct: "0.43%",
    address: "6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr",
    color: "bg-primary/10",
    lockInfo: "24% locked, 12 months left",
    description:
      "We are seriously committed to the project with many areas to showcase from the talent within our network.",
  },
  {
    icon: Megaphone,
    label: "Marketing Wallet",
    pct: "0.83%",
    address: "6PSaZYykqtx5QHMh6jBqotrNnr6RWdgsds3WxSK58W8C",
    color: "bg-rhoze-pink",
    lockInfo: "6.5% locked, 3 months left",
    description:
      "Our focus is on raising awareness through livestreaming and developing Rhozeland as a credible and recognizable brand. We're pursuing collaborations that uplift and inspire people to achieve their dreams. Any funds used will be announced — building trust through transparency and resourcefulness.",
  },
  {
    icon: Gift,
    label: "Airdrop Wallet",
    pct: "1.85%",
    address: "USnKWE4KoyAjXhuueHuFfAhgLZ4PkV67t6nBBwJPFMs",
    color: "bg-rhoze-lavender",
    lockInfo: null,
    description:
      "We're providing supply to real-world participants of our network and studio by inviting them to hold the token. Our thesis is that the real diamond holders and advocates will raise awareness of $RHOZE through engagement at our studio. The word of $RHOZE will spread.",
  },
];

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Copy address"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const Tokenomics = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="tokenomics" className="py-32 px-6 bg-rhoze-surface" ref={ref}>
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-medium font-display mb-4 text-foreground">
            Tokenomics
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-body">
            Full transparency on supply allocation. Every wallet is public, every move is announced.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6">
          {wallets.map((w, i) => (
            <motion.div
              key={w.label}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.12 * i }}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all hover:shadow-lift"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                <div className={`w-12 h-12 rounded-xl ${w.color} flex items-center justify-center shrink-0`}>
                  <w.icon className="text-foreground/70" size={22} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <h3 className="text-xl font-medium font-display text-foreground">
                      {w.label}
                    </h3>
                    <span className="text-2xl font-medium font-display text-primary">
                      {w.pct}
                    </span>
                  </div>

                  {w.lockInfo && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <Lock size={14} className="text-primary" />
                      <span className="text-sm font-medium text-primary font-body">
                        {w.lockInfo}
                      </span>
                    </div>
                  )}

                  <p className="text-muted-foreground font-body leading-relaxed mb-4">
                    {w.description}
                  </p>

                  <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted/50 w-fit max-w-full">
                    <code className="text-xs text-muted-foreground font-mono truncate">
                      {w.address}
                    </code>
                    <CopyButton text={w.address} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Tokenomics;
