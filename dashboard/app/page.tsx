import Link from 'next/link';
import { Activity, BarChart3, Terminal, Server, Gauge, Shield, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Traefik Log Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/hhftechnology/traefik-log-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                title="GitHub Repository"
              >
                <Github className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">GitHub</span>
              </a>

              <a
                href="https://discord.gg/xCtMFeUKf9"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                title="Join Discord"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Discord</span>
              </a>
              
              <Button asChild variant="outline" className="border-border text-foreground hover:bg-accent">
                <Link href="/dashboard/demo">Demo</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/dashboard">Launch Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-extrabold text-foreground mb-6">
            Real-time Traefik Log Analytics
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Monitor and analyze your Traefik access logs with a powerful, modern dashboard featuring
            real-time metrics, interactive charts, and comprehensive insights.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8">
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border text-foreground hover:bg-accent text-lg px-8">
              <Link href="/dashboard/demo">Try Demo</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="border border-border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-xl bg-card">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
              <Server className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Analytics Agent</h3>
            <p className="text-muted-foreground mb-6">
              High-performance backend agent written in Go for parsing and analyzing Traefik logs with minimal resource usage.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Parses 100k+ lines/second
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                GeoIP lookups included
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                System resource monitoring
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Bearer token authentication
              </li>
            </ul>
          </div>

          <div className="border border-border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-xl bg-card">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Web Dashboard</h3>
            <p className="text-muted-foreground mb-6">
              Modern web-based dashboard with interactive charts and real-time updates built with Next.js 15 and React 19.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Real-time metrics updates
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Interactive charts & graphs
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Geographic distribution maps
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Demo mode available
              </li>
            </ul>
          </div>

          <div className="border border-border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-xl bg-card">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">CLI Dashboard</h3>
            <p className="text-muted-foreground mb-6">
              Terminal-based dashboard with Bubble Tea UI for monitoring logs directly from your command line.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Beautiful terminal UI
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Direct log file reading
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Agent connection support
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                Lightweight & fast
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-accent/50 py-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 rounded-3xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Comprehensive Metrics
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Gauge className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Performance</h3>
              <p className="text-muted-foreground">
                Track request rates, response times, and P95/P99 percentiles
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Status Codes</h3>
              <p className="text-muted-foreground">
                Monitor 2xx/3xx/4xx/5xx status codes and error rates
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Services</h3>
              <p className="text-muted-foreground">
                Analyze top routes, backends, routers, and geographic data
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>Traefik Log Dashboard - Open Source Monitoring Solution</p>
        </div>
      </footer>
    </div>
  );
}