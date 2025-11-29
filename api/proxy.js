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
    // Get URL from query or body
    let targetUrl = req.query.url || (req.body && typeof req.body === 'object' ? req.body.url : null);
    
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
    const skipHeaders = ['host', 'connection', 'content-length', 'referer', 'origin'];
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

    // Ensure Authorization header is forwarded
    if (req.headers.authorization || req.headers.Authorization) {
      headers['Authorization'] = req.headers.authorization || req.headers.Authorization;
    }

    // Prepare request options
    const fetchOptions = {
      method: req.method,
      headers: headers
    };

    // Handle body for POST/PUT/PATCH/DELETE
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        } else if (typeof req.body === 'object') {
          // If body has url property, remove it before sending
          const bodyCopy = { ...req.body };
          delete bodyCopy.url;
          fetchOptions.body = JSON.stringify(bodyCopy);
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    // Make the proxied request
    const response = await fetch(decodedUrl, fetchOptions);
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let body;
    
    if (contentType.includes('application/json')) {
      body = await response.json();
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

