import { fetchWithProxy } from './proxyService';

export interface FigmaFile {
  key: string;
  name: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

export interface FigmaImageResponse {
  images: Record<string, string>;
  error?: boolean;
}

/**
 * Adds a timeout to a fetch request using AbortController
 * Increased timeout to 30 seconds to allow for multiple proxy attempts
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchWithProxy(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('Request timeout: The Figma API did not respond in time. Please check your connection and try again. Make sure your backend proxy server is running (npm run server) or check your internet connection.');
    }
    throw error;
  }
};

/**
 * Validates Figma token and file access
 * Uses query parameters to minimize response size and avoid "Request too large" errors
 */
export const validateFigmaConnection = async (fileKey: string, token: string): Promise<boolean> => {
  try {
    // Use depth=1 query parameter to reduce response size significantly
    // This limits the response to top-level nodes only, preventing "Request too large" errors
    // For validation, we only need to verify the file exists and is accessible
    const url = `https://api.figma.com/v1/files/${fileKey}?depth=1`;
    
    // Use timeout wrapper to prevent hanging
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'X-Figma-Token': token
      }
    }, 30000); // 30 second timeout to allow for proxy fallbacks

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 403) {
        throw new Error('Figma API returned 403: Invalid token or insufficient permissions. Please check your Personal Access Token.');
      }
      if (response.status === 404) {
        throw new Error('Figma API returned 404: File not found. Please check your File Key.');
      }
      if (response.status === 400 && errorText.includes('too large')) {
        throw new Error('Figma file is too large. Please try using a Node ID to filter to a specific frame, or contact support if this persists.');
      }
      throw new Error(`Figma API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return !!data.document;
  } catch (error) {
    console.error('Figma validation error:', error);
    // Re-throw with a more user-friendly message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to Figma API. Please check your internet connection and try again.');
  }
};

/**
 * Extracts Figma file key from URL
 * Supports multiple Figma URL formats:
 * - https://www.figma.com/file/KEY/name
 * - https://www.figma.com/design/KEY/name
 * - https://figma.com/file/KEY/name
 * - Just the key itself
 */
export const extractFigmaFileKey = (urlOrKey: string): string | null => {
  if (!urlOrKey) return null;
  
  const trimmed = urlOrKey.trim();
  
  // If it's already just a key (alphanumeric, no special chars), return it
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try to extract from /file/ URL format
  // Example: https://www.figma.com/file/KEY/name
  let match = trimmed.match(/figma\.com\/file\/([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  
  // Try to extract from /design/ URL format (newer format)
  // Example: https://www.figma.com/design/KEY/name?node-id=...
  match = trimmed.match(/figma\.com\/design\/([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
};

/**
 * Fetches a Figma file's structure
 * Uses depth parameter to limit response size and avoid "Request too large" errors
 */
export const getFigmaFile = async (fileKey: string, token: string, maxDepth: number = 10): Promise<FigmaNode> => {
  // Use depth parameter to limit the tree depth, reducing response size
  // Default depth of 10 should be enough to find most frames while keeping response manageable
  const url = `https://api.figma.com/v1/files/${fileKey}?depth=${maxDepth}`;
  
  const response = await fetchWithProxy(url, {
    method: 'GET',
    headers: {
      'X-Figma-Token': token
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 && errorText.includes('too large')) {
      throw new Error('Figma file is too large. Please use a Node ID to filter to a specific frame in your Figma integration settings.');
    }
    throw new Error(`Figma API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.document;
};

/**
 * Gets all frame nodes from a Figma file (screens/pages)
 * Handles large files by trying progressively smaller depths
 */
export const getFigmaFrames = async (fileKey: string, token: string): Promise<FigmaNode[]> => {
  // Try with different depths if the file is too large
  const depths = [10, 5, 3, 1];
  let lastError: Error | null = null;
  let lastFrames: FigmaNode[] = [];

  for (const depth of depths) {
    try {
      const document = await getFigmaFile(fileKey, token, depth);
      const frames: FigmaNode[] = [];

      const traverse = (node: FigmaNode) => {
        try {
          if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            frames.push(node);
          }
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(traverse);
          }
        } catch (e) {
          // Skip nodes that cause traversal errors
          console.warn('Error traversing node:', e);
        }
      };

      traverse(document);
      lastFrames = frames;
      
      // If we found frames, return them immediately
      if (frames.length > 0) {
        return frames;
      }
      
      // If no frames found at this depth, try smaller depth
      if (depth > 1) {
        continue;
      }
      
      // If we're at depth 1 and no frames, return empty array (file might not have frames)
      return frames;
    } catch (error: any) {
      lastError = error;
      // If it's a "too large" error and we have more depths to try, continue
      if (error.message?.includes('too large') && depth > 1) {
        continue;
      }
      // If it's a network/connection error, re-throw immediately
      if (error.message?.includes('timeout') || error.message?.includes('Failed to fetch') || error.message?.includes('Network')) {
        throw error;
      }
      // For other errors, try next depth
      if (depth > 1) {
        continue;
      }
      // If we're at the last depth, throw the error
      throw error;
    }
  }

  // If we exhausted all depths but got some frames, return them
  if (lastFrames.length > 0) {
    return lastFrames;
  }

  // If we exhausted all depths, throw the last error or return empty array
  if (lastError) {
    throw lastError;
  }
  
  return [];
};

/**
 * Gets an image render of a Figma node
 */
export const getFigmaImage = async (
  fileKey: string,
  nodeId: string,
  token: string,
  scale: number = 2
): Promise<string> => {
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=${scale}`;
  
  const response = await fetchWithProxy(url, {
    method: 'GET',
    headers: {
      'X-Figma-Token': token
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Figma Image API Error: ${response.status} - ${errorText}`);
  }

  const data: FigmaImageResponse = await response.json();
  
  if (data.error) {
    throw new Error('Figma API returned an error');
  }

  const imageUrl = data.images[nodeId];
  if (!imageUrl) {
    throw new Error('No image URL returned for the specified node');
  }

  return imageUrl;
};

/**
 * Downloads a Figma image and converts it to a data URL
 */
export const downloadFigmaImageAsDataUrl = async (imageUrl: string): Promise<string> => {
  try {
    // Try direct fetch first
    const response = await fetch(imageUrl);
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    // Fallback to proxy
  }

  // Use proxy as fallback
  const response = await fetchWithProxy(imageUrl, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Failed to download Figma image: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
