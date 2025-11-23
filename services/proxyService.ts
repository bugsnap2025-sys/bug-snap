
/**
 * Multi-Proxy Architecture
 * Tries multiple CORS proxies in sequence to bypass browser restrictions.
 * 
 * Proxies used:
 * 1. corsproxy.io (Fast, reliable, supports POST)
 * 2. thingproxy (Backup, supports POST)
 * 3. cors-anywhere (Fallback, supports POST, requires activation)
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
    name: 'thingproxy',
    format: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    requiresHeaders: false
  },
  {
    name: 'cors-anywhere',
    format: (url) => `https://cors-anywhere.herokuapp.com/${url}`,
    requiresHeaders: true // Only this one needs the specific header
  }
];

export const fetchWithProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let lastError: any;

  for (const provider of PROXY_PROVIDERS) {
    try {
      const proxyUrl = provider.format(url);
      
      // Prepare headers
      const headers = new Headers(options.headers || {});
      
      // Only add x-requested-with if the specific proxy requires it.
      // Adding it to others (like corsproxy.io) can actually cause Preflight 403 errors.
      if (provider.requiresHeaders) {
        headers.set('x-requested-with', 'XMLHttpRequest');
      }

      const response = await fetch(proxyUrl, {
        ...options,
        headers
      });
      
      if (!response.ok) {
         // If the proxy itself returns an error (not the target API), throw to trigger fallback
         // cors-anywhere returns 403 if not activated
         if (response.status === 403 && provider.name === 'cors-anywhere') {
             const text = await response.text();
             if (text.includes('See /corsdemo')) {
                 throw new Error('corsdemo_required'); 
             }
         }
      }

      return response;
      
    } catch (err) {
      console.warn(`Proxy ${provider.name} failed:`, err);
      lastError = err;
      
      // If we hit the specific cors-anywhere verification error, stop trying other proxies and bubble it up
      // so the UI can show the "Unlock" button.
      if (err instanceof Error && err.message === 'corsdemo_required') {
          throw new Error(`ClickUp API Error: 403 - See /corsdemo for more info`);
      }
    }
  }

  throw new Error(`Network Error: Unable to connect via any proxy. (${lastError?.message || ''})`);
};
