'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Webhook, WebhookType } from '@/lib/types/alerting';

interface WebhookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (webhook: Partial<Webhook>) => Promise<void>;
  webhook?: Webhook | null;
}

export default function WebhookFormModal({
  isOpen,
  onClose,
  onSave,
  webhook,
}: WebhookFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'discord' as WebhookType,
    url: '',
    description: '',
    enabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens or webhook changes
  useEffect(() => {
    if (isOpen) {
      if (webhook) {
        setFormData({
          name: webhook.name,
          type: webhook.type,
          url: webhook.url,
          description: webhook.description || '',
          enabled: webhook.enabled,
        });
      } else {
        setFormData({
          name: '',
          type: 'discord',
          url: '',
          description: '',
          enabled: true,
        });
      }
      setErrors({});
    }
  }, [isOpen, webhook]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Webhook URL is required';
    } else {
      // Validate URL format
      try {
        const url = new URL(formData.url);
        if (formData.type === 'discord') {
          if (!url.hostname.includes('discord.com')) {
            newErrors.url = 'Discord webhook URL must be from discord.com';
          }
        } else if (formData.type === 'telegram') {
          if (!url.hostname.includes('api.telegram.org')) {
            newErrors.url = 'Telegram webhook URL must be from api.telegram.org';
          }
        }
      } catch {
        newErrors.url = 'Invalid URL format';
      }
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
      console.error('Failed to save webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-red-200 dark:border-red-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {webhook ? 'Edit Webhook' : 'Add New Webhook'}
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
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder="e.g., Production Alerts"
              className={`w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground ${
                errors.name ? 'border-red-500 dark:border-red-400' : 'border-red-200 dark:border-red-800'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Type <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="discord"
                  checked={formData.type === 'discord'}
                  onChange={e => handleInputChange('type', e.target.value as WebhookType)}
                  className="mr-2"
                />
                <Badge variant="default">Discord</Badge>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="telegram"
                  checked={formData.type === 'telegram'}
                  onChange={e => handleInputChange('type', e.target.value as WebhookType)}
                  className="mr-2"
                />
                <Badge variant="secondary">Telegram</Badge>
              </label>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Webhook URL <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={e => handleInputChange('url', e.target.value)}
              placeholder={
                formData.type === 'discord'
                  ? 'https://discord.com/api/webhooks/...'
                  : 'https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>'
              }
              className={`w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm bg-card text-foreground ${
                errors.url ? 'border-red-500 dark:border-red-400' : 'border-red-200 dark:border-red-800'
              }`}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.url}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {formData.type === 'discord' ? (
                <>
                  Go to Server Settings → Integrations → Webhooks → New Webhook
                </>
              ) : (
                <>
                  Message @BotFather on Telegram to create a bot and get the token
                </>
              )}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              placeholder="e.g., Sends alerts to #production-alerts channel"
              rows={3}
              className="w-full px-3 py-2 border-2 border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-card text-foreground"
            />
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
              Enable webhook immediately
            </label>
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
              className="flex-1"
            >
              {saving ? 'Saving...' : webhook ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
