import Navbar from "@/components/rhoze/Navbar";
import Hero from "@/components/rhoze/Hero";
import About from "@/components/rhoze/About";
import Ecosystem from "@/components/rhoze/Ecosystem";
import Chart from "@/components/rhoze/Chart";
import Support from "@/components/rhoze/Support";
import Footer from "@/components/rhoze/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <About />
      <Ecosystem />
      <Chart />
      <Support />
      <Footer />
    </div>
  );
};

export default Index;
