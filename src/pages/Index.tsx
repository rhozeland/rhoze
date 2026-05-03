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
      {/* Animated color-shifting gradient background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundSize: '400% 400%',
          animation: 'gradient-shift 30s ease infinite',
          backgroundImage: 'linear-gradient(135deg, hsl(270 60% 15%) 0%, hsl(250 70% 20%) 15%, hsl(200 50% 12%) 30%, hsl(30 60% 18%) 45%, hsl(330 50% 16%) 60%, hsl(180 50% 14%) 75%, hsl(260 60% 18%) 100%)',
        }}
      />
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
