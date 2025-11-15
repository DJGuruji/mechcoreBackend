const redis = require('redis');
require('dotenv').config();

// Debug: Log environment variables
console.log('Environment variables loaded:', {
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD ? '****' : 'not set'
});

// Create Redis client
const createRedisClient = () => {
  // Debug: Log the Redis configuration
  console.log('Redis Configuration:', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD ? '****' : 'not set'
  });
  
  const redisOptions = {
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    },
    // Add password if provided
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    // Add other options as needed
  };

  const client = redis.createClient(redisOptions);
  
  // Handle reconnect logic with new event system
  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });
  
  client.on('connect', () => {
    console.log('Redis Client Connected');
  });
  
  client.on('reconnecting', () => {
    console.log('Redis Client Reconnecting');
  });
  
  client.on('ready', () => {
    console.log('Redis Client Ready');
  });
  
  return client;
};

// Create singleton instance
const redisClient = createRedisClient();

// Connect to Redis
const connectRedis = async () => {
  try {
    console.log('Attempting to connect to Redis...');
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
};

// Cache utility functions
const cache = {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null if not found
   */
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      if (value === null) return null;
      return JSON.parse(value);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} - Success status
   */
  set: async (key, value, ttl = 300) => { // Default 5 minutes
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, ttl, stringValue);
      } else {
        await redisClient.set(key, stringValue);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<number>} - Number of keys deleted
   */
  del: async (key) => {
    try {
      return await redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return 0;
    }
  },

  /**
   * Delete keys matching pattern
   * @param {string} pattern - Pattern to match keys
   * @returns {Promise<number>} - Number of keys deleted
   */
  delPattern: async (pattern) => {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;
      return await redisClient.del(keys);
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  },

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Existence status
   */
  exists: async (key) => {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Increment a counter in cache
   * @param {string} key - Counter key
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<number>} - New value
   */
  incr: async (key, ttl) => {
    try {
      const result = await redisClient.incr(key);
      if (ttl) {
        await redisClient.expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  },

  /**
   * Close Redis connection
   */
  quit: async () => {
    try {
      await redisClient.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
};

module.exports = { cache, connectRedis, redisClient };