// Wraps an async controller so thrown errors/rejected promises flow into
// Express's error-handling middleware instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
