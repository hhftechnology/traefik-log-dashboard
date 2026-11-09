import { dashboardAuthHeaders } from '../dashboard-auth';
import { Agent } from '../types/agent';

function managementHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...dashboardAuthHeaders(),
  };
}

const API_BASE = '/api/dashboard/agents';
const LEGACY_STORAGE_KEY = 'tld-agents';
const LEGACY_SELECTED_KEY = 'tld-selected-agent';
const SESSION_SELECTED_KEY = 'tld-selected-agent-session';
const MIGRATION_DONE_KEY = 'tld-migration-done';

let cachedAgents: Agent[] | null = null;
let cachedSelectedId: string | null = null;
let initPromise: Promise<void> | null = null;

async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch(API_BASE, { headers: managementHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`);
  }
  return response.json();
}

function getSessionSelectedID(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(SESSION_SELECTED_KEY);
}

function setSessionSelectedID(id: string | null): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  if (id) {
    sessionStorage.setItem(SESSION_SELECTED_KEY, id);
    return;
  }
  sessionStorage.removeItem(SESSION_SELECTED_KEY);
}

function resolveSelectedID(input: { agents: Agent[]; preferredID: string | null }): string | null {
  if (input.preferredID && input.agents.some((agent) => agent.id === input.preferredID)) {
    return input.preferredID;
  }
  return input.agents[0]?.id ?? null;
}

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (localStorage.getItem(MIGRATION_DONE_KEY)) {
    return;
  }

  const rawAgents = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!rawAgents) {
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    return;
  }

  try {
    const agents = JSON.parse(rawAgents) as Agent[];
    const userAgents = agents.filter((agent) => agent.source !== 'env' && !agent.id.startsWith('agent-env-'));

    if (userAgents.length > 0) {
      await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: managementHeaders(),
        body: JSON.stringify({ agents: userAgents }),
      });
    }

    const selectedID = localStorage.getItem(LEGACY_SELECTED_KEY);
    if (selectedID) {
      setSessionSelectedID(selectedID);
    }

    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SELECTED_KEY);
    console.log('[agent-store] Migrated agents from localStorage');
  } catch (error) {
    console.error('[agent-store] Migration failed:', error);
  }
}

migrateFromLocalStorage().catch(() => {});

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        cachedAgents = await fetchAgents();
        cachedSelectedId = resolveSelectedID({
          agents: cachedAgents,
          preferredID: getSessionSelectedID(),
        });
        setSessionSelectedID(cachedSelectedId);
      } catch {
        cachedAgents = [];
        cachedSelectedId = null;
      }
    })();
  }
  return initPromise;
}

ensureInit();

export const agentStore = {
  getAgents(): Agent[] {
    return cachedAgents ?? [];
  },

  addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
    const placeholder: Agent = {
      ...agent,
      id: `agent-pending-${Date.now()}`,
      number: (cachedAgents?.length ?? 0) + 1,
      source: 'user',
      status: 'checking',
    };

    fetch(API_BASE, {
      method: 'POST',
      headers: managementHeaders(),
      body: JSON.stringify(agent),
    })
      .then((response) => response.json())
      .then((created: Agent) => {
        if (!cachedAgents) {
          return;
        }
        const placeholderIndex = cachedAgents.findIndex((item) => item.id === placeholder.id);
        if (placeholderIndex >= 0) {
          cachedAgents[placeholderIndex] = created;
        } else {
          cachedAgents.push(created);
        }
      })
      .catch((error) => console.error('[agent-store] addAgent failed:', error));

    if (cachedAgents) {
      cachedAgents.push(placeholder);
    }

    return placeholder;
  },

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    if (!cachedAgents) {
      return null;
    }

    const agentIndex = cachedAgents.findIndex((agent) => agent.id === id);
    if (agentIndex === -1) {
      return null;
    }

    const existing = cachedAgents[agentIndex];
    if (existing.source === 'env' && !('status' in updates)) {
      return existing;
    }

    cachedAgents[agentIndex] = { ...existing, ...updates };

    fetch(API_BASE, {
      method: 'PATCH',
      headers: managementHeaders(),
      body: JSON.stringify({ id, ...updates }),
    }).catch((error) => console.error('[agent-store] updateAgent failed:', error));

    return cachedAgents[agentIndex];
  },

  deleteAgent(id: string): void {
    if (!cachedAgents) {
      return;
    }

    const existing = cachedAgents.find((agent) => agent.id === id);
    if (!existing || existing.source === 'env') {
      return;
    }

    cachedAgents = cachedAgents.filter((agent) => agent.id !== id);

    if (cachedSelectedId === id) {
      cachedSelectedId = cachedAgents[0]?.id ?? null;
      setSessionSelectedID(cachedSelectedId);
    }

    fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: managementHeaders() })
      .catch((error) => console.error('[agent-store] deleteAgent failed:', error));
  },

  getSelectedAgentId(): string | null {
    return cachedSelectedId;
  },

  setSelectedAgentId(id: string | null): void {
    cachedSelectedId = id;
    setSessionSelectedID(id);
  },

  getSelectedAgent(): Agent | null {
    const agents = agentStore.getAgents();
    if (cachedSelectedId) {
      const selected = agents.find((agent) => agent.id === cachedSelectedId);
      if (selected) {
        return selected;
      }
    }
    return agents[0] ?? null;
  },

  getAgentById(id: string): Agent | null {
    return agentStore.getAgents().find((agent) => agent.id === id) ?? null;
  },

  async refresh(): Promise<Agent[]> {
    cachedAgents = await fetchAgents();
    cachedSelectedId = resolveSelectedID({
      agents: cachedAgents,
      preferredID: cachedSelectedId ?? getSessionSelectedID(),
    });
    setSessionSelectedID(cachedSelectedId);
    return cachedAgents;
  },
};
