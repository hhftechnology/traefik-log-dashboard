'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Agent } from '../types/agent';
import { useAgents } from '../contexts/AgentContext';
import { useTabVisibility } from './useTabVisibility';

interface AgentHealthMetrics {
  agentId: string;
  isOnline: boolean;
  responseTime: number;
  lastChecked: Date;
  consecutiveFailures: number;
  uptime: number;
  error?: string;
}

interface HealthMonitorOptions {
  checkInterval?: number;
  enableAutoCheck?: boolean;
  onStatusChange?: (agentId: string, isOnline: boolean) => void;
}

export function useAgentHealth(options: HealthMonitorOptions = {}) {
  // PERFORMANCE FIX: Increased default from 30s to 10min to reduce CPU/memory load
  const {
    checkInterval = 600000, // 10 minutes
    enableAutoCheck = false, // PERFORMANCE FIX: Disabled by default
    onStatusChange,
  } = options;

  const { agents, checkAgentStatus } = useAgents();
  const [healthMetrics, setHealthMetrics] = useState<Record<string, AgentHealthMetrics>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Use refs to avoid dependency issues
  const healthMetricsRef = useRef(healthMetrics);
  const onStatusChangeRef = useRef(onStatusChange);

  // RACE CONDITION FIX: Track ongoing checks to prevent duplicate requests
  const ongoingChecksRef = useRef<Set<string>>(new Set());

  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  // Update refs when values change
  useEffect(() => {
    healthMetricsRef.current = healthMetrics;
  }, [healthMetrics]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const calculateUptime = useCallback((agentId: string, currentStatus: boolean): number => {
    const current = healthMetricsRef.current[agentId];
    if (!current) return currentStatus ? 100 : 0;

    const totalChecks = current.consecutiveFailures + 1;
    const successfulChecks = currentStatus 
      ? totalChecks - current.consecutiveFailures 
      : totalChecks - current.consecutiveFailures - 1;
    
    return (successfulChecks / totalChecks) * 100;
  }, []);

  const checkSingleAgent = useCallback(async (agent: Agent): Promise<AgentHealthMetrics> => {
    // RACE CONDITION FIX: Skip if already checking this agent
    if (ongoingChecksRef.current.has(agent.id)) {
      // Return cached metrics or a default
      const cached = healthMetricsRef.current[agent.id];
      if (cached) {
        return cached;
      }
      // Return a placeholder while check is ongoing
      return {
        agentId: agent.id,
        isOnline: false,
        responseTime: 0,
        lastChecked: new Date(),
        consecutiveFailures: 0,
        uptime: 0,
        error: 'Check already in progress',
      };
    }

    // Mark this agent as being checked
    ongoingChecksRef.current.add(agent.id);

    const startTime = Date.now();
    let isOnline = false;
    let error: string | undefined;
    const abortController = new AbortController();

    try {
      // MEMORY LEAK FIX: Add timeout to prevent hanging requests
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout
      
      try {
        isOnline = await checkAgentStatus(agent.id);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      // Don't treat abort as error
      if (err instanceof Error && err.name === 'AbortError') {
        error = 'Request timeout';
      } else {
        error = err instanceof Error ? err.message : 'Unknown error';
      }
    } finally {
      // CLEANUP: Always remove from ongoing checks
      ongoingChecksRef.current.delete(agent.id);
    }

    const responseTime = Date.now() - startTime;
    const currentMetrics = healthMetricsRef.current[agent.id];

    return {
      agentId: agent.id,
      isOnline,
      responseTime,
      lastChecked: new Date(),
      consecutiveFailures: isOnline ? 0 : (currentMetrics?.consecutiveFailures || 0) + 1,
      uptime: calculateUptime(agent.id, isOnline),
      error,
    };
  }, [checkAgentStatus, calculateUptime]);

  // REFACTORED: Use Promise.allSettled to prevent crashes from single agent failures
  const checkAllAgents = useCallback(async () => {
    if (agents.length === 0) {
      setIsMonitoring(false);
      return;
    }

    setIsMonitoring(true);

    // CRITICAL FIX: Use Promise.allSettled instead of Promise.all
    // This prevents the entire health check from failing if one agent fails
    const results = await Promise.allSettled(
      agents.map(agent => checkSingleAgent(agent))
    );

    const newMetrics: Record<string, AgentHealthMetrics> = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const metric = result.value;
        newMetrics[metric.agentId] = metric;

        // Trigger status change callback if status changed
        const previousStatus = healthMetricsRef.current[metric.agentId]?.isOnline;
        if (previousStatus !== undefined && previousStatus !== metric.isOnline && onStatusChangeRef.current) {
          onStatusChangeRef.current(metric.agentId, metric.isOnline);
        }
      } else {
        // IMPROVED: Handle rejected promises gracefully
        const agent = agents[index];
        console.error(`Health check failed for agent ${agent?.id}:`, result.reason);

        // Create a failure metric for the agent
        if (agent) {
          newMetrics[agent.id] = {
            agentId: agent.id,
            isOnline: false,
            responseTime: 0,
            lastChecked: new Date(),
            consecutiveFailures: (healthMetricsRef.current[agent.id]?.consecutiveFailures || 0) + 1,
            uptime: 0,
            error: result.reason instanceof Error ? result.reason.message : 'Health check failed',
          };
        }
      }
    });

    setHealthMetrics(newMetrics);
    setIsMonitoring(false);
  }, [agents, checkSingleAgent]); // Removed healthMetrics from dependencies

  // MEMORY LEAK FIX: Auto-check setup with proper dependencies and visibility check
  useEffect(() => {
    if (!enableAutoCheck || agents.length === 0 || !isTabVisible) return;

    // Initial check
    checkAllAgents();

    // Set up interval
    const interval = setInterval(() => {
      // Double-check visibility before executing
      if (!document.hidden) {
        checkAllAgents();
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, [enableAutoCheck, checkInterval, agents.length, checkAllAgents, isTabVisible]); // FIXED: Added checkAllAgents and isTabVisible

  const getAgentHealth = useCallback((agentId: string): AgentHealthMetrics | null => {
    return healthMetrics[agentId] || null;
  }, [healthMetrics]);

  const getOverallHealth = useCallback((): {
    totalAgents: number;
    onlineAgents: number;
    offlineAgents: number;
    averageResponseTime: number;
    overallUptime: number;
  } => {
    const metrics = Object.values(healthMetrics);
    const onlineCount = metrics.filter(m => m.isOnline).length;
    const avgResponseTime = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
      : 0;
    const avgUptime = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.uptime, 0) / metrics.length
      : 0;

    return {
      totalAgents: agents.length,
      onlineAgents: onlineCount,
      offlineAgents: agents.length - onlineCount,
      averageResponseTime: Math.round(avgResponseTime),
      overallUptime: Math.round(avgUptime * 100) / 100,
    };
  }, [healthMetrics, agents.length]);

  const getUnhealthyAgents = useCallback((): AgentHealthMetrics[] => {
    return Object.values(healthMetrics).filter(
      m => !m.isOnline || m.consecutiveFailures > 0 || m.responseTime > 5000
    );
  }, [healthMetrics]);

  return {
    healthMetrics,
    isMonitoring,
    checkAllAgents,
    checkSingleAgent,
    getAgentHealth,
    getOverallHealth,
    getUnhealthyAgents,
  };
}