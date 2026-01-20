// dashboard/lib/utils/base-url.ts
// Helpers for base domain/base path aware URLs (reverse proxy friendly)

const rawBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ||
  process.env.BASE_PATH ||
  '';

const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/|\/$/g, '')}`
  : '';

const normalizedBaseDomain = (process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.BASE_DOMAIN || '').replace(/\/$/, '');

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Return configured basePath (always starts with "/" or empty string)
 */
export function getBasePath(): string {
  return normalizedBasePath;
}

/**
 * Return configured base domain (no trailing slash), if provided
 */
export function getBaseDomain(): string {
  return normalizedBaseDomain;
}

/**
 * Prefix a path with the configured basePath, if any.
 * Supports paths that already contain query strings.
 */
export function withBasePath(path: string, basePath: string = normalizedBasePath): string {
  const [pathname, search = ''] = normalizePath(path).split('?');

  if (!basePath) {
    return search ? `${pathname}?${search}` : pathname;
  }

  if (pathname.startsWith(`${basePath}/`) || pathname === basePath) {
    return search ? `${pathname}?${search}` : pathname;
  }

  const combined = `${basePath}${pathname}`;
  return search ? `${combined}?${search}` : combined;
}

/**
 * Resolve the origin for absolute URLs. Falls back to window origin on the client.
 */
export function getBaseOrigin(): string {
  if (normalizedBaseDomain) {
    return normalizedBaseDomain;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // When no domain is configured and origin is unavailable (SSR without request),
  // return empty string so callers still get path-only URLs.
  return '';
}

/**
 * Build an absolute (or path-relative) URL that respects base domain and base path.
 */
export function buildUrl(path: string): string {
  const origin = getBaseOrigin();
  const withPath = withBasePath(path);
  return `${origin}${withPath}`;
}
