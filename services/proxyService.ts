
/**
 * Multi-Proxy Architecture
 * Tries multiple CORS proxies in sequence to bypass browser restrictions.
 * 
 * Proxies used:
 * 1. corsproxy.io (Primary: Fast, supports most headers)
 * 2. cors-anywhere (Backup: Reliable but requires demo activation)
 * 3. allorigins (Backup: Good uptime, using raw mode)
 * 4. thingproxy (Legacy: Frequent rate limits)
 */

interface ProxyProvider {
  name: string;
  format: (url: string) => string;
  requiresHeaders?: boolean;
}

const PROXY_PROVIDERS: ProxyProvider[] = [
  {
    name: 'corsproxy.io',
    format: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    requiresHeaders: false
  },
  {
    name: 'cors-anywhere',
    format: (url) => `https://cors-anywhere.herokuapp.com/${url}`,
    requiresHeaders: true // sets x-requested-with
  },
  {
    name: 'allorigins',
    format: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    requiresHeaders: false
  },
  {
    name: 'thingproxy',
    format: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    requiresHeaders: false
  }
];

export const fetchWithProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
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

          // Prefer Application Errors over Proxy Errors
          if (currentStatus === 429 && newStatus !== 429) {
              failureResponse = response;
          }
          // Prefer 500/400 over 401/403 (Auth) to debug connectivity vs creds
          else if ((currentStatus === 401 || currentStatus === 403) && (newStatus !== 401 && newStatus !== 403 && newStatus !== 429)) {
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
