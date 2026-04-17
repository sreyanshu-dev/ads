import fetch from "node-fetch";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis helper
const redis = async (cmd, ...args) => {
  const res = await fetch(`${REDIS_URL}/${cmd}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  return res.json();
};

// Get IP
export const getIP = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] || "0.0.0.0";

// Rate limit
export const rateLimit = async (ip) => {
  const key = `rate:${ip}`;
  const count = await redis("incr", key);
  if (count === 1) await redis("expire", key, 10);
  return count > 10;
};

// Create Ad
export const createAd = async (body) => {
  const key = Math.random().toString(36).slice(2, 10);

  const ad = {
    key,
    url: body.url,
    expiresAt: Date.now() + (body.ttl || 86400000),
    clicks: 0
  };

  await redis("set", `ad:${key}`, JSON.stringify(ad));
  await redis("sadd", "ads", key);

  return ad;
};

// Get random active ad
export const getRandomAd = async () => {
  const keys = await redis("smembers", "ads");

  if (!keys.result.length) return null;

  const randomKey = keys.result[Math.floor(Math.random() * keys.result.length)];
  const adData = await redis("get", `ad:${randomKey}`);

  if (!adData.result) return null;

  const ad = JSON.parse(adData.result);

  if (Date.now() > ad.expiresAt) {
    await redis("srem", "ads", randomKey);
    return null;
  }

  return ad;
};

// Handle Click
export const handleClick = async (req) => {
  const key = req.query.key;
  const ip = getIP(req);

  if (await rateLimit(ip)) {
    return { status: 429, body: "Too many requests" };
  }

  const adData = await redis("get", `ad:${key}`);
  if (!adData.result) return { status: 404, body: "Ad not found" };

  const ad = JSON.parse(adData.result);

  // Expiry check
  if (Date.now() > ad.expiresAt) {
    return { status: 410, body: "Ad expired" };
  }

  // Unique tracking
  const uniqueKey = `click:${key}:${ip}`;
  const isUnique = await redis("setnx", uniqueKey, 1);

  if (isUnique.result === 1) {
    await redis("expire", uniqueKey, 86400);
  }

  ad.clicks += 1;
  await redis("set", `ad:${key}`, JSON.stringify(ad));

  return {
    redirect: ad.url,
    unique: isUnique.result === 1
  };
};
