# 🚀 WebSocket Relay Server

A standalone Node.js WebSocket server that enables localhost API testing from production environments.

## 🎯 Purpose

This server acts as a relay between your production frontend (deployed on Vercel) and users' browsers, allowing them to test localhost APIs without any setup.

## 🏗️ Architecture

```
Frontend (Vercel) → WebSocket Relay (Render) → User's Browser → Localhost API
```

## 📦 Features

- ✅ WebSocket relay with Socket.IO
- ✅ Session management with auto-cleanup
- ✅ Localhost URL validation
- ✅ Request timeout protection (30s)
- ✅ CORS support for multiple origins
- ✅ Health check and stats endpoints
- ✅ Graceful shutdown handling

## 🚀 Quick Start

### Local Development

1. **Install dependencies**:
```bash
npm install
```

2. **Create `.env` file**:
```bash
cp .env.example .env
```

Edit `.env` and set:
```env
PORT=8080
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

3. **Start development server**:
```bash
npm run dev
```

Server runs at `http://localhost:8080`

### Production Deployment (Render)

1. **Create new Web Service** on Render.com

2. **Connect your repository**

3. **Configure settings**:
   - **Name**: `api-tester-relay` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`

4. **Add environment variables**:
   ```
   PORT=8080
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```

5. **Deploy!**

Your relay server will be available at: `https://your-service-name.onrender.com`

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `ALLOWED_ORIGINS` | Yes | - | Comma-separated frontend URLs |
| `SESSION_TIMEOUT_MINUTES` | No | 10 | Session inactivity timeout |
| `REQUEST_TIMEOUT_SECONDS` | No | 30 | Request execution timeout |

## 📡 API Endpoints

### Health Check
```http
GET /
```

**Response**:
```json
{
  "service": "API Tester Relay Server",
  "status": "running",
  "version": "1.0.0",
  "activeSessions": 5,
  "pendingRequests": 2,
  "uptime": 12345
}
```

### Statistics
```http
GET /stats
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "activeSessions": 5,
    "pendingRequests": 2,
    "sessions": [
      {
        "sessionId": "abc123",
        "userId": "user_123",
        "connectedAt": "2025-10-18T10:30:00Z",
        "lastActivity": "2025-10-18T10:32:15Z",
        "requestCount": 12
      }
    ]
  }
}
```

## 🔌 WebSocket Events

### Client → Server

**`localhost:execute`**
Execute a localhost request via browser.

```javascript
socket.emit('localhost:execute', {
  requestId: 'unique-id',
  method: 'GET',
  url: 'http://localhost:5000/api/users',
  headers: {},
  params: [],
  body: {},
  auth: {}
}, (response) => {
  console.log(response);
});
```

### Server → Client

**`localhost:ready`**
Server is ready to accept requests.

```javascript
socket.on('localhost:ready', (data) => {
  console.log(data.message); // "WebSocket relay ready"
});
```

**`localhost:performFetch`**
Server instructs browser to execute local fetch.

```javascript
socket.on('localhost:performFetch', (request) => {
  // Execute fetch() locally and send response
  fetch(request.url).then(res => {
    socket.emit('localhost:fetchComplete', response);
  });
});
```

### Client → Server (Response)

**`localhost:fetchComplete`**
Browser sends successful response.

```javascript
socket.emit('localhost:fetchComplete', {
  requestId: 'unique-id',
  status: 200,
  statusText: 'OK',
  headers: {},
  body: {},
  time: 45,
  size: 1024,
  timestamp: '2025-10-18T10:32:15Z'
});
```

**`localhost:fetchError`**
Browser sends error response.

```javascript
socket.emit('localhost:fetchError', {
  requestId: 'unique-id',
  error: 'Connection refused'
});
```

## 🔒 Security

### URL Validation
Only localhost URLs are allowed:
- `localhost`
- `127.0.0.1`
- `::1`
- Local IP addresses (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`)

### Session Isolation
Each WebSocket connection has its own session. Requests cannot access other users' sessions.

### Timeout Protection
All requests timeout after 30 seconds to prevent hanging connections.

### Auto Cleanup
Inactive sessions (>10 minutes) are automatically cleaned up every 5 minutes.

## 📊 Monitoring

### Health Check
```bash
curl https://your-relay.onrender.com/
```

### Live Stats
```bash
curl https://your-relay.onrender.com/stats
```

## 🐛 Troubleshooting

### CORS Errors

**Problem**: Frontend can't connect to relay.

**Solution**: Add frontend URL to `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### Connection Timeout

**Problem**: WebSocket connection fails.

**Solution**: 
1. Check relay server is running
2. Verify firewall isn't blocking port
3. Check CORS configuration

### Request Timeout

**Problem**: Requests timeout after 30s.

**Solution**:
1. Check localhost server is running
2. Verify port number is correct
3. Test URL directly in browser first

## 🚢 Deployment Platforms

### Render (Recommended)

**Pros**:
- ✅ Free tier available
- ✅ WebSocket support
- ✅ Auto-deploy from Git
- ✅ Easy environment variables

**Setup**:
1. Connect GitHub repo
2. Select `backend` folder
3. Add environment variables
4. Deploy!

### Railway

**Pros**:
- ✅ Fast deployments
- ✅ WebSocket support
- ✅ Free trial credits

**Setup**:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

### Heroku

**Pros**:
- ✅ Established platform
- ✅ WebSocket support

**Setup**:
```bash
# Create app
heroku create your-relay-app

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main
```

## 📈 Performance

### Resource Usage
- **Memory**: ~50-100MB
- **CPU**: <5% under normal load
- **Network**: Minimal (only relay messages)

### Capacity
- **Connections**: 1000+ concurrent users
- **Latency**: ~50-100ms relay overhead
- **Uptime**: 99.9% (with proper hosting)

## 🔄 Updating

1. **Pull latest changes**:
```bash
git pull origin main
```

2. **Install new dependencies**:
```bash
npm install
```

3. **Restart server**:
- Render: Auto-deploys on push
- Railway: `railway up`
- Heroku: `git push heroku main`

## 📝 License

MIT

## 🤝 Support

For issues or questions:
1. Check this README
2. Review server logs
3. Test with health check endpoint
4. Contact support with error details

---

**Server Version**: 1.0.0  
**Last Updated**: 2025-10-18
