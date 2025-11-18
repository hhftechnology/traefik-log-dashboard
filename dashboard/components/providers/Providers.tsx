// dashboard/components/providers/Providers.tsx
'use client';

import { AgentProvider } from '@/lib/contexts/AgentContext';
import { FilterProvider } from '@/lib/contexts/FilterContext';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AgentProvider>
        <FilterProvider>
          {children}
        </FilterProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}