// middleware.ts - Security and validation middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Support deployments behind a reverse proxy/subpath
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '';
const BASE_PATH = rawBasePath ? `/${rawBasePath.replace(/^\/|\/$/g, '')}` : '';

// SECURITY: Malicious patterns to block
const MALICIOUS_PATTERNS = [
  /\/bin\/bash/i,
  /\/bin\/sh/i,
  /\/dev\/tcp/i,
  /base64\s+-d/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /shell_exec/i,
  /cmd\.exe/i,
  /powershell/i,
  /<script/i,
  /javascript:/i,
  /onclick=/i,
  /onerror=/i,
  /\${/,  // Template injection
  /\$\(/,  // Command substitution
];

// SECURITY: Suspicious Server Action patterns
const SUSPICIOUS_ACTION_PATTERNS = [
  /X1N0YW5kYXJk/,  // Base64 encoded malicious payloads
  /child_process/i,
  /execSync/i,
  /W10=/,  // Common base64 prefix in attacks
];

// SECURITY: Rate limiting map (simple in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000); // default: 1 minute
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 1000); // Max requests per window (raised to reduce false 429s)

/**
 * Check if request contains malicious patterns
 */
function containsMaliciousContent(content: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Check if Server Action ID is suspicious
 */
function isSuspiciousServerAction(actionId: string): boolean {
  return SUSPICIOUS_ACTION_PATTERNS.some(pattern => pattern.test(actionId));
}

/**
 * Simple rate limiting
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return false;
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  limit.count++;
  return false;
}

/**
 * Extract client IP from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Internal API routes that should have relaxed rate limiting
const INTERNAL_API_ROUTES = [
  '/api/logs/',
  '/api/agents/',
  '/api/system/',
  '/api/services/',
  '/api/alerts/',
  '/api/historical/',
  '/api/location/',
];

// Health check routes should never trigger aggressive rate limiting
const HEALTH_CHECK_PATHS = ['/health', '/api/health', '/status', '/up', '/api/logs/status'];

function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname;
}

function isInternalApiRoute(pathname: string): boolean {
  return INTERNAL_API_ROUTES.some(route => pathname.startsWith(route));
}

function isHealthCheck(pathname: string): boolean {
  return HEALTH_CHECK_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const pathWithoutBase = stripBasePath(pathname);

  // Respect demo toggle: block demo route when disabled
  const showDemoPage = (process.env.NEXT_PUBLIC_SHOW_DEMO_PAGE ?? process.env.SHOW_DEMO_PAGE ?? 'true') !== 'false';
  if (!showDemoPage && pathWithoutBase.startsWith('/dashboard/demo')) {
    const target = `${BASE_PATH || ''}/dashboard`.replace(/\/+/g, '/');
    return NextResponse.redirect(new URL(target, request.url));
  }

  // SECURITY: Get client IP for rate limiting
  const clientIP = getClientIP(request);

  // SECURITY: Skip rate limiting for internal dashboard API routes
  // These are legitimate dashboard requests and should not be rate limited aggressively
  if (
    request.method !== 'OPTIONS' &&
    request.method !== 'HEAD' &&
    !isInternalApiRoute(pathWithoutBase) &&
    !isHealthCheck(pathWithoutBase) &&
    isRateLimited(clientIP)
  ) {
    console.warn(`[Security] Rate limit exceeded for IP: ${clientIP}`);
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
      },
    });
  }

  // SECURITY: Block malicious Server Actions
  const nextAction = request.headers.get('next-action');
  if (nextAction && isSuspiciousServerAction(nextAction)) {
    console.error(`[Security] Blocked suspicious Server Action from ${clientIP}:`, {
      action: nextAction,
      path: pathWithoutBase,
    });
    return new NextResponse('Forbidden', { status: 403 });
  }

  // SECURITY: Validate URL and search params for malicious content
  const fullUrl = request.url;
  if (containsMaliciousContent(fullUrl)) {
    console.error(`[Security] Blocked malicious URL from ${clientIP}:`, pathWithoutBase);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // SECURITY: Check all query parameters
  for (const [key, value] of searchParams.entries()) {
    if (containsMaliciousContent(value)) {
      console.error(`[Security] Blocked malicious query param from ${clientIP}:`, {
        param: key,
        value: value.substring(0, 100), // Log only first 100 chars
      });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // SECURITY: Validate POST/PUT request bodies
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    try {
      // Clone request to read body without consuming it
      const clonedRequest = request.clone();
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const body = await clonedRequest.text();

        // Check body for malicious content
        if (containsMaliciousContent(body)) {
          console.error(`[Security] Blocked malicious request body from ${clientIP}:`, {
            path: pathWithoutBase,
            bodyPreview: body.substring(0, 200),
          });
          return new NextResponse('Forbidden', { status: 403 });
        }
      }
    } catch (error) {
      // If body parsing fails, log but allow request to continue
      // The actual route handler will deal with invalid JSON
      console.warn(`[Security] Failed to parse request body for validation:`, error);
    }
  }

  // SECURITY: Add security headers to response
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (adjust as needed)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http: https:;"
  );

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
