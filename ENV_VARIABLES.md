# Backend Environment Variables for Node.js Deployment
# Copy this file to .env for local development
# Add these variables to your deployment platform (Render/Railway/Heroku)

# ============================================
# Server Configuration (REQUIRED)
# ============================================
# Port for the server (default: 8080)
PORT=8080

# Environment (development/production)
NODE_ENV=production

# ============================================
# CORS Configuration (REQUIRED)
# ============================================
# Comma-separated list of allowed origins
# Example: https://your-frontend.vercel.app,https://your-frontend.com
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# ============================================
# Session & Timeout Configuration (OPTIONAL)
# ============================================
# Request timeout in seconds (default: 30)
REQUEST_TIMEOUT_SECONDS=30

# Session timeout in minutes (default: 10)
SESSION_TIMEOUT_MINUTES=10

# Cleanup interval in minutes (default: 5)
CLEANUP_INTERVAL_MINUTES=5

# ============================================
# Redis Configuration (OPTIONAL - for caching)
# ============================================
# Redis connection URL
# Example: redis://username:password@host:port
# REDIS_URL=redis://localhost:6379

# ============================================
# Deployment Notes
# ============================================
# For Render.com:
#   - Add these as Environment Variables in the dashboard
#   - Use Redis addon for REDIS_URL (optional)
#
# For Railway.app:
#   - Add these in the Variables tab
#   - Use Railway Redis plugin (optional)
#
# For Heroku:
#   - Use: heroku config:set KEY=VALUE
#   - Use Heroku Redis addon (optional)
