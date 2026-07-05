import NodeCache from "node-cache";

// StdTTL: default time to live in seconds (5 minutes)
const cache = new NodeCache({ stdTTL: 300 });

export const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`[CACHE HIT] ${key}`);
      return res.json(cachedResponse);
    }

    console.log(`[CACHE MISS] ${key}`);
    // Intercept res.json
    const originalJson = res.json;
    res.json = (body) => {
      // Restore original json function to avoid double-calling issues
      res.json = originalJson;
      // Cache the response
      cache.set(key, body, duration);
      return res.json(body);
    };

    next();
  };
};

export const clearCache = (key) => {
  cache.del(key);
};
