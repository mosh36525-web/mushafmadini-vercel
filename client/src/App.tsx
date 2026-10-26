import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import RecitationModelNotice from "./components/RecitationModelNotice";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ResetPasswordPage from "./pages/ResetPassword";
import { preloadRecitationModel } from "./lib/recitationModel";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/mushaf" component={Home} />
      <Route path="/review" component={Home} />
      <Route path="/prayer" component={Home} />
      <Route path="/duas" component={Home} />
      <Route path="/tasbih" component={Home} />
      <Route path="/account" component={Home} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  useEffect(() => {
    preloadRecitationModel();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <RecitationModelNotice />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
