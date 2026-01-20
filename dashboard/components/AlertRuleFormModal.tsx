'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AlertRule,
  AlertTriggerType,
  AlertInterval,
  AlertParameter,
  AlertParameterConfig,
  Webhook,
} from '@/lib/types/alerting';
import { Agent } from '@/lib/types/agent';

interface AlertRuleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (alert: Partial<AlertRule>) => Promise<void>;
  alert?: AlertRule | null;
  webhooks: Webhook[];
  agents: Agent[];
}

const PARAMETER_OPTIONS: Array<{
  parameter: AlertParameter;
  label: string;
  description: string;
  hasLimit: boolean;
  hasThreshold: boolean;
}> = [
  {
    parameter: 'request_count',
    label: 'Total Requests',
    description: 'Total number of requests',
    hasLimit: false,
    hasThreshold: true,
  },
  {
    parameter: 'error_rate',
    label: 'Error Rate',
    description: 'Percentage of failed requests',
    hasLimit: false,
    hasThreshold: true,
  },
  {
    parameter: 'response_time',
    label: 'Response Time',
    description: 'Average, P95, P99 response times',
    hasLimit: false,
    hasThreshold: true,
  },
  {
    parameter: 'top_ips',
    label: 'Top IPs',
    description: 'Top IP addresses by request count',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_client_ips',
    label: 'Top Client IPs',
    description: 'Top client IP addresses',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_locations',
    label: 'Top Locations',
    description: 'Top geographic locations',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_routes',
    label: 'Top Routes',
    description: 'Most accessed routes',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_status_codes',
    label: 'Top Status Codes',
    description: 'HTTP status code distribution',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_user_agents',
    label: 'Top User Agents',
    description: 'Browser/client statistics',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_routers',
    label: 'Top Routers',
    description: 'Traefik router metrics',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_services',
    label: 'Top Services',
    description: 'Backend service metrics',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_hosts',
    label: 'Top Hosts',
    description: 'Request host distribution',
    hasLimit: true,
    hasThreshold: false,
  },
  {
    parameter: 'top_request_addresses',
    label: 'Top Request Addresses',
    description: 'Request address metrics',
    hasLimit: true,
    hasThreshold: false,
  },
];

const INTERVAL_OPTIONS: Array<{ value: AlertInterval; label: string }> = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours (daily)' },
];

