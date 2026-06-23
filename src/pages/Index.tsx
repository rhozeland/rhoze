import Navbar from "@/components/rhoze/Navbar";
import EcosystemTicker from "@/components/rhoze/EcosystemTicker";
import Hero from "@/components/rhoze/Hero";
import About from "@/components/rhoze/About";
import BrandPillars from "@/components/rhoze/BrandPillars";
import SelectedWork from "@/components/rhoze/SelectedWork";
import Categories from "@/components/rhoze/Categories";
import Recognition from "@/components/rhoze/Recognition";
import SupportOrbit from "@/components/rhoze/SupportOrbit";
import Tokenomics from "@/components/rhoze/Tokenomics";
import Chart from "@/components/rhoze/Chart";
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
      <EcosystemTicker />
      <Hero />
      <BrandPillars />
      <Categories />
      <About />
      <SelectedWork />
      <Recognition />
      <Chart />
      <Tokenomics />
      <SupportOrbit />
      <Footer />
    </div>
  );
};

export default Index;
