import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { ApiError } from "./api/client";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      // A missing or forbidden resource will not appear on a second try.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* "light" and "dark" here mean the canvas; the shell is dark in both. */}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="glancelab-theme">
        <TooltipProvider delayDuration={300}>
          <BrowserRouter basename="/admin">
            <App />
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