export default function AlertRuleFormModal({
  isOpen,
  onClose,
  onSave,
  alert,
  webhooks,
  agents,
}: AlertRuleFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    agent_id: undefined as string | undefined,
    webhook_ids: [] as string[],
    trigger_type: 'interval' as AlertTriggerType,
    interval: '1h' as AlertInterval,
    parameters: [] as AlertParameterConfig[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'basic' | 'webhooks' | 'parameters'>('basic');

  // Initialize default parameters
  const initializeParameters = (): AlertParameterConfig[] => {
    return PARAMETER_OPTIONS.map(option => ({
      parameter: option.parameter,
      enabled: false,
      limit: option.hasLimit ? 5 : undefined,
      threshold: option.hasThreshold ? undefined : undefined,
    }));
  };

  // Reset form when modal opens or alert changes
  useEffect(() => {
    if (isOpen) {
      if (alert) {
        setFormData({
          name: alert.name,
          description: alert.description || '',
          enabled: alert.enabled,
          agent_id: alert.agent_id,
          webhook_ids: alert.webhook_ids,
          trigger_type: alert.trigger_type,
          interval: alert.interval || '1h',
          parameters: alert.parameters,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          enabled: true,
          agent_id: undefined,
          webhook_ids: [],
          trigger_type: 'interval',
          interval: '1h',
          parameters: initializeParameters(),
        });
      }
      setErrors({});
      setExpandedSection('basic');
    }
  }, [isOpen, alert]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.webhook_ids.length === 0) {
      newErrors.webhooks = 'At least one webhook must be selected';
    }

    if (formData.trigger_type === 'interval' && !formData.interval) {
      newErrors.interval = 'Interval is required for interval-based alerts';
    }

    const enabledParams = formData.parameters.filter(p => p.enabled);
    if (enabledParams.length === 0) {
      newErrors.parameters = 'At least one parameter must be enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save alert rule:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const toggleWebhook = (webhookId: string) => {
    setFormData(prev => ({
      ...prev,
      webhook_ids: prev.webhook_ids.includes(webhookId)
        ? prev.webhook_ids.filter(id => id !== webhookId)
        : [...prev.webhook_ids, webhookId],
    }));
    if (errors.webhooks) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.webhooks;
        return newErrors;
      });
    }
  };

  const updateParameter = (parameter: AlertParameter, updates: Partial<AlertParameterConfig>) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.map(p =>
        p.parameter === parameter ? { ...p, ...updates } : p
      ),
    }));
    if (errors.parameters) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.parameters;
        return newErrors;
      });
    }
  };

  const toggleSection = (section: typeof expandedSection) => {
    setExpandedSection(expandedSection === section ? 'basic' : section);
  };

  if (!isOpen) return null;

  const enabledWebhooks = webhooks.filter(w => w.enabled);
  const enabledParamsCount = formData.parameters.filter(p => p.enabled).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-red-200 dark:border-red-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-2xl font-bold text-foreground">
            {alert ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="border-2 border-red-200 dark:border-red-800 rounded-lg">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between p-4 hover:bg-accent"
            >
              <h3 className="text-lg font-semibold">Basic Information</h3>
              {expandedSection === 'basic' ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSection === 'basic' && (
              <div className="p-4 border-t border-border space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Hourly Traffic Summary"
                    className={`w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground ${
                      errors.name ? 'border-red-500 dark:border-red-400' : 'border-red-200 dark:border-red-800'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.name}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => handleInputChange('description', e.target.value)}
                    placeholder="e.g., Send traffic metrics every hour"
                    rows={2}
                    className="w-full px-3 py-2 border-2 border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
                  />
                </div>

                {/* Trigger Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Trigger Type <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="interval"
                        checked={formData.trigger_type === 'interval'}
                        onChange={e => handleInputChange('trigger_type', e.target.value as AlertTriggerType)}
                        className="mr-2"
                      />
                      <Badge variant="default">Interval</Badge>
                      <span className="ml-2 text-sm text-muted-foreground">Fixed schedule</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="threshold"
                        checked={formData.trigger_type === 'threshold'}
                        onChange={e => handleInputChange('trigger_type', e.target.value as AlertTriggerType)}
                        className="mr-2"
                      />
                      <Badge variant="secondary">Threshold</Badge>
                      <span className="ml-2 text-sm text-muted-foreground">When metric exceeds value</span>
                    </label>
                  </div>
                </div>

                {/* Interval (only for interval type) */}
                {formData.trigger_type === 'interval' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Interval <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <select
                      value={formData.interval}
                      onChange={e => handleInputChange('interval', e.target.value as AlertInterval)}
                      className="w-full px-3 py-2 border-2 border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
                    >
                      {INTERVAL_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Agent Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Agent <span className="text-muted-foreground">(optional - all agents if not selected)</span>
                  </label>
                  <select
                    value={formData.agent_id || ''}
                    onChange={e => handleInputChange('agent_id', e.target.value || undefined)}
                    className="w-full px-3 py-2 border-2 border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
                  >
                    <option value="">All agents</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Enabled */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={e => handleInputChange('enabled', e.target.checked)}
                    className="mr-2 h-4 w-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-foreground">
                    Enable alert rule immediately
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Webhook Selection */}
          <div className="border-2 border-red-200 dark:border-red-800 rounded-lg">
            <button
              type="button"
              onClick={() => toggleSection('webhooks')}
              className="w-full flex items-center justify-between p-4 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Webhooks</h3>
                <Badge variant="outline">{formData.webhook_ids.length} selected</Badge>
              </div>
              {expandedSection === 'webhooks' ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSection === 'webhooks' && (
              <div className="p-4 border-t border-border">
                {enabledWebhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No webhooks available. Create a webhook first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {enabledWebhooks.map(webhook => (
                      <label
                        key={webhook.id}
                        className="flex items-center p-3 border-2 border-red-200 dark:border-red-800 rounded-lg cursor-pointer hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={formData.webhook_ids.includes(webhook.id)}
                          onChange={() => toggleWebhook(webhook.id)}
                          className="mr-3 h-4 w-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{webhook.name}</span>
                            <Badge variant={webhook.type === 'discord' ? 'default' : 'secondary'}>
                              {webhook.type}
                            </Badge>
                          </div>
                          {webhook.description && (
                            <p className="text-sm text-muted-foreground mt-1">{webhook.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {errors.webhooks && (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400">{errors.webhooks}</p>
                )}
              </div>
            )}
          </div>

          {/* Parameters */}
          <div className="border-2 border-red-200 dark:border-red-800 rounded-lg">
            <button
              type="button"
              onClick={() => toggleSection('parameters')}
              className="w-full flex items-center justify-between p-4 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Alert Parameters</h3>
                <Badge variant="outline">{enabledParamsCount} enabled</Badge>
              </div>
              {expandedSection === 'parameters' ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSection === 'parameters' && (
              <div className="p-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  Select which metrics to include in alert notifications
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {PARAMETER_OPTIONS.map(option => {
                    const param = formData.parameters.find(p => p.parameter === option.parameter);
                    if (!param) return null;

                    return (
                      <div key={option.parameter} className="border-2 border-red-200 dark:border-red-800 rounded-lg p-3">
                        <label className="flex items-start cursor-pointer">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={e => updateParameter(option.parameter, { enabled: e.target.checked })}
                            className="mt-1 mr-3 h-4 w-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">{option.description}</div>

                            {param.enabled && (
                              <div className="mt-2 flex gap-4">
                                {option.hasLimit && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm text-foreground">Top:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="20"
                                      value={param.limit || 5}
                                      onChange={e => updateParameter(option.parameter, {
                                        limit: parseInt(e.target.value) || 5
                                      })}
                                      className="w-16 px-2 py-1 border-2 border-red-200 dark:border-red-800 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
                                    />
                                  </div>
                                )}
                                {option.hasThreshold && formData.trigger_type === 'threshold' && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm text-foreground">Threshold:</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={param.threshold || ''}
                                      onChange={e => updateParameter(option.parameter, {
                                        threshold: parseFloat(e.target.value) || undefined
                                      })}
                                      placeholder="e.g., 5.0"
                                      className="w-24 px-2 py-1 border-2 border-red-200 dark:border-red-800 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>

                {errors.parameters && (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400">{errors.parameters}</p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border-2 border-red-200 dark:border-red-800 hover:border-red-500 dark:hover:border-red-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {saving ? 'Saving...' : alert ? 'Update Alert Rule' : 'Create Alert Rule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
