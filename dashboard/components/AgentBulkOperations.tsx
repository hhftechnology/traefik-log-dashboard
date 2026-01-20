'use client';

import { useState } from 'react';
import { useAgents } from '@/lib/contexts/AgentContext';
import { AgentImportExport } from '@/lib/agent-import-export';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Upload,
  Copy,
  Clipboard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface BulkOperationsProps {
  onClose?: () => void;
}

export default function AgentBulkOperations({ onClose }: BulkOperationsProps) {
  const { agents, refreshAgents, checkAgentStatus } = useAgents();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  const handleExport = () => {
    try {
      AgentImportExport.downloadAgentConfig();
      setResult({
        type: 'success',
        message: 'Configuration exported successfully',
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to export configuration',
        details: [error instanceof Error ? error.message : String(error)],
      });
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const success = await AgentImportExport.copyToClipboard();
      if (success) {
        setResult({
          type: 'success',
          message: 'Configuration copied to clipboard',
        });
      } else {
        setResult({
          type: 'error',
          message: 'Failed to copy to clipboard',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to copy to clipboard',
        details: [error instanceof Error ? error.message : String(error)],
      });
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const validation = await AgentImportExport.validateImportFile(file);
      if (!validation.valid) {
        setResult({
          type: 'error',
          message: 'Invalid configuration file',
          details: validation.errors,
        });
        setIsProcessing(false);
        return;
      }

      const importResult = await AgentImportExport.importFromFile(file, {
        mergeMode: 'merge',
      });

      if (importResult.success) {
        refreshAgents();
        setResult({
          type: 'success',
          message: `Imported ${importResult.imported} agent(s)`,
          details: importResult.skipped > 0 ? [`Skipped ${importResult.skipped} existing agent(s)`] : undefined,
        });
      } else {
        setResult({
          type: 'error',
          message: 'Import completed with errors',
          details: importResult.errors,
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to import configuration',
        details: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const handleImportFromClipboard = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const importResult = await AgentImportExport.importFromClipboard({
        mergeMode: 'merge',
      });

      if (importResult.success) {
        refreshAgents();
        setResult({
          type: 'success',
          message: `Imported ${importResult.imported} agent(s) from clipboard`,
          details: importResult.skipped > 0 ? [`Skipped ${importResult.skipped} existing agent(s)`] : undefined,
        });
      } else {
        setResult({
          type: 'error',
          message: 'Import failed',
          details: importResult.errors,
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to import from clipboard',
        details: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckAllStatus = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const results = await Promise.all(
        agents.map(agent => checkAgentStatus(agent.id))
      );

      const onlineCount = results.filter(Boolean).length;
      
      setResult({
        type: 'info',
        message: `Status check complete`,
        details: [
          `${onlineCount} of ${agents.length} agent(s) online`,
          `${agents.length - onlineCount} offline`,
        ],
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to check agent status',
        details: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBackup = () => {
    try {
      AgentImportExport.createBackup();
      setResult({
        type: 'success',
        message: 'Backup created successfully',
        details: ['Backup file downloaded to your computer'],
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Failed to create backup',
        details: [error instanceof Error ? error.message : String(error)],
      });
    }
  };

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Bulk Operations
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multiple agents at once
          </p>
        </div>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="icon">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Result Message */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.type === 'success'
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : result.type === 'error'
              ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex gap-3">
            {result.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : result.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`font-medium ${
                  result.type === 'success'
                    ? 'text-green-900 dark:text-green-100'
                    : result.type === 'error'
                    ? 'text-red-900 dark:text-red-100'
                    : 'text-blue-900 dark:text-blue-100'
                }`}
              >
                {result.message}
              </p>
              {result.details && result.details.length > 0 && (
                <ul className="mt-2 text-sm space-y-1">
                  {result.details.map((detail, index) => (
                    <li
                      key={index}
                      className={
                        result.type === 'success'
                          ? 'text-green-800 dark:text-green-200'
                          : result.type === 'error'
                          ? 'text-red-800 dark:text-red-200'
                          : 'text-blue-800 dark:text-blue-200'
                      }
                    >
                      • {detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Operations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Operations */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Configuration
          </h4>
          
          <div className="space-y-2">
            <Button
              onClick={handleExport}
              variant="outline"
              className="w-full justify-start"
              disabled={isProcessing || agents.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download as JSON
            </Button>

            <Button
              onClick={handleCopyToClipboard}
              variant="outline"
              className="w-full justify-start"
              disabled={isProcessing || agents.length === 0}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>

            <Button
              onClick={handleCreateBackup}
              variant="outline"
              className="w-full justify-start"
              disabled={isProcessing || agents.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Create Backup
            </Button>
          </div>
        </div>

        {/* Import Operations */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Configuration
          </h4>

          <div className="space-y-2">
            <label className="block">
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
                disabled={isProcessing}
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={isProcessing}
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.querySelector('input');
                  input?.click();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import from File
              </Button>
            </label>

            <Button
              onClick={handleImportFromClipboard}
              variant="outline"
              className="w-full justify-start"
              disabled={isProcessing}
            >
              <Clipboard className="w-4 h-4 mr-2" />
              Import from Clipboard
            </Button>
          </div>
        </div>
      </div>

      {/* Status Operations */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Status Operations
        </h4>

        <Button
          onClick={handleCheckAllStatus}
          variant="outline"
          className="w-full justify-start"
          disabled={isProcessing || agents.length === 0}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
          Check All Agent Status
        </Button>
      </div>

      {/* Import Modes Info */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm">
          Import Modes
        </h5>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <li><strong>Merge:</strong> Adds new agents, updates existing ones</li>
          <li><strong>Replace:</strong> Removes all agents and imports new ones</li>
          <li><strong>Skip Existing:</strong> Only adds new agents, keeps existing ones unchanged</li>
        </ul>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 flex items-center gap-2">
          Currently using:
          <Badge variant="secondary" className="text-xs">
            Merge Mode
          </Badge>
        </p>
      </div>
    </div>
  );
}