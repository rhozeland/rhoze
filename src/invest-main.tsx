import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import InvestPage from "@/invest/InvestPage";
import "@/index.css";

const qc = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <HashRouter>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<InvestPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </TooltipProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);