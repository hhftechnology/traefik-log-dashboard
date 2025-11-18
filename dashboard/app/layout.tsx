// dashboard/app/layout.tsx
import React from 'react';
import './globals.css';
import Providers from '@/components/providers/Providers'; // MODIFIED LINE 4

export const metadata = {
  title: 'Traefik Log Dashboard',
  description: 'Real-time analytics and monitoring for Traefik reverse proxy logs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="min-h-screen bg-background">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}