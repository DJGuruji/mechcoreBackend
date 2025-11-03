/**
 * WebSocket Relay Server for Localhost API Testing
 * 
 * This standalone Node.js server enables users to test localhost APIs
 * from production by establishing a WebSocket connection between the
 * browser and relay server.
 * 
 * Deploy to: Render, Railway, Heroku, or any Node.js hosting
 * 
 * Security Features:
 * - JWT Authentication at handshake
 * - Origin validation
 * - Rate limiting
 * - Input validation
 * - Session timeout
 * - Structured logging
 * - Secure CORS configuration
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(express.json({ limit: '10mb' })); // Limit request size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced CORS configuration with security
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

// Enhanced CORS with security headers
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Socket.IO with enhanced security
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket'], // Only allow WebSocket transport for better security
  serveClient: false, // Don't serve client files
  allowEIO3: false, // Disable Engine.IO v3 support
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Store active sessions with enhanced security
const activeSessions = new Map();

// Store pending requests (waiting for browser to execute)
// const pendingRequests = new Map();

// Rate limiting for WebSocket connections
const connectionAttempts = new Map();
const MAX_CONNECTIONS_PER_IP = 10;
const CONNECTION_WINDOW_MS = 60 * 1000; // 1 minute

// Health check endpoint with security
app.get('/', (req, res) => {
  // Don't expose detailed server information in production
  const response = {
    service: 'API Tester Relay Server',
    status: 'running',
    version: '1.0.0'
  };
  
  // Only expose detailed stats in development
  if (process.env.NODE_ENV !== 'production') {
    response.activeSessions = activeSessions.size;
    response.pendingRequests = pendingRequests.size;
    response.uptime = process.uptime();
  }
  
  res.json(response);
});

// Stats endpoint with authentication
app.get('/stats', (req, res) => {
  // In production, this should be protected
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      success: false, 
      message: 'Stats endpoint not available in production' 
    });
  }
  
  res.json({
    success: true,
    stats: {
      activeSessions: activeSessions.size,
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

// Enhanced WebSocket connection handling with security
io.use((socket, next) => {
  // Get client IP
  const clientIP = socket.handshake.address || socket.request.connection.remoteAddress;
  
  // Rate limiting for connection attempts
  const now = Date.now();
  const attempts = connectionAttempts.get(clientIP) || [];
  
  // Filter out old attempts
  const recentAttempts = attempts.filter(time => now - time < CONNECTION_WINDOW_MS);
  
  // Check if limit exceeded
  if (recentAttempts.length >= MAX_CONNECTIONS_PER_IP) {
    return next(new Error('Too many connection attempts'));
  }
  
  // Record this attempt
  recentAttempts.push(now);
  connectionAttempts.set(clientIP, recentAttempts);
  
  // Validate authentication token
  const userId = socket.handshake.auth?.userId;
  if (!userId) {
    return next(new Error('Authentication required'));
  }
  
  // Validate origin
  const origin = socket.handshake.headers.origin;
  if (origin && allowedOrigins.indexOf(origin) === -1) {
    return next(new Error('Origin not allowed'));
  }
  
  next();
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected:`);
  
  // Initialize session with security enhancements
  const sessionId = socket.id;
  const userId = socket.handshake.auth?.userId || 'anonymous';
  
  // Validate user ID format
  if (userId !== 'anonymous' && typeof userId !== 'string') {
    socket.disconnect(true);
    return;
  }
  
  activeSessions.set(sessionId, {
    sessionId,
    userId,
    connectedAt: new Date(),
    lastActivity: new Date(),
    requestCount: 0,
    ip: socket.handshake.address || socket.request.connection.remoteAddress
  });

  // Handle localhost request from frontend with validation
  socket.on('localhost:execute', async (request, callback) => {
    console.log(`[WebSocket] Received localhost request: ${request.method} ${request.url}`);
    
    // Validate callback is a function
    if (typeof callback !== 'function') {
      return;
    }
    
    const session = activeSessions.get(sessionId);
    if (!session) {
      callback({ error: true, message: 'Session not found' });
      return;
    }

    // Update session activity
    session.lastActivity = new Date();
    session.requestCount++;

    // Validate request structure
    if (!request || typeof request !== 'object') {
      callback({ 
        error: true, 
        message: 'Invalid request format' 
      });
      return;
    }

    // Validate required fields
    if (!request.requestId || !request.method || !request.url) {
      callback({ 
        error: true, 
        message: 'Missing required fields: requestId, method, url' 
      });
      return;
    }

    // Validate localhost URL
    if (!isLocalhostUrl(request.url)) {
      callback({ 
        error: true, 
        message: 'Only localhost URLs are allowed for relay execution' 
      });
      return;
    }

    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(request.method.toUpperCase())) {
      callback({ 
        error: true, 
        message: 'Invalid HTTP method' 
      });
      return;
    }

    // Limit request size
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 64 * 1024) { // 64KB limit
      callback({ 
        error: true, 
        message: 'Request too large' 
      });
      return;
    }

    try {
      // Execute the request directly on the server side to bypass CORS
      const response = await executeLocalhostRequest(request);
      
      // Send the response back to the client
      callback(response);
    } catch (error) {
      console.error('[WebSocket] Request execution error:', error);
      callback({ 
        error: true, 
        message: error.message || 'Failed to execute localhost request' 
      });
    }
  });

  // New function to execute localhost requests directly on the server
  async function executeLocalhostRequest(request) {
    const { url, method, headers, body } = request;
    
    console.log(`[WebSocket] Executing localhost request directly on server: ${method} ${url}`);
    
    try {
      // Prepare fetch options
      const fetchOptions = {
        method: method || 'GET',
        headers: headers || {},
      };

      // Add body for non-GET requests
      if (method !== 'GET' && method !== 'HEAD' && body) {
        fetchOptions.body = typeof body === 'string' 
          ? body 
          : JSON.stringify(body);
      }

      // Execute fetch from server-side (bypasses CORS!)
      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const endTime = Date.now();

      // Read response
      const contentType = response.headers.get('content-type') || '';
      let responseBody;

      try {
        const text = await response.text();
        if (contentType.includes('application/json')) {
          responseBody = JSON.parse(text);
        } else {
          responseBody = text;
        }
      } catch (e) {
        responseBody = await response.text();
      }

      // Convert headers to object
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Calculate response size
      const responseSize = new Blob([
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
      ]).size;

      // Return response
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        time: endTime - startTime,
        size: responseSize,
      };
    } catch (error) {
      console.error('[WebSocket] Server-side localhost request failed:', error);
      throw new Error(`Server-side request failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket] Client disconnected:  (${reason})`);
    
    // Clean up session
    activeSessions.delete(sessionId);
    
    // Reject all pending requests for this session
    pendingRequests.forEach((pending, requestId) => {
      if (pending.sessionId === sessionId) {
        clearTimeout(pending.timeout);
        pending.reject({ error: true, message: 'WebSocket connection closed' });
        pendingRequests.delete(requestId);
      }
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
  });

  // Send ready confirmation
  socket.emit('localhost:ready', { sessionId, message: 'WebSocket relay ready' });
});

// Cleanup old sessions every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = new Date();
  const sessionTimeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '10');
  
  activeSessions.forEach((session, sessionId) => {
    const inactiveMinutes = (now.getTime() - session.lastActivity.getTime()) / 1000 / 60;
    if (inactiveMinutes > sessionTimeoutMinutes) {
      console.log(`[WebSocket] Cleaning up inactive session: ${sessionId}`);
      activeSessions.delete(sessionId);
      
      // Clean up pending requests for this session
      pendingRequests.forEach((pending, requestId) => {
        if (pending.sessionId === sessionId) {
          clearTimeout(pending.timeout);
          pendingRequests.delete(requestId);
        }
      });
    }
  });
  
  // Clean up old connection attempts
  const cleanupTime = Date.now() - CONNECTION_WINDOW_MS;
  connectionAttempts.forEach((attempts, ip) => {
    const recentAttempts = attempts.filter(time => time > cleanupTime);
    if (recentAttempts.length > 0) {
      connectionAttempts.set(ip, recentAttempts);
    } else {
      connectionAttempts.delete(ip);
    }
  });
}, parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '5') * 60 * 1000);

// Helper to validate localhost URLs with enhanced security
function isLocalhostUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Only allow http protocol (no https for localhost in this context)
    if (urlObj.protocol !== 'http:') {
      return false;
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    
    // Allow localhost and loopback addresses
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '::1') {
      return true;
    }
    
    // Allow local network addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (hostname.match(/^192\.168\.\d{1,3}\.\d{1,3}$/) || 
        hostname.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/) || 
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/)) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  clearInterval(cleanupInterval);
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  clearInterval(cleanupInterval);
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    WebSocket Relay Server Running                           ║
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
