// dashboard/app/settings/agents/page.tsx
// FIXES:
// 1. Added visual Lock icon for environment agents
// 2. Disabled delete button for environment agents with tooltip
// 3. Enhanced error handling for delete operations
// 4. Better UX for identifying protected agents

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAgents } from '@/lib/contexts/AgentContext';
import { Agent } from '@/lib/types/agent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Edit,
  Server,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Circle,
  Settings as SettingsIcon,
  Activity,
  ChevronLeft,
  Lock,
  Info,
  AlertTriangle,
} from 'lucide-react';
import AgentFormModal from '@/components/AgentFormModal';
import AgentBulkOperations from '@/components/AgentBulkOperations';
import AgentHealthDashboard from '@/components/AgentHealthDashboard';
import { toast } from 'sonner';

type TabType = 'agents' | 'health' | 'bulk';

// Helper function to check if agent is from environment
function isEnvironmentAgent(agent: Agent): boolean {
  // Environment agents typically have IDs starting with 'agent-env-' or are flagged in the database
  return agent.id.startsWith('agent-env-');
}

export default function AgentSettingsPage() {
  const { agents, selectedAgent, deleteAgent, checkAgentStatus } = useAgents();
  const [activeTab, setActiveTab] = useState<TabType>('agents');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});

  const handleCheckStatus = async (agentId: string) => {
    setCheckingStatus(prev => ({ ...prev, [agentId]: true }));
    await checkAgentStatus(agentId);
    setCheckingStatus(prev => ({ ...prev, [agentId]: false }));
  };

  const handleCheckAllStatus = async () => {
    for (const agent of agents) {
      await handleCheckStatus(agent.id);
    }
  };

  // FIXED: Enhanced delete handler with proper error handling
  const handleDelete = async (agent: Agent) => {
    // FIXED: Client-side check with improved UX
    if (isEnvironmentAgent(agent)) {
      toast.error('Cannot Delete Environment Agent', {
        description: 'This agent is configured in environment variables and cannot be deleted from the UI. To remove it, update your docker-compose.yml or .env file.',
        duration: 7000,
      });
      return;
    }

    if (confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      try {
        await deleteAgent(agent.id);
        // Success toast is already handled in AgentContext
      } catch (error) {
        // Error toast is already handled in AgentContext
        // Just log it here for debugging
        console.error('Delete operation failed:', error);
      }
    }
  };

  const getStatusIcon = (status?: Agent['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getLocationIcon = (location: Agent['location']) => {
    return location === 'on-site' ? (
      <MapPin className="w-4 h-4 text-green-600" />
    ) : (
      <Server className="w-4 h-4 text-blue-600" />
    );
  };

  const environmentAgentsCount = agents.filter(isEnvironmentAgent).length;

  return (
    <div className="min-h-screen bg-accent p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-red-600" />
              Agent Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure and monitor your Traefik log agents
            </p>
          </div>
        </div>

        {/* FIXED: Added info banner about environment agents */}
        {environmentAgentsCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">
                  Environment-Configured Agents
                </h4>
                <p className="text-sm text-blue-800">
                  You have {environmentAgentsCount} agent(s) configured via environment variables. 
                  These agents are protected and cannot be deleted from the UI. They are marked with a{' '}
                  <Lock className="w-4 h-4 inline-block" /> icon.
                  To modify or remove them, update your <code className="bg-blue-100 px-1 rounded">docker-compose.yml</code> or{' '}
                  <code className="bg-blue-100 px-1 rounded">.env</code> file.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'agents'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Agents ({agents.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'health'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Health
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'bulk'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bulk Operations
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'agents' && (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setEditingAgent(null);
                    setShowAddModal(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </Button>
                <Button
                  onClick={handleCheckAllStatus}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check All Status
                </Button>
              </div>
            </div>

            {/* Agent Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.length === 0 ? (
                <div className="col-span-2 bg-card border border-border rounded-lg p-12 text-center">
                  <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No Agents Configured
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Add your first agent to start monitoring Traefik logs
                  </p>
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Agent
                  </Button>
                </div>
              ) : (
                agents.map((agent) => {
                  const isEnvAgent = isEnvironmentAgent(agent);
                  const isSelected = selectedAgent?.id === agent.id;
                  
                  return (
                    <div
                      key={agent.id}
                      className={`bg-card border rounded-lg p-6 shadow-sm transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {agent.name}
                            </h3>
                            {/* FIXED: Added visual indicator for environment agents */}
                            {isEnvAgent && (
                              <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-medium">
                                <Lock className="w-3 h-3" />
                                <span>Protected</span>
                              </div>
                            )}
                            {isSelected && (
                              <Badge className="bg-red-100 text-red-800">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {getLocationIcon(agent.location)}
                            <span className="capitalize">{agent.location}</span>
                            <span className="text-border">•</span>
                            <span>Agent #{agent.number}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(agent.status)}
                          <span className="text-sm font-medium text-foreground capitalize">
                            {agent.status || 'unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">URL:</span>
                          <code className="ml-2 bg-accent px-2 py-1 rounded text-xs">
                            {agent.url}
                          </code>
                        </div>
                        {agent.description && (
                          <div className="text-sm text-muted-foreground">
                            {agent.description}
                          </div>
                        )}
                        {agent.lastSeen && (
                          <div className="text-xs text-muted-foreground">
                            Last seen:{' '}
                            {new Date(agent.lastSeen).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCheckStatus(agent.id)}
                          variant="outline"
                          size="sm"
                          disabled={checkingStatus[agent.id]}
                          className="border-border text-primary hover:bg-accent"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${checkingStatus[agent.id] ? 'animate-spin' : ''}`}
                          />
                        </Button>

                        <Button
                          onClick={() => {
                            setEditingAgent(agent);
                            setShowAddModal(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="border-border text-primary hover:bg-accent"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        {/* FIXED: Disabled delete button for environment agents with visual indicator */}
                        <Button
                          onClick={() => handleDelete(agent)}
                          variant="outline"
                          size="sm"
                          disabled={isEnvAgent}
                          className={`${
                            isEnvAgent
                              ? 'border-border text-muted-foreground cursor-not-allowed'
                              : 'border-border text-primary hover:bg-accent'
                          }`}
                          title={
                            isEnvAgent
                              ? 'Cannot delete environment-configured agents'
                              : 'Delete agent'
                          }
                        >
                          {isEnvAgent ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Setup Guide */}
            <div className="bg-primary/10 border border-border rounded-lg p-6">
              <h4 className="font-semibold text-foreground mb-3">
                Quick Setup Guide
              </h4>
              <ul className="text-sm text-foreground space-y-2 list-disc list-inside">
                <li>Deploy agents on servers where Traefik logs are located</li>
                <li>Configure unique authentication tokens for secure communication</li>
                <li>On-site agents: Running on the same network as the dashboard</li>
                <li>Off-site agents: Running on remote servers or cloud instances</li>
                <li>Agent numbering is automatically assigned sequentially</li>
                <li>
                  <strong>Protected agents</strong> configured via environment variables cannot be deleted from UI
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div>
            <AgentHealthDashboard />
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <AgentBulkOperations />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AgentFormModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingAgent(null);
          }}
          agent={editingAgent}
        />
      )}
    </div>
  );
}