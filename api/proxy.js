// Vercel Serverless Function for Proxy API
// This file should be in /api/proxy.js for Vercel to recognize it
// Vercel uses Node.js 18+ which has built-in fetch

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Atlassian-Token, X-Figma-Token, Accept, User-Agent');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Atlassian-Token, X-Figma-Token, Accept, User-Agent');

  try {
    // Parse body for POST/PUT/PATCH/DELETE requests
    let parsedBody = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Vercel automatically parses JSON, but we need to handle raw body for FormData
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // For FormData, Vercel provides it as a parsed object or we need to handle it differently
        // Since Vercel doesn't parse multipart automatically, we'll get it from the raw body
        parsedBody = req.body;
      } else if (typeof req.body === 'string') {
        try {
          parsedBody = JSON.parse(req.body);
        } catch {
          parsedBody = req.body;
        }
      } else {
        parsedBody = req.body;
      }
    }

    // Get URL from query or body
    let targetUrl = req.query.url || (parsedBody && typeof parsedBody === 'object' ? parsedBody.url : null);
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    // Decode the URL if it's encoded
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Validate URL to prevent SSRF attacks
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Extract and forward headers
    const headers = {};
    const skipHeaders = ['host', 'connection', 'content-length', 'referer', 'origin', 'content-encoding'];
    const headerNameMap = {
      'authorization': 'Authorization',
      'accept': 'Accept',
      'content-type': 'Content-Type',
      'x-atlassian-token': 'X-Atlassian-Token',
      'x-figma-token': 'X-Figma-Token',
      'x-requested-with': 'X-Requested-With',
      'user-agent': 'User-Agent'
    };
    
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey)) {
        const headerName = headerNameMap[lowerKey] || key;
        headers[headerName] = req.headers[key];
      }
    });

    // Ensure Authorization header is forwarded (check all possible cases)
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    } else if (req.headers.Authorization) {
      headers['Authorization'] = req.headers.Authorization;
    }

    // Prepare request options
    const fetchOptions = {
      method: req.method,
      headers: headers
    };

    // Handle body for POST/PUT/PATCH/DELETE
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Check if it's FormData (multipart/form-data)
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // For FormData, we need to reconstruct it or pass the raw body
        // Vercel doesn't parse multipart automatically, so we'll need to handle this
        // For now, we'll try to get the raw body if available
        // Note: Vercel serverless functions may need special handling for FormData
        // If the body is already a Buffer or string, use it directly
        if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
          fetchOptions.body = req.body;
          // Keep the original Content-Type with boundary
          if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
          }
        } else if (parsedBody) {
          // If it's parsed, try to reconstruct FormData (this is a fallback)
          const formData = new FormData();
          Object.keys(parsedBody).forEach(key => {
            if (key !== 'url') {
              formData.append(key, parsedBody[key]);
            }
          });
          fetchOptions.body = formData;
        }
      } else if (parsedBody) {
        // JSON body - extract body data (excluding 'url' which is in query)
        if (typeof parsedBody === 'object') {
          const bodyCopy = { ...parsedBody };
          delete bodyCopy.url; // Remove URL from body if present
          if (Object.keys(bodyCopy).length > 0) {
            fetchOptions.body = JSON.stringify(bodyCopy);
            headers['Content-Type'] = 'application/json';
          }
        } else if (typeof parsedBody === 'string') {
          fetchOptions.body = parsedBody;
        }
      }
    }

    // Make the proxied request
    const response = await fetch(decodedUrl, fetchOptions);
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let body;
    
    if (contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
    } else if (contentType.includes('text/')) {
      body = await response.text();
    } else {
      body = await response.arrayBuffer();
    }

    // Forward response headers
    response.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Send response
    res.status(response.status);
    
    if (body instanceof ArrayBuffer) {
      res.send(Buffer.from(body));
    } else if (typeof body === 'object' && !Buffer.isBuffer(body)) {
      res.json(body);
    } else {
      res.send(body);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
}

