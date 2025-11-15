// Simple test script to verify Redis caching is working
const { cache, connectRedis } = require('./cache');

async function testCache() {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Test setting a value
    console.log('Testing cache set...');
    const setResult = await cache.set('test_key', { message: 'Hello from cache!', timestamp: new Date() }, 60);
    console.log('Set result:', setResult);
    
    // Test getting a value
    console.log('Testing cache get...');
    const getResult = await cache.get('test_key');
    console.log('Get result:', getResult);
    
    // Test exists
    console.log('Testing cache exists...');
    const existsResult = await cache.exists('test_key');
    console.log('Exists result:', existsResult);
    
    // Test delete
    console.log('Testing cache delete...');
    const delResult = await cache.del('test_key');
    console.log('Delete result:', delResult);
    
    // Test getting deleted value
    console.log('Testing cache get after delete...');
    const getResultAfterDelete = await cache.get('test_key');
    console.log('Get result after delete:', getResultAfterDelete);
    
    console.log('Cache test completed successfully!');
  } catch (error) {
    console.error('Cache test failed:', error);
  }
}

// Run the test
testCache();