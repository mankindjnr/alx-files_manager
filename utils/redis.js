import redis from 'redis';

const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.expireAsync = promisify(this.client.expire).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.isConnected || false;
  }

  // get method
  async get(key) {
    const value = await this.getAsync(key);
    return value;
  }

  async set(key, value, duration) {
    await this.setAsync(key, value);

    if (duration) {
      await this.expireAsync(key, duration);
    }

    return true;
  }

  async del(key) {
    const deleted = await this.delAsync(key);
    return deleted > 0;
  }

  // this.client.quit();
}

const redisClient = new RedisClient();
module.exports = redisClient;
