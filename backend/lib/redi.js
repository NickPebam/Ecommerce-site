import Redis from "ioredis"
import dotenv from 'dotenv'

dotenv.config();

export const redis = new Redis(process.env.UPSTASH_REDIS_URL);
// key value store (userif value(refresh token))
// await client.set('foo', 'bar');