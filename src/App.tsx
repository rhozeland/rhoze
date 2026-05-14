import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { useEffect } from "react";

function useSystemTheme() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function applyTheme() {
      // If user has manually overridden, respect that
      const override = localStorage.getItem("theme-override");
      if (override === "light" || override === "dark") {
        document.documentElement.classList.toggle("dark", override === "dark");
        return;
      }
      // No manual override → follow OS preference
      document.documentElement.classList.toggle("dark", mq.matches);
    }
    applyTheme();

    // Listen for manual toggle events
    const handler = () => applyTheme();
    window.addEventListener("theme-changed", handler);
    mq.addEventListener("change", handler);
    return () => {
      window.removeEventListener("theme-changed", handler);
      mq.removeEventListener("change", handler);
    };
  }, []);
}

const queryClient = new QueryClient();

const App = () => {
  useSystemTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Index />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;