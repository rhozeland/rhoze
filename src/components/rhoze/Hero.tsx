import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import LogoShards from "./LogoShards";

const Hero = () => {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Pastel gradient background */}
      <div className="absolute inset-0 bg-gradient-pastel opacity-60" />

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-[1]">
        <Canvas
          camera={{ position: [0, 0, 7], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <pointLight position={[-3, 2, 4]} intensity={0.4} color="#66ccb3" />
          <Suspense fallback={null}>
            <LogoShards onAssembled={() => setRevealed(true)} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            maxPolarAngle={Math.PI / 1.8}
            minPolarAngle={Math.PI / 2.2}
          />
        </Canvas>
      </div>

      {/* Hero copy overlay */}
      <div className="relative z-10 container mx-auto px-6 pointer-events-none">
        <div className="max-w-xl py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-8 font-body">
              <span className="text-primary">✦</span> Crafting Visions, Building Futures
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display leading-[0.95] tracking-tight mb-8 text-foreground"
          >
            Your
            <br />
            Creative
            <br />
            Engine
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-base sm:text-lg text-muted-foreground max-w-md mb-10 font-body leading-relaxed"
          >
            Rhozeland is a creator-owned economy built on Solana — real clothing drops, a services marketplace, an artist app & a revenue flywheel funding buybacks, burns, grants & causes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-start gap-4 pointer-events-auto"
          >
            <a
              href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full bg-gradient-mint font-semibold text-primary-foreground shadow-soft hover:shadow-lift transition-shadow text-base"
            >
              Buy $RHOZE
            </a>
            <a
              href="#about"
              className="px-8 py-3.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors text-base font-body"
            >
              Learn More
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={revealed ? { opacity: 1 } : {}}
        transition={{ delay: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ArrowDown className="text-muted-foreground" size={20} />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
