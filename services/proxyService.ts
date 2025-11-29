
/**
 * Multi-Proxy Architecture
 * Tries multiple CORS proxies in sequence to bypass browser restrictions.
 * 
 * Proxies used:
 * 1. corsproxy.io (Primary: Fast, supports most headers, supports POST)
 * 2. cors-anywhere (Backup: Reliable but requires demo activation, supports POST)
 * 3. codetabs (Backup: Good uptime, supports POST)
 * 4. allorigins (Backup: GET ONLY. Good for reading data, fails on POST)
 * 5. thingproxy (Legacy: Frequent rate limits)
 */

// Get backend proxy URL from environment variable
// In production, this should be set to your backend server URL (e.g., your Vercel serverless function or separate backend)
// For Vercel, you can create a serverless function at /api/proxy or deploy server.js separately
const getBackendProxyUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_PROXY_URL;
  if (envUrl) return envUrl;
  
  // Auto-detect if we're in production and try to use same origin API route
  // This works if you deploy the proxy as a Vercel serverless function at /api/proxy
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Only use same-origin if we're not on localhost (production)
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return `${origin}/api/proxy`;
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:3001/api/proxy';
};

const BACKEND_PROXY_URL = getBackendProxyUrl();

// Fallback proxies (only used if backend is unavailable)
interface ProxyProvider {
  name: string;
  format: (url: string) => string;
  requiresHeaders?: boolean;
  methods?: string[]; // If undefined, supports all. If defined, only supports listed.
}

// Fallback proxies (only used if backend is unavailable)
// NOTE: cors-anywhere removed as it requires manual activation
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
    name: 'allorigins',
    format: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`, // Timestamp prevents caching
    requiresHeaders: false,
    methods: ['GET', 'HEAD'] // allorigins does not support POST bodies correctly
  },
  {
    name: 'thingproxy',
    format: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    requiresHeaders: false
  }
];

// Alias for consistency
const PROXY_PROVIDERS = FALLBACK_PROXY_PROVIDERS;

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
 * Uses a shorter timeout to fail fast if backend is not running
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

  // Add a shorter timeout for backend proxy check (5 seconds)
  // This prevents hanging when backend server is not running
  const backendTimeoutMs = 5000;
  const backendController = new AbortController();
  const backendTimeoutId = setTimeout(() => {
    backendController.abort();
  }, backendTimeoutMs);

  // If there's an existing signal, check if it's already aborted
  if (options.signal?.aborted) {
    clearTimeout(backendTimeoutId);
    const abortError = new Error('Request was aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  // Listen to the original signal and abort backend controller if it aborts
  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      clearTimeout(backendTimeoutId);
      backendController.abort();
    });
  }

  try {
    const response = await fetch(proxyUrl, {
      ...proxyRequest,
      signal: backendController.signal
    });
    
    clearTimeout(backendTimeoutId);
    
    // If backend proxy is working, return the response
    if (response.ok || response.status < 500) {
      return response;
    }

    // If backend is down (5xx), throw to trigger fallback
    if (response.status >= 500) {
      throw new Error('Backend proxy unavailable');
    }

    return response;
  } catch (error: any) {
    clearTimeout(backendTimeoutId);
    // If backend timeout occurred, throw a specific error to trigger fallback
    if (error.name === 'AbortError' && backendController.signal.aborted) {
      // Check if it was the original signal that aborted
      if (options.signal?.aborted) {
        throw error; // Re-throw the original abort error
      }
      throw new Error('Backend proxy unavailable');
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Fetches using fallback public proxies
 */
const fetchWithFallbackProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let failureResponse: Response | null = null;
  const method = options.method || 'GET';

  for (const provider of PROXY_PROVIDERS) {
    // Skip if provider doesn't support the method (e.g. POST to allorigins)
    if (provider.methods && !provider.methods.includes(method)) {
        continue;
    }

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
        headers
      });
      
      // If success, return immediately
      if (response.ok) {
        return response;
      }

      // Handle specific Cors-Anywhere lock (Status 403 with specific body)
      if (response.status === 403 && provider.name === 'cors-anywhere') {
         const text = await response.clone().text();
         if (text.includes('See /corsdemo')) {
             throw new Error('corsdemo_required'); 
         }
      }

      // Smart Failure Selection:
      // We want to return the most "useful" error response if all proxies fail.
      
      if (!failureResponse) {
          failureResponse = response;
      } else {
          const currentStatus = failureResponse.status;
          const newStatus = response.status;

          // Prefer Application Errors (400, 401, 404, 500) over Proxy Errors (429, 503)
          // If the current saved response is a Rate Limit (429), and we have a new one that isn't, take the new one.
          if (currentStatus === 429 && newStatus !== 429) {
              failureResponse = response;
          }
          // Prefer Auth errors (401/403) as they usually mean we reached the destination
          else if ((currentStatus !== 401 && currentStatus !== 403) && (newStatus === 401 || newStatus === 403)) {
              failureResponse = response;
          }
      }
      
      // console.warn(`Proxy ${provider.name} returned status ${response.status}. Trying next...`);
      
    } catch (err: any) {
      // console.warn(`Proxy ${provider.name} failed:`, err);
      
      // If it's the specific lock error, stop trying and throw immediately to prompt user
      if (err.message === 'corsdemo_required') {
          throw new Error(`corsdemo_required`);
      }
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
      console.warn(`Backend proxy unavailable at ${BACKEND_PROXY_URL}, using public fallback proxies...`);
      console.warn('To fix this in production, set VITE_PROXY_URL environment variable to your backend server URL');
      return await fetchWithFallbackProxy(url, options);
    }
    // Re-throw other errors (like network errors)
    throw error;
  }
};
