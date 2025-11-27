/**
 * Smart Proxy Service
 * Tries direct API calls first (if CORS allows), then falls back to proxies.
 * 
 * Strategy:
 * 1. Try DIRECT API call (fastest if CORS allows) 
 * 2. If CORS blocks → Use BACKEND PROXY (our server with CORS configured)
 * 3. If backend down → Use PUBLIC PROXIES (fallback)
 */

const BACKEND_PROXY_URL = (import.meta as any).env?.VITE_PROXY_URL || 'http://localhost:3001/api/proxy';

// Fallback proxies (only used if backend is unavailable)
interface ProxyProvider {
  name: string;
  format: (url: string) => string;
  requiresHeaders?: boolean;
}

const FALLBACK_PROXY_PROVIDERS: ProxyProvider[] = [
  {
    name: 'corsproxy.io',
    format: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    requiresHeaders: false
  },
  {
    name: 'codetabs',
    format: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    requiresHeaders: false
  },
  {
    name: 'thingproxy',
    format: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    requiresHeaders: false
  }
];

/**
 * Tries direct API call first (if CORS allows it)
 */
const fetchDirect = async (url: string, options: RequestInit = {}): Promise<Response> => {
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal
    });
    // If we get a response (even if error status), CORS worked!
    return response;
  } catch (error: any) {
    // CORS blocked or network error - check if it's a CORS error
    if (error.name === 'AbortError') {
      throw error; // Re-throw abort errors as-is
    }
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('CORS_BLOCKED');
    }
    throw error;
  }
};

/**
 * Fetches using our backend proxy (primary method)
 */
const fetchWithBackendProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const isFormData = options.body instanceof FormData;
  
  // Convert headers to plain object
  const headers: Record<string, string> = {};
  if (options.headers) {
    const headersObj = options.headers instanceof Headers 
      ? Object.fromEntries(options.headers.entries())
      : options.headers;
    
    Object.entries(headersObj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Build request to backend proxy
  let proxyRequest: RequestInit;
  let proxyUrl: string;
  const method = (options.method || 'GET').toUpperCase();

  if (isFormData) {
    // For FormData: append URL as query param and send FormData as-is
    proxyUrl = `${BACKEND_PROXY_URL}?url=${encodeURIComponent(url)}`;
    proxyRequest = {
      method: method,
      headers: headers, // Keep auth headers, but don't set Content-Type (browser will set it with boundary)
      body: options.body as FormData
    };
  } else if (method === 'GET' || method === 'HEAD') {
    // For GET/HEAD: send URL as query parameter, no body allowed
    proxyUrl = `${BACKEND_PROXY_URL}?url=${encodeURIComponent(url)}`;
    proxyRequest = {
      method: method,
      headers: headers
      // No body for GET/HEAD requests
    };
  } else {
    // For POST/PUT/PATCH/DELETE: send URL and body in request body
    proxyUrl = BACKEND_PROXY_URL;
    let bodyData: any = {};
    
    if (options.body) {
      if (typeof options.body === 'string') {
        try {
          bodyData = JSON.parse(options.body);
        } catch {
          bodyData = { body: options.body };
        }
      } else {
        bodyData = options.body;
      }
    }
    
    proxyRequest = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ url, ...bodyData })
    };
  }

  const response = await fetch(proxyUrl, {
    ...proxyRequest,
    signal: options.signal
  });
  
  // If backend proxy is working, return the response
  if (response.ok || response.status < 500) {
    return response;
  }

  // If backend is down (5xx), throw to trigger fallback
  if (response.status >= 500) {
    throw new Error('Backend proxy unavailable');
  }

  return response;
};

/**
 * Fetches using fallback public proxies
 */
const fetchWithFallbackProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let failureResponse: Response | null = null;

  for (const provider of FALLBACK_PROXY_PROVIDERS) {
    try {
      const proxyUrl = provider.format(url);
      
      // Prepare headers
      const headers = new Headers(options.headers || {});
      
      // Only add x-requested-with if the specific proxy requires it.
      if (provider.requiresHeaders) {
        headers.set('x-requested-with', 'XMLHttpRequest');
      }

      const response = await fetch(proxyUrl, {
        ...options,
        headers,
        signal: options.signal
      });
      
      // If success, return immediately
      if (response.ok) {
        return response;
      }

      // Smart Failure Selection:
      // We want to return the most "useful" error response if all proxies fail.
      // Priority: 
      // 1. Application Errors (500, 400, 404) - Means we reached the API.
      // 2. Auth Errors (401, 403) - Means we reached the API but were denied.
      // 3. Proxy Errors (429) - Least useful, means proxy blocked us.
      
      if (!failureResponse) {
          failureResponse = response;
      } else {
          const currentStatus = failureResponse.status;
          const newStatus = response.status;

          // Always upgrade away from 429 (Rate Limit) if the new one isn't 429
          if (currentStatus === 429 && newStatus !== 429) {
              failureResponse = response;
          }
          // Upgrade away from 401/403 (Auth) to a "Real" error (like 500 or 400) if available
          // This prevents false "Invalid Token" errors if a proxy stripped headers
          else if ((currentStatus === 401 || currentStatus === 403) && (newStatus !== 401 && newStatus !== 403 && newStatus !== 429)) {
              failureResponse = response;
          }
      }
      
      console.warn(`Fallback proxy ${provider.name} returned status ${response.status}. Trying next...`);
      
    } catch (err: any) {
      console.warn(`Fallback proxy ${provider.name} failed:`, err);
    }
  }

  // If we exhausted all proxies and have a failure response return it.
  if (failureResponse) {
      return failureResponse;
  }

  throw new Error(`Network Error: Unable to connect via any proxy. Please check your connection.`);
};

/**
 * Main proxy function: Tries direct call first, then backend proxy, then public proxies
 */
export const fetchWithProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Step 1: Try direct API call first (best case - no proxy needed!)
  try {
    const directResponse = await fetchDirect(url, options);
    // If we got here, CORS allowed the request! Return it.
    console.log('✅ Direct API call succeeded (CORS allowed)');
    return directResponse;
  } catch (error: any) {
    // CORS blocked the direct call - we need a proxy
    if (error.message === 'CORS_BLOCKED') {
      console.log('⚠️ Direct call blocked by CORS, using proxy...');
    } else {
      // Some other error, re-throw it
      throw error;
    }
  }

  // Step 2: Try backend proxy (our controlled server with CORS configured)
  try {
    return await fetchWithBackendProxy(url, options);
  } catch (error: any) {
    // If backend is unavailable, log and try fallback
    if (error.message === 'Backend proxy unavailable' || error.message.includes('Failed to fetch')) {
      console.warn('Backend proxy unavailable, using public fallback proxies...');
      return await fetchWithFallbackProxy(url, options);
    }
    // Re-throw other errors (like network errors)
    throw error;
  }
};
