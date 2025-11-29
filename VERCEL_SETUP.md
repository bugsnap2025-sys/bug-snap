# Vercel Deployment Setup Guide

## Proxy Configuration for Production

Your app uses a proxy server to handle CORS issues when calling external APIs. Here's how to set it up on Vercel:

### Option 1: Use Vercel Serverless Function (Recommended)

The proxy is already set up as a Vercel serverless function at `/api/proxy.js`. This will automatically work when you deploy to Vercel.

**No additional configuration needed!** The app will automatically detect your Vercel domain and use `/api/proxy` as the backend proxy URL.

### Option 2: Use Separate Backend Server

If you prefer to run a separate backend server:

1. Deploy `server.js` to a hosting service (Railway, Render, Heroku, etc.)
2. Set the `VITE_PROXY_URL` environment variable in Vercel:
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add: `VITE_PROXY_URL` = `https://your-backend-server.com/api/proxy`

### Environment Variables in Vercel

Make sure to set these in your Vercel project:

1. **VITE_PROXY_URL** (Optional): Only needed if using Option 2 above
2. **GEMINI_API_KEY**: Your Gemini API key for AI features
3. Any other API keys your app needs

### How It Works

1. The app first tries **direct API calls** (if CORS allows)
2. If CORS blocks, it uses your **backend proxy** (Vercel serverless function or custom server)
3. Only if backend is unavailable, it falls back to **public proxies** (corsproxy.io, codetabs, etc.)

**Note:** The problematic `cors-anywhere` proxy (which requires activation) has been removed from the fallback list.

### Testing Locally

For local development, run:
```bash
npm run server  # Starts backend proxy on localhost:3001
npm run dev     # Starts frontend on localhost:3000
```

Or use:
```bash
npm run dev:all  # Runs both simultaneously
```

### Troubleshooting

If you see "Backend proxy unavailable" errors:

1. **Check Vercel deployment**: Make sure `/api/proxy.js` is deployed correctly
2. **Check logs**: Look at Vercel function logs for errors
3. **Verify CORS**: Make sure your backend allows requests from your Vercel domain
4. **Environment variables**: Ensure `VITE_PROXY_URL` is set if using a custom backend

The app will automatically use your Vercel domain's `/api/proxy` endpoint, so no manual configuration is needed!

