import Redis from 'ioredis';
import Redlock from 'redlock';

export function createCacheClient(redisUrl: string) {
  const redis = new Redis(redisUrl);

  const redlock = new Redlock([redis as any], {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 100,
    retryJitter: 50,
  });

  return { redis, redlock };
}
