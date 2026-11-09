'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Agent } from '../types/agent';
import { toast } from 'sonner';
import { dashboardAuthHeaders } from '../dashboard-auth';
import { agentStore } from '../stores/agent-store';

interface AgentContextType {
  agents: Agent[];
  selectedAgent: Agent | null;
  selectAgent: (id: string) => void;
  addAgent: (agent: Omit<Agent, 'id' | 'number'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  refreshAgents: () => void;
  checkAgentStatus: (id: string, signal?: AbortSignal) => Promise<boolean>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => agentStore.getAgents());
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(() => agentStore.getSelectedAgent());

  // Initial async load from server
  useMountEffect(() => {
    agentStore.refresh().then(() => {
      setAgents(agentStore.getAgents());
      setSelectedAgent(agentStore.getSelectedAgent());
    }).catch((err) => {
      console.error('[AgentContext] Failed to refresh agents:', err);
    });
  });

  const refreshAgents = useCallback(() => {
    agentStore.refresh().then(() => {
      setAgents(agentStore.getAgents());
      setSelectedAgent(agentStore.getSelectedAgent());
    }).catch((err) => {
      console.error('[AgentContext] Failed to refresh agents:', err);
      toast.error('Failed to refresh agents');
    });
  }, []);

  const selectAgent = useCallback((id: string) => {
    agentStore.setSelectedAgentId(id);
    const agent = agentStore.getAgentById(id);
    setSelectedAgent(agent);
    if (agent) {
      toast.success('Agent selected', { description: `Switched to ${agent.name}` });
    }
  }, []);

  const addAgent = useCallback((agent: Omit<Agent, 'id' | 'number'>): Agent => {
    const newAgent = agentStore.addAgent(agent);
    setAgents(agentStore.getAgents());

    // Refresh from server to get the real ID
    agentStore.refresh().then(() => {
      setAgents(agentStore.getAgents());
    });

    toast.success('Agent added successfully');
    return newAgent;
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    agentStore.updateAgent(id, updates);
    const updated = agentStore.getAgents();
    setAgents(updated);

    if (selectedAgent?.id === id) {
      setSelectedAgent(agentStore.getAgentById(id));
    }

    // Only show toast for manual updates, not status checks
    if (!updates.status) {
      toast.success('Agent updated successfully');
    }
  }, [selectedAgent]);

  const deleteAgent = useCallback((id: string) => {
    agentStore.deleteAgent(id);
    const remaining = agentStore.getAgents();
    setAgents(remaining);

    if (selectedAgent?.id === id) {
      const next = remaining[0] ?? null;
      setSelectedAgent(next);
      if (next) {
        agentStore.setSelectedAgentId(next.id);
      }
    }

    toast.success('Agent deleted successfully');
  }, [selectedAgent]);

  const checkAgentStatus = useCallback(async (id: string, signal?: AbortSignal): Promise<boolean> => {
    const agent = agentStore.getAgentById(id);
    if (!agent) {
      console.warn(`Agent ${id} not found for status check`);
      return false;
    }

    // Update to checking
    agentStore.updateAgent(id, { status: 'checking' });
    setAgents(agentStore.getAgents());

    try {
      // Use server-side status check — this can reach internal Docker URLs
      const response = await fetch('/api/dashboard/agents/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...dashboardAuthHeaders() },
        body: JSON.stringify({ id }),
        signal,
      });

      const result = await response.json();
      const isOnline = result.online === true;

      // Refresh from server to get updated status
      await agentStore.refresh();
      setAgents(agentStore.getAgents());

      return isOnline;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      console.error(`Agent ${id} status check failed:`, error);

      agentStore.updateAgent(id, { status: 'offline' });
      setAgents(agentStore.getAgents());

      return false;
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      agents,
      selectedAgent,
      selectAgent,
      addAgent,
      updateAgent,
      deleteAgent,
      refreshAgents,
      checkAgentStatus,
    }),
    [agents, selectedAgent, selectAgent, addAgent, updateAgent, deleteAgent, refreshAgents, checkAgentStatus],
  );

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentProvider');
  }
  return context;
}
