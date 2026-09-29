import NodeCache from 'node-cache';

const idempotencyCache = new NodeCache({
  stdTTL: 86400,
  checkperiod: 3600,
  useClones: false,
});

export const createIdempotencyKey = (userId, action, resourceType, resourceId) => {
  return `${userId}:${action}:${resourceType}:${resourceId || 'new'}`;
};

export const idempotencyMiddleware = (options = {}) => {
  const {
    keyGenerator = (req) => {
      const userId = req.user?._id?.toString() || 'anonymous';
      const action = req.method + '_' + req.path.replace(/\//g, '_');
      return `${userId}:${action}`;
    },
    keyHeader = 'x-idempotency-key',
    responseHeader = 'x-idempotency-key',
    ttl = 86400,
    skipOnFailure = true,
  } = options;

  return async (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const idempotencyKey = req.headers[keyHeader];

    if (!idempotencyKey) {
      return next();
    }

    const key = `${idempotencyKey}:${keyGenerator(req)}`;

    try {
      const cached = idempotencyCache.get(key);

      if (cached) {
        res.setHeader(responseHeader, idempotencyKey);

        if (cached.status === 'processing') {
          return res.status(409).json({
            success: false,
            message: 'Request is already being processed',
            idempotencyKey,
          });
        }

        if (cached.status === 'completed') {
          if (cached.response) {
            if (cached.response.status >= 200 && cached.response.status < 300) {
              return res.status(cached.response.status).json(cached.response.body);
            }
          }
          return res.status(cached.response?.status || 200).json(cached.response?.body || cached.body);
        }
      }

      idempotencyCache.set(key, { status: 'processing', startTime: Date.now() });

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const responseData = {
          status: res.statusCode,
          body,
          timestamp: Date.now(),
        };

        if (res.statusCode >= 200 && res.statusCode < 300) {
          idempotencyCache.set(key, { status: 'completed', response: responseData }, ttl);
        } else if (skipOnFailure) {
          idempotencyCache.del(key);
        } else {
          idempotencyCache.set(key, { status: 'failed', response: responseData }, ttl);
        }

        return originalJson(body);
      };

      const originalEnd = res.end.bind(res);
      res.end = (...args) => {
        if (!res.getHeader('content-type')?.includes('application/json')) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            idempotencyCache.set(key, { status: 'completed' }, ttl);
          }
        }
        return originalEnd(...args);
      };

      next();
    } catch (error) {
      console.error('[Idempotency] Error:', error.message);
      next();
    }
  };
};

export const clearIdempotencyKey = (key) => {
  idempotencyCache.del(key);
};

export const getIdempotencyKeyStatus = (key) => {
  return idempotencyCache.get(key);
};
