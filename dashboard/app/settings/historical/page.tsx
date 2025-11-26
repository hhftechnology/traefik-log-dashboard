'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

import {
  Database,
  Save,
  Trash2,
  Download,
  ChevronLeft,
  Calendar,
  Clock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { HistoricalConfig } from '@/lib/types/historical';

export default function HistoricalSettingsPage() {
  const [config, setConfig] = useState<HistoricalConfig | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/historical/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error('Failed to load historical data configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/historical/data');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch('/api/historical/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast.success('Configuration saved successfully');
        fetchConfig();
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (_error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Delete old historical data according to retention policy?')) return;

    setCleaning(true);
    try {
      const response = await fetch('/api/historical/data?action=cleanup', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchStats();
      } else {
        toast.error('Failed to cleanup historical data');
      }
    } catch (_error) {
      toast.error('Failed to cleanup historical data');
    } finally {
      setCleaning(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/historical/data?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: {} }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historical-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Historical data exported');
      } else {
        toast.error('Failed to export data');
      }
    } catch (_error) {
      toast.error('Failed to export data');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading || !config) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-white border-b border-red-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/settings">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Database className="w-6 h-6 text-red-600" />
                  Historical Data Storage(Experimantal)
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Configure long-term data retention and archival
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 gap-6">
          {/* Configuration Card */}
          <div className="bg-white border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Configuration</h2>

            {/* Enable Toggle */}
            <div className="mb-6 pb-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="font-medium text-gray-900 flex items-center gap-2">
                {config.enabled ? (
                  <ToggleRight className="w-6 h-6 text-green-500" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-gray-400" />
                )}
                Historical Data Storage
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    {config.enabled
                      ? 'Automatically archiving metrics to separate database'
                      : 'Historical data storage is disabled'}
                  </p>
                </div>
                <Button
                  variant={config.enabled ? 'destructive' : 'default'}
                  onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                >
                  {config.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>

            {/* Retention Days */}
            <div className="mb-4">
              <label className="block font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Retention Period (days)
              </label>
              <input
                type="number"
                min="1"
                max="3650"
                value={config.retention_days}
                onChange={(e) =>
                  setConfig({ ...config, retention_days: parseInt(e.target.value) || 90 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Data older than this will be automatically deleted
              </p>
            </div>

            {/* Archive Interval */}
            <div className="mb-6">
              <label className="block font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Archive Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={config.archive_interval}
                onChange={(e) =>
                  setConfig({ ...config, archive_interval: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                How often to snapshot current metrics (minimum: 1 minute)
              </p>
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full bg-red-600 hover:bg-red-700">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>

          {/* Statistics Card */}
          {stats && (
            <div className="bg-white border-2 border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Storage Statistics</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{stats.total_entries}</div>
                  <div className="text-sm text-gray-600">Total Entries</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatBytes(stats.db_size_bytes)}
                  </div>
                  <div className="text-sm text-gray-600">Database Size</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs font-mono text-gray-900">
                    {stats.oldest_entry
                      ? new Date(stats.oldest_entry).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Oldest Entry</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs font-mono text-gray-900">
                    {stats.newest_entry
                      ? new Date(stats.newest_entry).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Newest Entry</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions Card */}
          <div className="bg-white border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Data Management</h2>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleExport}
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Historical Data (JSON)
              </Button>

              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={cleaning}
                className="w-full justify-start"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {cleaning ? 'Cleaning up...' : 'Cleanup Old Data'}
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Note: Historical data is stored in a separate SQLite database for better performance
              and data management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
