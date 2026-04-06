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
        <img
          src="/images/grad-nebula.png"
          alt=""
          className="absolute w-[140%] h-[140%] -top-[20%] -left-[20%] object-cover opacity-50 animate-[grad-drift-1_25s_ease-in-out_infinite,grad-fade-1_20s_ease-in-out_infinite]"
        />
        <img
          src="/images/grad-teal.png"
          alt=""
          className="absolute w-[140%] h-[140%] -top-[20%] -left-[20%] object-cover opacity-40 animate-[grad-drift-2_30s_ease-in-out_infinite,grad-fade-2_18s_ease-in-out_infinite]"
        />
        <img
          src="/images/grad-amber.png"
          alt=""
          className="absolute w-[140%] h-[140%] -top-[20%] -left-[20%] object-cover opacity-30 animate-[grad-drift-3_35s_ease-in-out_infinite,grad-fade-3_22s_ease-in-out_infinite]"
        />
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
