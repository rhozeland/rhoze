import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { useEffect } from "react";

function useTimeBasedTheme() {
  useEffect(() => {
    function applyTheme() {
      const hour = new Date().getHours();
      const isDark = hour < 6 || hour >= 19;
      document.documentElement.classList.toggle("dark", isDark);
    }
    applyTheme();
    const interval = setInterval(applyTheme, 60000);
    return () => clearInterval(interval);
  }, []);
}

const queryClient = new QueryClient();

const App = () => {
  useTimeBasedTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Index />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;