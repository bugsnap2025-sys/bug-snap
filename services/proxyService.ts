
/**
 * Multi-Proxy Architecture
 * Tries multiple CORS proxies in sequence to bypass browser restrictions.
 * 
 * Proxies used:
 * 1. cors-anywhere (Primary: Supports headers best, requires activation)
 * 2. corsproxy.io (Backup: Fast)
 * 3. codetabs (Fallback)
 * 4. allorigins (Fallback: Raw mode)
 */

interface ProxyProvider {
  name: string;
  format: (url: string) => string;
  requiresHeaders?: boolean;
}

const PROXY_PROVIDERS: ProxyProvider[] = [
  {
    name: 'cors-anywhere',
    format: (url) => `https://cors-anywhere.herokuapp.com/${url}`,
    requiresHeaders: true // sets x-requested-with
  },
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
    format: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    requiresHeaders: false
  }
];

export const fetchWithProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let lastError: any;
  let failureResponse: Response | null = null;

  for (const provider of PROXY_PROVIDERS) {
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

      // If we get here, it's a non-200 response (e.g. 401, 500). 
      // It COULD be the API rejecting a valid request, OR the proxy malfunctioning/stripping headers.
      // We save this response as a candidate for the final result, but we CONTINUE to the next proxy to be safe.
      // However, if it's a 401/403, it's likely the API responding, so we could potentially stop, but 
      // some proxies strip headers causing 401s, so it's safer to try others.
      if (!failureResponse || (response.status !== 401 && response.status !== 403)) {
          failureResponse = response;
      }
      
      console.warn(`Proxy ${provider.name} returned status ${response.status}. Trying next provider...`);
      
    } catch (err: any) {
      console.warn(`Proxy ${provider.name} failed:`, err);
      
      // If it's the specific lock error, stop trying and throw immediately to prompt user
      if (err.message === 'corsdemo_required') {
          throw new Error(`corsdemo_required`);
      }
      
      lastError = err;
    }
  }

  // If we exhausted all proxies and have a failure response (e.g. 401 from the last proxy), return it.
  if (failureResponse) {
      return failureResponse;
  }

  throw new Error(`Network Error: Unable to connect via any proxy. Please check your connection.`);
};
