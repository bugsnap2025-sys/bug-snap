# BugSnap Backend

Express server for BugSnap - handles CORS proxying and scheduled reporting.

## Features

- **CORS Proxy**: Forwards API requests to ClickUp, Jira, Slack, etc. without browser CORS restrictions
- **Scheduled Reporting**: Automated daily summaries sent to Slack/Teams via cron jobs
- **Report Storage**: Temporary in-memory storage for recent reports (7-day retention)

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
Create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Start Server
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### CORS Proxy
**POST** `/api/proxy`

Forwards requests to external APIs.

**Request Body:**
```json
{
  "url": "https://api.clickup.com/api/v2/user",
  "method": "GET",
  "headers": {
    "Authorization": "your-token"
  },
  "body": {}
}
```

### Reports

**POST** `/api/reports`
Store a new bug report

**GET** `/api/reports`
Get recent reports

**GET** `/api/reports/schedule`
Get scheduled reporting configuration

**POST** `/api/reports/schedule`
Update scheduled reporting configuration

**POST** `/api/reports/test`
Send a test report immediately

## Deployment

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard

### Railway
1. Connect your GitHub repo
2. Set root directory to `/server`
3. Add environment variables

### Render
1. Create new Web Service
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables

## Environment Variables

- `PORT`: Server port (default: 5000)
- `FRONTEND_URL`: Your frontend URL for CORS
- `NODE_ENV`: development | production
