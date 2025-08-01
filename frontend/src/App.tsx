import { Dashboard } from "@/components/Dashboard";
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="traefik-dashboard-theme">
      <div className="min-h-screen bg-background transition-colors">
        <Dashboard />
      </div>
    </ThemeProvider>
  );
}

export default App;