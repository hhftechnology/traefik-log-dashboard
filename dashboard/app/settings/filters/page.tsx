// dashboard/app/settings/filters/page.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import Link from 'next/link';
import { useFilters } from '@/lib/contexts/FilterContext';
import { FilterCondition } from '@/lib/types/filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  Filter,
  Plus,
  Trash2,
  Shield,
  Globe,
  Activity,
  AlertTriangle,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';

export default function FilterSettingsPage() {
  const { settings, updateSettings, resetSettings, addCustomCondition, removeCustomCondition, updateCustomCondition } = useFilters();
  
  const [newIP, setNewIP] = useState('');
  const [newStatusCode, setNewStatusCode] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newCustomHeader, setNewCustomHeader] = useState('');
  const [showCustomConditionForm, setShowCustomConditionForm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Custom condition form state
  const [customCondition, setCustomCondition] = useState<Partial<FilterCondition>>({
    name: '',
    type: 'custom',
    field: 'RequestPath',
    operator: 'contains',
    value: '',
    enabled: true,
    description: '',
  });

  const handleAddIP = () => {
    if (newIP.trim()) {
      updateSettings({
        excludedIPs: [...settings.excludedIPs, newIP.trim()],
      });
      setNewIP('');
      showSavedIndicator();
    }
  };

  const handleRemoveIP = (ip: string) => {
    updateSettings({
      excludedIPs: settings.excludedIPs.filter((i) => i !== ip),
    });
    showSavedIndicator();
  };

  const handleAddStatusCode = () => {
    const code = parseInt(newStatusCode);
    if (!isNaN(code) && code >= 100 && code < 600) {
      updateSettings({
        excludeStatusCodes: [...settings.excludeStatusCodes, code],
      });
      setNewStatusCode('');
      showSavedIndicator();
    }
  };

  const handleRemoveStatusCode = (code: number) => {
    updateSettings({
      excludeStatusCodes: settings.excludeStatusCodes.filter((c) => c !== code),
    });
    showSavedIndicator();
  };

  const handleAddPath = () => {
    if (newPath.trim()) {
      updateSettings({
        excludePaths: [...settings.excludePaths, newPath.trim()],
      });
      setNewPath('');
      showSavedIndicator();
    }
  };

  const handleRemovePath = (path: string) => {
    updateSettings({
      excludePaths: settings.excludePaths.filter((p) => p !== path),
    });
    showSavedIndicator();
  };

  const handleAddCustomHeader = () => {
    if (newCustomHeader.trim()) {
      updateSettings({
        proxySettings: {
          ...settings.proxySettings,
          customHeaders: [...settings.proxySettings.customHeaders, newCustomHeader.trim()],
        },
      });
      setNewCustomHeader('');
      showSavedIndicator();
    }
  };

  const handleRemoveCustomHeader = (header: string) => {
    updateSettings({
      proxySettings: {
        ...settings.proxySettings,
        customHeaders: settings.proxySettings.customHeaders.filter((h) => h !== header),
      },
    });
    showSavedIndicator();
  };

  const handleAddCustomCondition = () => {
    if (customCondition.name && customCondition.field && customCondition.value) {
      addCustomCondition({
        id: Date.now().toString(),
        name: customCondition.name,
        enabled: customCondition.enabled || true,
        type: customCondition.type || 'custom',
        field: customCondition.field,
        operator: customCondition.operator || 'contains',
        value: customCondition.value,
        description: customCondition.description,
      } as FilterCondition);
      
      setCustomCondition({
        name: '',
        type: 'custom',
        field: 'RequestPath',
        operator: 'contains',
        value: '',
        enabled: true,
        description: '',
      });
      setShowCustomConditionForm(false);
      showSavedIndicator();
    }
  };

  const showSavedIndicator = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all filter settings to defaults? This cannot be undone.')) {
      resetSettings();
      showSavedIndicator();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Filter className="w-6 h-6 text-red-600" />
                  Log Filters & Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure filtering rules to control which logs appear in your dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                  <Save className="w-3 h-3 mr-1" />
                  Saved
                </Badge>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="border-border text-primary hover:bg-accent"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset All
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* IP Filtering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                IP Address Filtering
              </CardTitle>
              <CardDescription>
                Exclude specific IPs or IP categories from the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle Options */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                  <span className="text-sm font-medium text-foreground">
                    Exclude Unknown IPs
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.excludeUnknownIPs}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      updateSettings({ excludeUnknownIPs: e.target.checked });
                      showSavedIndicator();
                    }}
                    className="w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                  <span className="text-sm font-medium text-foreground">
                    Exclude Private IPs
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.excludePrivateIPs}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      updateSettings({ excludePrivateIPs: e.target.checked });
                      showSavedIndicator();
                    }}
                    className="w-4 h-4"
                  />
                </label>
              </div>

              {/* Excluded IPs List */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Excluded IP Addresses ({settings.excludedIPs.length})
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newIP}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewIP(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddIP()}
                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                  />
                  <Button onClick={handleAddIP} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {settings.excludedIPs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No IPs excluded
                    </p>
                  ) : (
                    settings.excludedIPs.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between p-2 bg-primary/10 border border-border rounded-lg"
                      >
                        <span className="text-sm font-mono text-foreground">{ip}</span>
                        <Button
                          onClick={() => handleRemoveIP(ip)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proxy & Real IP Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-red-600" />
                Proxy & Real IP Detection
              </CardTitle>
              <CardDescription>
                Configure how to extract the real client IP from proxy headers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Cloudflare Headers
                    </div>
                    <div className="text-xs text-muted-foreground">CF-Connecting-IP</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.proxySettings.enableCFHeaders}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      updateSettings({
                        proxySettings: {
                          ...settings.proxySettings,
                          enableCFHeaders: e.target.checked,
                        },
                      });
                      showSavedIndicator();
                    }}
                    className="w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      X-Forwarded-For
                    </div>
                    <div className="text-xs text-muted-foreground">Standard proxy header</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.proxySettings.enableXForwardedFor}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      updateSettings({
                        proxySettings: {
                          ...settings.proxySettings,
                          enableXForwardedFor: e.target.checked,
                        },
                      });
                      showSavedIndicator();
                    }}
                    className="w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      X-Real-IP
                    </div>
                    <div className="text-xs text-muted-foreground">Nginx proxy header</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.proxySettings.enableXRealIP}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      updateSettings({
                        proxySettings: {
                          ...settings.proxySettings,
                          enableXRealIP: e.target.checked,
                        },
                      });
                      showSavedIndicator();
                    }}
                    className="w-4 h-4"
                  />
                </label>
              </div>

              {/* Custom Headers */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Custom Proxy Headers ({settings.proxySettings.customHeaders.length})
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newCustomHeader}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustomHeader(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddCustomHeader()}
                    placeholder="Header name (e.g., X-Custom-IP)"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                  />
                  <Button onClick={handleAddCustomHeader} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {settings.proxySettings.customHeaders.map((header) => (
                    <div
                      key={header}
                      className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <span className="text-sm font-mono text-foreground">{header}</span>
                      <Button
                        onClick={() => handleRemoveCustomHeader(header)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4 text-primary" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Code Filtering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-600" />
                Status Code Filtering
              </CardTitle>
              <CardDescription>
                Exclude specific HTTP status codes from appearing in the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  value={newStatusCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewStatusCode(e.target.value)}
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddStatusCode()}
                  placeholder="Status code (e.g., 404)"
                  min="100"
                  max="599"
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                />
                <Button onClick={handleAddStatusCode} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {settings.excludeStatusCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No status codes excluded
                  </p>
                ) : (
                  settings.excludeStatusCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between p-2 bg-primary/10 border border-border rounded-lg"
                    >
                      <span className="text-sm font-mono text-foreground">{code}</span>
                      <Button
                        onClick={() => handleRemoveStatusCode(code)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4 text-primary" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bot & Path Filtering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Bot & Path Filtering
              </CardTitle>
              <CardDescription>
                Filter out bots and specific request paths
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Exclude Bots & Crawlers
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Filters common bot user agents
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.excludeBots}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateSettings({ excludeBots: e.target.checked });
                    showSavedIndicator();
                  }}
                  className="w-4 h-4"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Excluded Paths ({settings.excludePaths.length})
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPath(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddPath()}
                    placeholder="Path to exclude (e.g., /health)"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                  />
                  <Button onClick={handleAddPath} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {settings.excludePaths.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No paths excluded
                    </p>
                  ) : (
                    settings.excludePaths.map((path) => (
                      <div
                        key={path}
                        className="flex items-center justify-between p-2 bg-primary/10 border border-border rounded-lg"
                      >
                        <span className="text-sm font-mono text-foreground">{path}</span>
                        <Button
                          onClick={() => handleRemovePath(path)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Conditions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-red-600" />
                    Custom Filter Conditions
                  </CardTitle>
                  <CardDescription>
                    Create custom rules to filter logs based on any field
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowCustomConditionForm(!showCustomConditionForm)}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Custom Condition Form */}
              {showCustomConditionForm && (
                <div className="mb-6 p-4 bg-accent rounded-lg border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-4">
                    New Custom Condition
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Condition Name
                      </label>
                      <input
                        type="text"
                        value={customCondition.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomCondition({ ...customCondition, name: e.target.value })}
                        placeholder="e.g., Exclude Health Checks"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Field
                      </label>
                      <select
                        value={customCondition.field}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setCustomCondition({ ...customCondition, field: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      >
                        <option value="RequestPath">Request Path</option>
                        <option value="RequestMethod">Request Method</option>
                        <option value="DownstreamStatus">Status Code</option>
                        <option value="RequestHost">Request Host</option>
                        <option value="RouterName">Router Name</option>
                        <option value="ServiceName">Service Name</option>
                        <option value="ClientHost">Client IP</option>
                        <option value="request_User_Agent">User Agent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Operator
                      </label>
                      <select
                        value={customCondition.operator}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setCustomCondition({ ...customCondition, operator: e.target.value as FilterCondition['operator'] })}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      >
                        <option value="equals">Equals</option>
                        <option value="not_equals">Not Equals</option>
                        <option value="contains">Contains</option>
                        <option value="starts_with">Starts With</option>
                        <option value="ends_with">Ends With</option>
                        <option value="regex">Regex</option>
                        <option value="greater_than">Greater Than</option>
                        <option value="less_than">Less Than</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Value
                      </label>
                      <input
                        type="text"
                        value={customCondition.value}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomCondition({ ...customCondition, value: e.target.value })}
                        placeholder="e.g., /health"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={customCondition.description}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomCondition({ ...customCondition, description: e.target.value })}
                        placeholder="Brief description of this filter"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleAddCustomCondition} size="sm">
                      Add Condition
                    </Button>
                    <Button
                      onClick={() => setShowCustomConditionForm(false)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Conditions List */}
              <div className="space-y-3">
                {settings.customConditions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No custom conditions defined
                  </p>
                ) : (
                  settings.customConditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="p-4 bg-card border border-border rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              {condition.name}
                            </h4>
                            <Badge
                              variant={condition.enabled ? 'default' : 'secondary'}
                              className={
                                condition.enabled
                                  ? 'bg-green-100 text-green-700 border-green-300'
                                  : ''
                              }
                            >
                              {condition.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {condition.field} {condition.operator.replace(/_/g, ' ')} &quot;{condition.value}&quot;
                          </p>
                          {condition.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {condition.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="checkbox"
                              checked={condition.enabled}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                updateCustomCondition(condition.id, {
                                  enabled: e.target.checked,
                                });
                                showSavedIndicator();
                              }}
                              className="w-4 h-4"
                            />
                          </label>
                          <Button
                            onClick={() => {
                              removeCustomCondition(condition.id);
                              showSavedIndicator();
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">
                  How Filters Work
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All filter settings are applied at the stream level before logs reach the dashboard</li>
                  <li>• Filters are saved automatically and persist across browser sessions</li>
                  <li>• Proxy headers are checked in order of priority: CF-Connecting-IP → X-Real-IP → X-Forwarded-For → Custom Headers</li>
                  <li>• Custom conditions support regex patterns for advanced filtering</li>
                  <li>• Bot detection uses common user agent patterns (GoogleBot, BingBot, etc.)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}