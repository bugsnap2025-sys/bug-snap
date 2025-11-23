
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
}

const PROXY_PROVIDERS: ProxyProvider[] = [
  {
    name: 'corsproxy.io',
    format: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  },
  {
    name: 'thingproxy',
    format: (url) => `https://thingproxy.freeboard.io/fetch/${url}`
  },
  {
    name: 'cors-anywhere',
    format: (url) => `https://cors-anywhere.herokuapp.com/${url}`
  }
];

export const fetchWithProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let lastError: any;

  for (const provider of PROXY_PROVIDERS) {
    try {
      const proxyUrl = provider.format(url);
      
      const response = await fetch(proxyUrl, {
        ...options,
        headers: {
          ...options.headers,
          // 'x-requested-with' is often required by proxies like cors-anywhere to prevent abuse
          'x-requested-with': 'XMLHttpRequest'
        }
      });
      
      return response;
      
    } catch (err) {
      console.warn(`Proxy ${provider.name} failed:`, err);
      lastError = err;
      // Continue to next proxy
    }
  }

  throw new Error(`Network Error: Unable to connect to ClickUp via any proxy. Please check your internet connection or try disabling ad-blockers. (${lastError?.message || ''})`);
};
