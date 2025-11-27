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
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> => {
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
      throw new Error('Request timeout: The Figma API did not respond in time. Please check your connection and try again.');
    }
    throw error;
  }
};

/**
 * Validates Figma token and file access
 */
export const validateFigmaConnection = async (fileKey: string, token: string): Promise<boolean> => {
  try {
    const url = `https://api.figma.com/v1/files/${fileKey}`;
    
    // Use timeout wrapper to prevent hanging
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'X-Figma-Token': token
      }
    }, 15000); // 15 second timeout

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 403) {
        throw new Error('Figma API returned 403: Invalid token or insufficient permissions. Please check your Personal Access Token.');
      }
      if (response.status === 404) {
        throw new Error('Figma API returned 404: File not found. Please check your File Key.');
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
 */
export const getFigmaFile = async (fileKey: string, token: string): Promise<FigmaNode> => {
  const url = `https://api.figma.com/v1/files/${fileKey}`;
  
  const response = await fetchWithProxy(url, {
    method: 'GET',
    headers: {
      'X-Figma-Token': token
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Figma API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.document;
};

/**
 * Gets all frame nodes from a Figma file (screens/pages)
 */
export const getFigmaFrames = async (fileKey: string, token: string): Promise<FigmaNode[]> => {
  const document = await getFigmaFile(fileKey, token);
  const frames: FigmaNode[] = [];

  const traverse = (node: FigmaNode) => {
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      frames.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(document);
  return frames;
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
