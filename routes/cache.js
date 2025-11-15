const express = require('express');
const { cache } = require('../cache');
const router = express.Router();

// Middleware to verify internal requests only
const verifyInternalRequest = (req, res, next) => {
  // In production, you should implement proper authentication
  // For now, we'll check if the request is coming from localhost
  const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
  const isLocal = clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('::ffff:127.0.0.1');
  
  if (!isLocal) {
    return res.status(403).json({ error: 'Forbidden: Internal use only' });
  }
  
  next();
};

// Get cache value
router.get('/:key', verifyInternalRequest, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await cache.get(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Key not found' });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error('Cache GET error:', error);
    res.status(500).json({ error: 'Failed to get cache value' });
  }
});

// Set cache value
router.post('/', verifyInternalRequest, async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }
    
    const success = await cache.set(key, value, ttl);
    
    if (success) {
      res.status(201).json({ message: 'Value cached successfully', key });
    } else {
      res.status(500).json({ error: 'Failed to cache value' });
    }
  } catch (error) {
    console.error('Cache SET error:', error);
    res.status(500).json({ error: 'Failed to set cache value' });
  }
});

// Delete cache key
router.delete('/:key', verifyInternalRequest, async (req, res) => {
  try {
    const { key } = req.params;
    const deletedCount = await cache.del(key);
    
    if (deletedCount > 0) {
      res.json({ message: 'Key deleted successfully', key });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  } catch (error) {
    console.error('Cache DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete cache key' });
  }
});

// Check if key exists
router.head('/:key', verifyInternalRequest, async (req, res) => {
  try {
    const { key } = req.params;
    const exists = await cache.exists(key);
    
    if (exists) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    console.error('Cache EXISTS error:', error);
    res.status(500).end();
  }
});

// Delete keys by pattern
router.delete('/pattern/:pattern', verifyInternalRequest, async (req, res) => {
  try {
    const { pattern } = req.params;
    const deletedCount = await cache.delPattern(pattern);
    
    res.json({ message: `Deleted ${deletedCount} keys matching pattern`, pattern, deletedCount });
  } catch (error) {
    console.error('Cache DELETE pattern error:', error);
    res.status(500).json({ error: 'Failed to delete cache keys by pattern' });
  }
});

// Get cache stats
router.get('/stats', verifyInternalRequest, async (req, res) => {
  try {
    // Redis info command equivalent
    res.json({ 
      message: 'Cache stats endpoint - implement based on your Redis setup',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache STATS error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

module.exports = router;