import Link from 'next/link';
import { BookOpen, Zap, Shield, Globe, Activity, Terminal, Github } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-4xl">
          {/* GitHub Link */}
          <div className="flex items-center justify-center mb-8">
            <a
              href="https://github.com/hhftechnology/traefik-log-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-8 h-8" />
            </a>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
            Traefik Log Dashboard
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            Comprehensive real-time analytics platform for Traefik reverse proxy logs
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-10">
            Multi-agent architecture • Interactive visualizations • Advanced filtering • Background alerting
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs"
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Read Documentation
            </Link>
            <Link
              href="/docs/quickstart"
              className="px-8 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Quick Start Guide
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 max-w-7xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose Traefik Log Dashboard?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Multi-Agent Architecture</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Manage multiple Traefik instances from a single dashboard. Deploy agents across datacenters, cloud, and edge locations.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Interactive Visualizations</h3>
            <p className="text-gray-600 dark:text-gray-400">
              3D globe with geographic mapping, real-time charts, heat maps, and timeline visualizations for comprehensive insights.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Enterprise Security</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive middleware protection, rate limiting, malicious pattern detection, and CVE-2025-55182 patches.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">High Performance</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Go-based agent with position tracking, parallel fetching, optimized state management, and intelligent caching.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Advanced Filtering</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Include/exclude modes, geographic filtering, custom conditions with AND/OR logic, and saved filter presets.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center mb-4">
              <Terminal className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Background Alerting</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Server-side alert processing with Discord webhooks, daily summaries, and notifications even when dashboard is closed.
            </p>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="px-4 py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">3</div>
              <div className="text-gray-600 dark:text-gray-400">Components</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">Agent, Dashboard, CLI</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">100k+</div>
              <div className="text-gray-600 dark:text-gray-400">Logs/Second</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">Processing Speed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">∞</div>
              <div className="text-gray-600 dark:text-gray-400">Agents</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">Unlimited Scale</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">50MB</div>
              <div className="text-gray-600 dark:text-gray-400">Memory</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">Agent Footprint</div>
            </div>
          </div>
        </div>
      </section>

      {/* Components Section */}
      <section className="px-4 py-16 max-w-7xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-12">Three Deployment Options</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
            <h3 className="text-2xl font-semibold mb-4">Agent</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              High-performance Go backend for parsing Traefik logs and exposing metrics via REST API.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>✓ JSON & CLF log formats</li>
              <li>✓ GeoIP integration</li>
              <li>✓ System monitoring</li>
              <li>✓ Bearer token auth</li>
            </ul>
            <Link
              href="/docs/components/agent"
              className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center"
            >
              Learn more →
            </Link>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-red-50 dark:bg-red-950">
            <h3 className="text-2xl font-semibold mb-4">Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Modern Next.js web UI with interactive charts, real-time updates, and beautiful visualizations.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>✓ Multi-agent management</li>
              <li>✓ 3D globe & maps</li>
              <li>✓ Advanced filtering</li>
              <li>✓ Background alerting</li>
            </ul>
            <Link
              href="/docs/components/dashboard"
              className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center"
            >
              Learn more →
            </Link>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
            <h3 className="text-2xl font-semibold mb-4">CLI</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Beautiful terminal-based dashboard using Bubble Tea for an interactive TUI experience.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>✓ Real-time metrics</li>
              <li>✓ Responsive layout</li>
              <li>✓ Keyboard navigation</li>
              <li>✓ Demo mode</li>
            </ul>
            <Link
              href="/docs/components/cli"
              className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center"
            >
              Learn more →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 bg-gradient-to-r from-red-600 to-orange-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Deploy with Docker Compose in under 5 minutes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs/quickstart"
              className="px-8 py-3 bg-white text-red-600 hover:bg-gray-100 font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Quick Start Guide
            </Link>
            <Link
              href="/docs"
              className="px-8 py-3 border-2 border-white hover:bg-white/10 font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Full Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 dark:text-gray-400 text-center md:text-left">
              Made with ❤️ for the Traefik community
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/hhftechnology/traefik-log-dashboard"
                className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors flex items-center gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5" />
                <span className="text-sm">GitHub</span>
              </a>
              <a
                href="https://discord.gg/HDCt9MjyMJ"
                className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors flex items-center gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-sm">Discord</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
