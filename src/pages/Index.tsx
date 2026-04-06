import Navbar from "@/components/rhoze/Navbar";
import Hero from "@/components/rhoze/Hero";
import About from "@/components/rhoze/About";
import Ecosystem from "@/components/rhoze/Ecosystem";
import SelectedWork from "@/components/rhoze/SelectedWork";
import Tokenomics from "@/components/rhoze/Tokenomics";
import Chart from "@/components/rhoze/Chart";
import Support from "@/components/rhoze/Support";
import Footer from "@/components/rhoze/Footer";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Animated gradient background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute rounded-full blur-[80px] will-change-transform"
          style={{ width: '60vmax', height: '60vmax', top: '-20%', left: '-10%',
            background: 'radial-gradient(circle, hsl(270 80% 55%) 0%, hsl(250 90% 40%) 50%, transparent 70%)',
            animation: 'orb-move-1 20s ease-in-out infinite, orb-pulse-1 8s ease-in-out infinite' }} />
        <div className="absolute rounded-full blur-[80px] will-change-transform"
          style={{ width: '50vmax', height: '50vmax', top: '20%', right: '-15%', opacity: 0.7,
            background: 'radial-gradient(circle, hsl(30 90% 50%) 0%, hsl(15 80% 35%) 45%, transparent 70%)',
            animation: 'orb-move-2 25s ease-in-out infinite, orb-pulse-2 10s ease-in-out infinite' }} />
        <div className="absolute rounded-full blur-[80px] will-change-transform"
          style={{ width: '55vmax', height: '55vmax', bottom: '-25%', left: '20%', opacity: 0.6,
            background: 'radial-gradient(circle, hsl(175 80% 45%) 0%, hsl(190 70% 30%) 45%, transparent 70%)',
            animation: 'orb-move-3 22s ease-in-out infinite, orb-pulse-3 12s ease-in-out infinite' }} />
        <div className="absolute rounded-full blur-[80px] will-change-transform"
          style={{ width: '40vmax', height: '40vmax', top: '-10%', right: '10%', opacity: 0.5,
            background: 'radial-gradient(circle, hsl(310 70% 50%) 0%, hsl(280 60% 35%) 45%, transparent 70%)',
            animation: 'orb-move-4 28s ease-in-out infinite, orb-pulse-4 9s ease-in-out infinite' }} />
      </div>
      <Navbar />
      <Hero />
      <About />
      <Ecosystem />
      <SelectedWork />
      <Tokenomics />
      <Chart />
      <Support />
      <Footer />
    </div>
  );
};

export default Index;
