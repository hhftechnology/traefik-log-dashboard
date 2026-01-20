'use client';

import { memo } from 'react';
import { Cpu, HardDrive, MemoryStick, Activity, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { SystemStats } from '@/lib/types';

interface SystemSectionProps {
  systemStats: SystemStats | null | undefined;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getStatusColor(percentage: number): string {
  if (percentage < 50) return 'text-green-600';
  if (percentage < 75) return 'text-yellow-600';
  if (percentage < 90) return 'text-orange-600';
  return 'text-red-600';
}

function getStatusBg(percentage: number): string {
  if (percentage < 50) return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
  if (percentage < 75) return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
  if (percentage < 90) return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
  return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
}

function getStatusLabel(percentage: number): string {
  if (percentage < 50) return 'Normal';
  if (percentage < 75) return 'Moderate';
  if (percentage < 90) return 'High';
  return 'Critical';
}

function SystemSection({ systemStats }: SystemSectionProps) {
  if (!systemStats) {
    return (
      <div className="space-y-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">System Resources</CardTitle>
            <Server className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">System statistics not available</p>
                <p className="text-xs mt-1">Connect to an agent to view system resources</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cpuPercent = systemStats.cpu.usage_percent;
  const memoryPercent = systemStats.memory.used_percent;
  const diskPercent = systemStats.disk.used_percent;

  return (
    <div className="space-y-6">
      {/* Resource Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(cpuPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">CPU</CardTitle>
            <Cpu className={`h-5 w-5 ${getStatusColor(cpuPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(cpuPercent)}`}>
                  {cpuPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(cpuPercent)}`}>
                  {getStatusLabel(cpuPercent)}
                </span>
              </div>
              <Progress value={cpuPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Cores</span>
                  <span className="font-medium text-foreground">{systemStats.cpu.cores}</span>
                </div>
                {systemStats.cpu.model && (
                  <div className="flex justify-between mt-1">
                    <span>Model</span>
                    <span className="font-medium text-foreground truncate max-w-[150px]" title={systemStats.cpu.model}>
                      {systemStats.cpu.model}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(memoryPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Memory</CardTitle>
            <MemoryStick className={`h-5 w-5 ${getStatusColor(memoryPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(memoryPercent)}`}>
                  {memoryPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(memoryPercent)}`}>
                  {getStatusLabel(memoryPercent)}
                </span>
              </div>
              <Progress value={memoryPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.memory.used)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.memory.total)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Available</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.memory.available)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(diskPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Disk</CardTitle>
            <HardDrive className={`h-5 w-5 ${getStatusColor(diskPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(diskPercent)}`}>
                  {diskPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(diskPercent)}`}>
                  {getStatusLabel(diskPercent)}
                </span>
              </div>
              <Progress value={diskPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.disk.used)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.disk.total)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Free</span>
                  <span className="font-medium text-foreground">{formatBytes(systemStats.disk.free)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall System Health */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">System Health Overview</CardTitle>
          <Activity className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(cpuPercent)}`}>{cpuPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">CPU</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(memoryPercent)}`}>{memoryPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(diskPercent)}`}>{diskPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Disk</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-4 border-t">
              <div className={`w-3 h-3 rounded-full ${cpuPercent < 75 && memoryPercent < 75 && diskPercent < 75 ? 'bg-green-500' : cpuPercent < 90 && memoryPercent < 90 && diskPercent < 90 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {cpuPercent < 75 && memoryPercent < 75 && diskPercent < 75
                  ? 'System Healthy'
                  : cpuPercent < 90 && memoryPercent < 90 && diskPercent < 90
                    ? 'System Under Load'
                    : 'System Critical'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(SystemSection);
