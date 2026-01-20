// dashboard/components/providers/Providers.tsx
'use client';

import { ThemeProvider } from 'next-themes';
import { AgentProvider } from '@/lib/contexts/AgentContext';
import { FilterProvider } from '@/lib/contexts/FilterContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AgentProvider>
        <FilterProvider>
          {children}
        </FilterProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}