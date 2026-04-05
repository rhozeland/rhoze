import Navbar from "@/components/rhoze/Navbar";
import Hero from "@/components/rhoze/Hero";
import About from "@/components/rhoze/About";
import Ecosystem from "@/components/rhoze/Ecosystem";
import Tokenomics from "@/components/rhoze/Tokenomics";
import Chart from "@/components/rhoze/Chart";
import Support from "@/components/rhoze/Support";
import Footer from "@/components/rhoze/Footer";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Persistent animated gradient blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute animate-[blob-drift-1_18s_ease-in-out_infinite,blob-morph_12s_ease-in-out_infinite]"
          style={{
            width: 'clamp(400px, 55vw, 800px)',
            height: 'clamp(400px, 55vw, 800px)',
            top: '-10%',
            right: '-15%',
            opacity: 0.75,
            borderRadius: '40% 60% 55% 45% / 55% 40% 60% 45%',
            background: 'conic-gradient(from 180deg, hsl(280 100% 65%), hsl(200 100% 55%), hsl(150 100% 50%), hsl(330 100% 60%), hsl(264 100% 60%))',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute animate-[blob-drift-2_22s_ease-in-out_infinite,blob-morph_15s_ease-in-out_infinite_reverse]"
          style={{
            width: 'clamp(300px, 40vw, 600px)',
            height: 'clamp(300px, 40vw, 600px)',
            bottom: '10%',
            left: '-10%',
            opacity: 0.6,
            borderRadius: '40% 60% 55% 45% / 55% 40% 60% 45%',
            background: 'conic-gradient(from 90deg, hsl(30 100% 60%), hsl(350 100% 58%), hsl(280 100% 55%), hsl(332 100% 58%))',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute animate-[blob-drift-3_25s_ease-in-out_infinite,blob-morph_18s_ease-in-out_infinite]"
          style={{
            width: 'clamp(250px, 30vw, 500px)',
            height: 'clamp(250px, 30vw, 500px)',
            top: '40%',
            left: '30%',
            opacity: 0.5,
            borderRadius: '40% 60% 55% 45% / 55% 40% 60% 45%',
            background: 'conic-gradient(from 270deg, hsl(170 100% 50%), hsl(200 100% 60%), hsl(240 100% 55%), hsl(205 100% 55%))',
            filter: 'blur(60px)',
          }}
        />
      </div>
      <Navbar />
      <Hero />
      <About />
      <Ecosystem />
      <Tokenomics />
      <Chart />
      <Support />
      <Footer />
    </div>
  );
};

export default Index;
