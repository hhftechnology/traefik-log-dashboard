// dashboard/components/ui/AgentSelector.tsx
'use client';

import * as React from 'react';
import { MapPin, Server, Circle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAgents } from '@/lib/contexts/AgentContext';
import { Agent } from '@/lib/types/agent';

interface AgentSelectorProps {
  className?: string;
}

export default function AgentSelector({ className }: AgentSelectorProps) {
  const { agents, selectedAgent, selectAgent, checkAgentStatus } = useAgents();
  const [isChecking, setIsChecking] = React.useState<Record<string, boolean>>({});
  const hasCheckedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    // Only check status of selected agent on mount (not all agents)
    // This prevents sending too many requests which can trigger rate limiting
    if (selectedAgent && !hasCheckedRef.current.has(selectedAgent.id)) {
      hasCheckedRef.current.add(selectedAgent.id);
      handleCheckStatus(selectedAgent.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent?.id]);

  const handleCheckStatus = async (agentId: string) => {
    setIsChecking(prev => ({ ...prev, [agentId]: true }));
    await checkAgentStatus(agentId);
    setIsChecking(prev => ({ ...prev, [agentId]: false }));
  };

  const getStatusColor = (status?: Agent['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'checking':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-400';
    }
  };

  const getLocationIcon = (location: Agent['location']) => {
    return location === 'on-site' ? (
      <Server className="w-3 h-3" />
    ) : (
      <MapPin className="w-3 h-3" />
    );
  };

  if (agents.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No agents configured
      </div>
    );
  }

  return (
    <Select
      value={selectedAgent?.id}
      onValueChange={(value) => {
        selectAgent(value);
        handleCheckStatus(value);
      }}
    >
      <SelectTrigger className={cn('w-[280px]', className)}>
        <SelectValue>
          {selectedAgent ? (
            <div className="flex items-center gap-2">
              <Circle className={cn('w-2 h-2 rounded-full', getStatusColor(selectedAgent.status))} />
              <span className="font-medium">Agent #{selectedAgent.number}</span>
              <span className="text-muted-foreground">·</span>
              <span>{selectedAgent.name}</span>
            </div>
          ) : (
            'Select an agent'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Available Agents ({agents.length})
          </SelectLabel>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-3 py-1">
                <Circle
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    isChecking[agent.id] ? 'bg-yellow-500 animate-pulse' : getStatusColor(agent.status)
                  )}
                />
                
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      Agent #{agent.number}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-sm truncate">{agent.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {getLocationIcon(agent.location)}
                    <span className="capitalize">{agent.location}</span>
                    {agent.tags && agent.tags.length > 0 && (
                      <>
                        <span>·</span>
                        <div className="flex gap-1">
                          {agent.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {agent.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {agent.description}
                    </span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}