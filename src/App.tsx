import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { useEffect } from "react";

function useTimeBasedTheme() {
  useEffect(() => {
    function applyTheme() {
      // If user has manually overridden, respect that
      const override = localStorage.getItem("theme-override");
      if (override === "light" || override === "dark") {
        document.documentElement.classList.toggle("dark", override === "dark");
        return;
      }
      const hour = new Date().getHours();
      const isDark = hour < 6 || hour >= 19;
      document.documentElement.classList.toggle("dark", isDark);
    }
    applyTheme();
    const interval = setInterval(applyTheme, 60000);

    // Listen for manual toggle events
    const handler = () => applyTheme();
    window.addEventListener("theme-changed", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("theme-changed", handler);
    };
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