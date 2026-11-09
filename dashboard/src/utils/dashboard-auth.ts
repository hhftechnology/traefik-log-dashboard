const STORAGE_KEY = 'tld-dashboard-api-token';

export function getDashboardApiToken(): string {
  if (typeof sessionStorage === 'undefined') {
    return '';
  }
  return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? '';
}

export function setDashboardApiToken(token: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  const value = token.trim();
  if (!value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, value);
}

export function dashboardAuthHeaders(): Record<string, string> {
  const token = getDashboardApiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
