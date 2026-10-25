// A thrown ApiError always produces the same response shape:
// { success: false, message, code }
export class ApiError extends Error {
  constructor(statusCode, message, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (message = "Resource not found") =>
  new ApiError(404, message, "NOT_FOUND");

export const badRequest = (message = "Invalid request", code = "BAD_REQUEST") =>
  new ApiError(400, message, code);

export const unauthorized = (message = "Not authenticated") =>
  new ApiError(401, message, "UNAUTHORIZED");

export const forbidden = (message = "Not allowed to perform this action") =>
  new ApiError(403, message, "FORBIDDEN");
