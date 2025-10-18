/**
 * WebSocket Relay Server for Localhost API Testing
 * 
 * This standalone Node.js server enables users to test localhost APIs
 * from production by establishing a WebSocket connection between the
 * browser and relay server.
 * 
 * Deploy to: Render, Railway, Heroku, or any Node.js hosting
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

// Store active sessions
const activeSessions = new Map();

// Store pending requests (waiting for browser to execute)
const pendingRequests = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'API Tester Relay Server',
    status: 'running',
    version: '1.0.0',
    activeSessions: activeSessions.size,
    pendingRequests: pendingRequests.size,
    uptime: process.uptime()
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      activeSessions: activeSessions.size,
      pendingRequests: pendingRequests.size,
      sessions: Array.from(activeSessions.values()).map(s => ({
        sessionId: s.sessionId,
        userId: s.userId,
        connectedAt: s.connectedAt,
        lastActivity: s.lastActivity,
        requestCount: s.requestCount
      }))
    }
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  
  // Initialize session
  const sessionId = socket.id;
  const userId = socket.handshake.auth?.userId || 'anonymous';
  
  activeSessions.set(sessionId, {
    sessionId,
    userId,
    connectedAt: new Date(),
    lastActivity: new Date(),
    requestCount: 0
  });

  // Handle localhost request from frontend
  socket.on('localhost:execute', async (request, callback) => {
    console.log(`[WebSocket] Received localhost request: ${request.method} ${request.url}`);
    
    const session = activeSessions.get(sessionId);
    if (!session) {
      callback({ error: true, message: 'Session not found' });
      return;
    }

    // Update session activity
    session.lastActivity = new Date();
    session.requestCount++;

    // Validate localhost URL
    if (!isLocalhostUrl(request.url)) {
      callback({ 
        error: true, 
        message: 'Only localhost URLs are allowed for relay execution' 
      });
      return;
    }

    try {
      // Create promise to wait for browser response
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(request.requestId);
          reject({ error: true, message: 'Request timeout - browser did not respond' });
        }, 30000); // 30 second timeout

        pendingRequests.set(request.requestId, {
          requestData: request,
          resolve,
          reject,
          timeout
        });
      });

      // Send command to browser to execute local fetch
      socket.emit('localhost:performFetch', request);

      // Wait for browser response
      const response = await responsePromise;
      callback(response);

    } catch (error) {
      console.error('[WebSocket] Request execution error:', error);
      callback({ 
        error: true, 
        message: error.message || 'Failed to execute localhost request' 
      });
    }
  });

  // Handle response from browser (after local fetch)
  socket.on('localhost:fetchComplete', (response) => {
    console.log(`[WebSocket] Received browser response for request: ${response.requestId}`);
    
    const pending = pendingRequests.get(response.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(response);
      pendingRequests.delete(response.requestId);
    }
  });

  // Handle fetch error from browser
  socket.on('localhost:fetchError', (data) => {
    console.error(`[WebSocket] Browser fetch error: ${data.error}`);
    
    const pending = pendingRequests.get(data.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject({ error: true, message: data.error });
      pendingRequests.delete(data.requestId);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    
    // Clean up session
    activeSessions.delete(sessionId);
    
    // Reject all pending requests for this session
    pendingRequests.forEach((pending, requestId) => {
      if (requestId.startsWith(sessionId)) {
        clearTimeout(pending.timeout);
        pending.reject({ error: true, message: 'WebSocket connection closed' });
        pendingRequests.delete(requestId);
      }
    });
  });

  // Send ready confirmation
  socket.emit('localhost:ready', { sessionId, message: 'WebSocket relay ready' });
});

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = new Date();
  activeSessions.forEach((session, sessionId) => {
    const inactiveMinutes = (now.getTime() - session.lastActivity.getTime()) / 1000 / 60;
    if (inactiveMinutes > 10) {
      console.log(`[WebSocket] Cleaning up inactive session: ${sessionId}`);
      activeSessions.delete(sessionId);
    }
  });
}, 5 * 60 * 1000);

// Helper to validate localhost URLs
function isLocalhostUrl(url) {
  try {
    const urlLower = url.toLowerCase();
    
    // Allow localhost, 127.0.0.1, and local IP addresses
    if (urlLower.includes('localhost')) return true;
    if (urlLower.includes('127.0.0.1')) return true;
    if (urlLower.includes('::1')) return true;
    
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check for local IP addresses
    if (hostname.match(/^192\.168\./) || 
        hostname.match(/^10\./) || 
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

// Start server
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 WebSocket Relay Server Running                           ║
║                                                                ║
║   Port: ${PORT}                                                    ║
║   Environment: ${process.env.NODE_ENV || 'development'}                                   ║
║   Allowed Origins: ${allowedOrigins.length} configured                       ║
║                                                                ║
║   Endpoints:                                                   ║
║   • Health Check: GET /                                        ║
║   • Statistics: GET /stats                                     ║
║   • WebSocket: ws://localhost:${PORT}/socket.io                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});
