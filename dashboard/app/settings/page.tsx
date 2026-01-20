'use client';

import Link from 'next/link';
import {
  Server,
  Bell,
  Database,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardContent } from '@/components/ui/Card';

const settingsItems = [
  {
    title: 'Agent Management',
    description: 'Configure and monitor your Traefik log agents',
    icon: Server,
    href: '/settings/agents',
  },
  {
    title: 'Alert Configuration',
    description: 'Manage webhooks and alert rules for notifications',
    icon: Bell,
    href: '/settings/alerts',
  },
  {
    title: 'Historical Data',
    description: 'Configure long-term data retention and archival',
    icon: Database,
    href: '/settings/historical',
  },
  {
    title: 'Filters',
    description: 'Configure log filtering and search settings',
    icon: Filter,
    href: '/settings/filters',
  },
];

export default function SettingsPage() {
  return (
    <DashboardShell title="Settings">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your Traefik Log Dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                            {item.title}
                          </h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
