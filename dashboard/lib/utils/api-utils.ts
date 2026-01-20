/**
 * API utility functions
 * Standardized AbortController pattern for fetch requests
 */

/**
 * Fetch with automatic abort controller cleanup
 * Wraps fetch with AbortController and timeout handling
 * 
 * @param url - URL to fetch
 * @param options - Fetch options (signal will be merged)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise that resolves to response
 */
export async function fetchWithAbort(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    
    throw error;
  }
}

/**
 * Fetch JSON with automatic abort controller cleanup
 * Convenience wrapper for JSON responses
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise that resolves to parsed JSON
 */
export async function fetchJSONWithAbort<T = unknown>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<T> {
  const response = await fetchWithAbort(url, options, timeoutMs);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

