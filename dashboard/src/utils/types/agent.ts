export interface Agent {
  id: string; // Unique agent identifier (e.g., "agent-001", "agent-002")
  name: string; // Display name (e.g., "Production Server", "Staging Server")
  url: string; // Agent API URL (used for browser API calls)
  configuredUrl?: string; // Original configured URL for display (e.g., container name, internal URL)
  token?: string; // Write-only. API responses omit this and report tokenSet instead.
  tokenSet?: boolean; // True when the server has a stored token for this agent.
  source?: 'env' | 'user'; // Agent origin. env agents are protected in UI/store.
  location: 'on-site' | 'off-site'; // Deployment location
  number: number; // Sequential agent number
  status?: 'online' | 'offline' | 'checking'; // Connection status
  lastSeen?: Date; // Last successful connection
  description?: string; // Optional description
  tags?: string[]; // Optional tags (e.g., ["production", "us-east-1"])
}

// Flexible type for updates that accepts both Date and string for lastSeen
export type AgentUpdate = Omit<Partial<Agent>, 'lastSeen'> & {
  lastSeen?: Date | string | null;
};

export interface AgentStore {
  agents: Agent[];
  selectedAgentId: string | null;
}

export interface AgentStatus {
  agentId: string;
  online: boolean;
  version?: string;
  uptime?: number;
  error?: string;
}
