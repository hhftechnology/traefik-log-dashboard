export function normalizeProxyTarget(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `http://${normalized}`;
}

export function proxyAllowlist(): string[] {
  return (process.env.DASHBOARD_PROXY_ALLOWLIST || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedProxyTarget(rawTarget: string): boolean {
  const allowlist = proxyAllowlist();
  if (allowlist.length === 0 || !rawTarget.trim()) {
    return false;
  }

  let target: URL;
  try {
    target = new URL(normalizeProxyTarget(rawTarget));
  } catch {
    return false;
  }

  if (target.username || target.password) {
    return false;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return false;
  }

  const host = target.host.toLowerCase();
  const hostname = target.hostname.toLowerCase();
  return allowlist.some((entry) => {
    if (entry === host || entry === hostname) {
      return true;
    }
    if (!entry.startsWith('http://') && !entry.startsWith('https://')) {
      return false;
    }
    try {
      const allowed = new URL(entry);
      return allowed.protocol === target.protocol && allowed.host === target.host;
    } catch {
      return false;
    }
  });
}
