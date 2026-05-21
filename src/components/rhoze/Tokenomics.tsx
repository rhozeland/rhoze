import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Wallet, Megaphone, Gift, Lock, Copy, Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const wallets = [
  {
    id: "main",
    icon: Wallet,
    label: "Main Wallet",
    supplyPct: 24,
    unlockedPct: 0.43,
    address: "6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr",
    barColor: "hsl(var(--foreground))",
    lockedPct: 24,
    lockMonths: 12,
    description:
      "We are seriously committed to the project with many areas to showcase from the talent within our network.",
  },
  {
    id: "marketing",
    icon: Megaphone,
    label: "Marketing Wallet",
    supplyPct: 6.5,
    unlockedPct: 0.83,
    address: "6PSaZYykqtx5QHMh6jBqotrNnr6RWdgsds3WxSK58W8C",
    barColor: "hsl(var(--foreground) / 0.7)",
    lockedPct: 6.5,
    lockMonths: 3,
    description:
      "Our focus is on raising awareness through livestreaming and developing Rhozeland as a credible and recognizable brand. We're pursuing collaborations that uplift and inspire people to achieve their dreams. Any funds used will be announced — building trust through transparency and resourcefulness.",
  },
  {
    id: "airdrop",
    icon: Gift,
    label: "Airdrop Wallet",
    supplyPct: 9.54,
    unlockedPct: 9.54,
    address: "USnKWE4KoyAjXhuueHuFfAhgLZ4PkV67t6nBBwJPFMs",
    barColor: "hsl(var(--foreground) / 0.45)",
    lockedPct: null,
    lockMonths: null,
    description:
      "We're providing supply to real-world participants of our network and studio by inviting them to hold the token. Our thesis is that the real diamond holders and advocates will raise awareness of $RHOZE through engagement at our studio. The word of $RHOZE will spread.",
  },
];

const TOTAL_SUPPLY = "1,000,000,000";
const COMMUNITY_PCT = +(100 - wallets.reduce((s, w) => s + w.supplyPct, 0)).toFixed(2);
const COMMUNITY_BAR = "hsl(var(--foreground) / 0.12)";

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
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-semibold font-display mb-4 text-foreground">
            Token Allocations
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-body">
            Total supply: <span className="text-foreground font-medium tabular-nums">{TOTAL_SUPPLY}</span> $RHOZE. The team holds a small slice — most of the supply lives in the open market. Every wallet is public, every move is announced.
          </p>
        </motion.div>

        {/* Supply breakdown bar — monochrome, minimal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-14 max-w-3xl mx-auto"
        >
          <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-widest text-muted-foreground font-body">
            <span>Total supply split</span>
            <span className="tabular-nums">{TOTAL_SUPPLY}</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-card">
            {wallets.map((w) => (
              <div
                key={w.label}
                style={{ width: `${w.supplyPct}%`, backgroundColor: w.barColor }}
                title={`${w.label} · ${w.supplyPct}%`}
                aria-label={`${w.label} ${w.supplyPct}%`}
              />
            ))}
            <div
              style={{ width: `${COMMUNITY_PCT}%`, backgroundColor: COMMUNITY_BAR }}
              title={`Open market & community · ${COMMUNITY_PCT}%`}
              aria-label={`Open market and community ${COMMUNITY_PCT}%`}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs font-body text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--foreground))" }} />
              <span>Team wallets</span>
              <span className="tabular-nums">{(wallets[0].supplyPct + wallets[1].supplyPct).toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--foreground) / 0.45)" }} />
              <span>Airdrop</span>
              <span className="tabular-nums">{wallets[2].supplyPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNITY_BAR }} />
              <span>Open market</span>
              <span className="tabular-nums">{COMMUNITY_PCT}%</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-auto bg-card border border-border p-1">
              {wallets.map((w) => (
                <TabsTrigger
                  key={w.id}
                  value={w.id}
                  className="flex items-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <w.icon size={16} />
                  <span className="hidden sm:inline">{w.label.replace(" Wallet", "")}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {wallets.map((w) => (
              <TabsContent key={w.id} value={w.id} className="mt-6">
                <div className="p-8 rounded-2xl bg-card border border-border">
                  <h3 className="text-xl font-medium font-display text-foreground mb-3">
                    {w.label}
                  </h3>
                  <div className="text-5xl font-semibold font-display text-foreground tabular-nums leading-none mb-2">
                    {w.lockedPct !== null ? `${w.lockedPct}%` : `${w.supplyPct}%`}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground font-body mb-5 uppercase tracking-wider">
                    {w.lockedPct !== null ? (
                      <>
                        <Lock size={12} />
                        <span>locked · {w.lockMonths} months left · {w.unlockedPct}% of supply unlocked</span>
                      </>
                    ) : (
                      <span>fully unlocked · distributed to real-world holders</span>
                    )}
                  </div>

                  <p className="text-muted-foreground font-body leading-relaxed mb-5">
                    {w.description}
                  </p>

                  <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted/50 w-fit max-w-full">
                    <code className="text-xs text-muted-foreground font-mono truncate">
                      {w.address}
                    </code>
                    <CopyButton text={w.address} />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </div>
    </section>
  );
};

export default Tokenomics;
