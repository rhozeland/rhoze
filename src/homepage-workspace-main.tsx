import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import StartPage from "@/start/StartPage";
import "@/index.css";

const rootElement = document.getElementById("homepage-workspace-root");

if (rootElement) {
  const queryClient = new QueryClient();
  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StartPage embedded />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}