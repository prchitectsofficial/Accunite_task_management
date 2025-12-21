/**
 * Small helper to avoid repetitive try/catch in async route handlers.
 */
function asyncHandler(fn) {
  return function asyncRouteHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
