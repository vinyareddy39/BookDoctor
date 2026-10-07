// ============================================================================
// NoSQL INJECTION SANITIZATION MIDDLEWARE
// Recursively removes keys starting with "$" or containing "." from request objects
// ============================================================================

export const sanitize = (target) => {
  if (target && typeof target === "object") {
    if (Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        sanitize(target[i]);
      }
    } else {
      for (const key of Object.keys(target)) {
        if (/^\$|\./.test(key)) {
          delete target[key];
        } else {
          sanitize(target[key]);
        }
      }
    }
  }
  return target;
};

export const mongoSanitizer = (req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) sanitize(req.query);
  next();
};

export default mongoSanitizer;
