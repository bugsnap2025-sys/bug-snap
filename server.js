import express from 'express';
import cors from 'cors';
import multer from 'multer';
import FormData from 'form-data';

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer();

// Configure CORS to allow requests from your frontend
// In production, allow requests from any origin (or specify your Vercel domain)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests) or from allowed origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Atlassian-Token', 'X-Figma-Token', 'Accept', 'User-Agent'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware for JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'BugSnap Proxy Server is running' });
});

// Universal proxy endpoint
app.all('/api/proxy', upload.any(), async (req, res) => {
  try {
    // Get URL from query or body
    let targetUrl = req.query.url || req.body?.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    // Decode the URL if it's encoded
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Validate URL to prevent SSRF attacks
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Extract and forward headers from request
    // Express lowercases header names, so we need to handle that
    const headers = {};
    
    // Headers to skip (don't forward these)
    const skipHeaders = ['host', 'connection', 'content-length', 'referer', 'origin'];
    
    // Header name mapping (Express lowercases, but APIs expect proper casing)
    const headerNameMap = {
      'authorization': 'Authorization',
      'accept': 'Accept',
      'content-type': 'Content-Type',
      'x-atlassian-token': 'X-Atlassian-Token',
      'x-requested-with': 'X-Requested-With',
      'user-agent': 'User-Agent'
    };
    
    // Copy all headers except the ones we want to skip
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey)) {
        // Use proper casing if we have a mapping, otherwise use original key
        const headerName = headerNameMap[lowerKey] || key;
        headers[headerName] = req.headers[key];
      }
    });
    
    // CRITICAL: Ensure Authorization header is definitely forwarded
    // Check all possible cases (Express lowercases headers)
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    } else if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    } else if (req.headers.Authorization) {
      headers['Authorization'] = req.headers.Authorization;
    }
    
    // Debug: Log headers for troubleshooting (remove in production)
    console.log('📤 Forwarding request to:', decodedUrl);
    console.log('📥 Received headers from client:', Object.keys(req.headers));
    console.log('🔑 Authorization in req.headers:', !!req.headers.authorization);
    console.log('🔑 Authorization value:', req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'MISSING');
    console.log('📤 Forwarding headers:', Object.keys(headers));
    console.log('🔑 Authorization in forwarding headers:', !!headers['Authorization']);
    
    // Forward the request
    const method = req.method;
    const fetchOptions = {
      method: method,
      headers: headers,
    };

    // Handle body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      // Check if it's FormData (multipart/form-data)
      if (req.headers['content-type']?.includes('multipart/form-data') || req.files || req.body?.attachment) {
        const formData = new FormData();
        
        // Add files from multer
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(file => {
            formData.append(file.fieldname || 'attachment', file.buffer, {
              filename: file.originalname,
              contentType: file.mimetype
            });
          });
        }
        
        // Add other form fields
        if (req.body) {
          Object.keys(req.body).forEach(key => {
            if (key !== 'url' && key !== 'attachment') {
              formData.append(key, req.body[key]);
            }
          });
        }
        
        fetchOptions.body = formData;
        // Use form-data's headers (includes Content-Type with boundary)
        const formHeaders = formData.getHeaders();
        Object.keys(formHeaders).forEach(key => {
          headers[key] = formHeaders[key];
        });
      } else if (req.body && Object.keys(req.body).length > 0) {
        // JSON body - extract body data (excluding 'url' which is in query)
        const bodyData = { ...req.body };
        delete bodyData.url; // Remove URL from body if present
        
        if (Object.keys(bodyData).length > 0) {
          fetchOptions.body = JSON.stringify(bodyData);
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    // Log the final request being sent to the API
    console.log('🚀 Sending to API:', {
      url: decodedUrl,
      method: method,
      hasAuth: !!headers['Authorization'],
      authPreview: headers['Authorization'] ? headers['Authorization'].substring(0, 20) + '...' : 'NONE',
      allHeaderKeys: Object.keys(headers)
    });
    
    const response = await fetch(decodedUrl, fetchOptions);
    
    console.log('📥 API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: decodedUrl
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = await response.text();
      }
    } else if (contentType.includes('multipart') || contentType.includes('image') || contentType.includes('application/octet-stream')) {
      responseData = await response.arrayBuffer();
    } else {
      responseData = await response.text();
    }

    // Forward response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Send response
    res.status(response.status);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (responseData instanceof ArrayBuffer) {
      res.send(Buffer.from(responseData));
    } else if (typeof responseData === 'object') {
      res.json(responseData);
    } else {
      res.send(responseData);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 BugSnap Proxy Server running on http://localhost:${PORT}`);
  console.log(`✅ CORS enabled for: http://localhost:3000`);
});

