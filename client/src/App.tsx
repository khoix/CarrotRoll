import { useEffect, useState } from "react";
import { Router, Switch, Route } from "wouter";
import { queryClient, registerMaintenanceSetter } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SoundProvider } from "@/contexts/SoundContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Play from "@/pages/Play";
import Level20Demo from "@/pages/Level20Demo";
import AdminRoll from "@/pages/AdminRoll";
import MaintenancePage from "@/pages/MaintenancePage";

const BASE_PATH = import.meta.env.BASE_URL || "/";
const basePath = BASE_PATH === "/" ? "/" : BASE_PATH.replace(/\/$/, "");

function AppRouter() {
  return (
    <Router base={basePath}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/play" component={Play} />
        <Route path="/demo-level20" component={Level20Demo} />
        <Route path="/adminroll/scores" component={AdminRoll} />
        <Route path="/adminroll/demo" component={AdminRoll} />
        <Route path="/adminroll/ending-demo" component={AdminRoll} />
        <Route path="/adminroll/ending-demo-mobile" component={AdminRoll} />
        <Route path="/adminroll" component={AdminRoll} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    registerMaintenanceSetter(setMaintenance);
    return () => registerMaintenanceSetter(null);
  }, []);

  if (maintenance) {
    return <MaintenancePage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SoundProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </SoundProvider>
    </QueryClientProvider>
  );
}

export default App;
