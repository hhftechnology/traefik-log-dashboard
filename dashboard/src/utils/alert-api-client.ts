import { AlertRule, NotificationHistory, Webhook } from './types/alerting';
import { withBasePath } from './utils/base-url';

const ALERTS_KEY_STORAGE = 'tld-alerts-api-key';

export function getAlertsApiKey(): string {
  if (typeof sessionStorage === 'undefined') {
    return '';
  }
  return sessionStorage.getItem(ALERTS_KEY_STORAGE)?.trim() ?? '';
}

export function setAlertsApiKey(value: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    sessionStorage.removeItem(ALERTS_KEY_STORAGE);
    return;
  }
  sessionStorage.setItem(ALERTS_KEY_STORAGE, trimmed);
}

function alertsAuthHeaders(): Record<string, string> {
  const key = getAlertsApiKey();
  return key ? { 'X-Alerts-Api-Key': key } : {};
}

interface AlertStats {
  total: number;
  last24h: number;
  success: number;
  failed: number;
}

interface RequestOptions extends RequestInit {
  bodyJSON?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...alertsAuthHeaders(),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(withBasePath(path), {
    ...options,
    headers,
    body: options.bodyJSON !== undefined ? JSON.stringify(options.bodyJSON) : options.body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const alertApiClient = {
  listWebhooks(): Promise<Webhook[]> {
    return request<Webhook[]>('/api/dashboard/alerts/webhooks');
  },

  createWebhook(webhook: Partial<Webhook>): Promise<Webhook> {
    return request<Webhook>('/api/dashboard/alerts/webhooks', {
      method: 'POST',
      bodyJSON: webhook,
    });
  },

  updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    return request<Webhook>('/api/dashboard/alerts/webhooks', {
      method: 'PATCH',
      bodyJSON: {
        id,
        ...updates,
      },
    });
  },

  deleteWebhook(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/dashboard/alerts/webhooks?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  testWebhook(id: string): Promise<{ success: boolean; error?: string }> {
    return request<{ success: boolean; error?: string }>('/api/dashboard/alerts/webhooks/test', {
      method: 'POST',
      bodyJSON: { id },
    });
  },

  listAlertRules(): Promise<AlertRule[]> {
    return request<AlertRule[]>('/api/dashboard/alerts/rules');
  },

  createAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
    return request<AlertRule>('/api/dashboard/alerts/rules', {
      method: 'POST',
      bodyJSON: rule,
    });
  },

  updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    return request<AlertRule>('/api/dashboard/alerts/rules', {
      method: 'PATCH',
      bodyJSON: {
        id,
        ...updates,
      },
    });
  },

  deleteAlertRule(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/dashboard/alerts/rules?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  testAlertRule(id: string): Promise<{ success: boolean; error?: string }> {
    return request<{ success: boolean; error?: string }>('/api/dashboard/alerts/rules/test', {
      method: 'POST',
      bodyJSON: { id },
    });
  },

  getStats(): Promise<AlertStats> {
    return request<AlertStats>('/api/dashboard/alerts/stats');
  },

  getHistory(limit: number = 100): Promise<NotificationHistory[]> {
    return request<NotificationHistory[]>(`/api/dashboard/alerts/history?limit=${limit}`);
  },

  runSchedulerCycle(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/dashboard/alerts/run', {
      method: 'POST',
    });
  },
};
