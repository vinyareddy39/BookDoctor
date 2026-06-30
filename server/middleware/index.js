import jwt from "jsonwebtoken";
import User from "../models/User.js";


// ===============================
// RESPONSE HANDLER (req.http)
// ===============================
export const response = (req, res, next) => {
  req.http = {
    ok: (data, message = "Success") =>
      res.status(200).json({
        success: true,
        message,
        data,
      }),

    created: (data, message = "Created Successfully") =>
      res.status(201).json({
        success: true,
        message,
        data,
      }),

    badRequest: (message = "Bad Request") =>
      res.status(400).json({
        success: false,
        message,
      }),

    unauthorized: (message = "Unauthorized") =>
      res.status(401).json({
        success: false,
        message,
      }),

    forbidden: (message = "Forbidden") =>
      res.status(403).json({
        success: false,
        message,
      }),

    notFound: (message = "Not Found") =>
      res.status(404).json({
        success: false,
        message,
      }),

    serverError: (message = "Internal Server Error") =>
      res.status(500).json({
        success: false,
        message,
      }),
  };

  next();
};


// ===============================
// AUTH MIDDLEWARE (JWT VERIFY)
// ===============================
export const auth = async (req, res, next) => {
  try {
    let token;

    // token from headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return req.http.unauthorized("No token provided");
    }

    // verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // attach user to request
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return req.http.unauthorized("User not found");
    }

    req.user = user;

    next();
  } catch (error) {
    return req.http.unauthorized("Invalid or expired token");
  }
};


// ===============================
// ROLE BASED ACCESS CONTROL
// ===============================
export const role = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return req.http.unauthorized("Login required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return req.http.forbidden(
        "You do not have permission to access this resource"
      );
    }

    next();
  };
};


// ===============================
// GLOBAL ERROR HANDLER (production-grade)
// ===============================
export const errorHandler = (err, req, res, next) => {
  // Always log the full error server-side
  console.error("[ERROR]", err.name, "—", err.message);

  let statusCode = err.statusCode || 500;
  let message    = err.message || "Something went wrong";

  // Mongoose bad ObjectId (e.g. /api/doctors/invalid-id)
  if (err.name === "CastError") {
    statusCode = 400;
    message    = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key (e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  }

  // Mongoose validation errors (e.g. missing required field)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message    = Object.values(err.errors).map((e) => e.message).join(". ");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError")  { statusCode = 401; message = "Invalid token. Please log in again."; }
  if (err.name === "TokenExpiredError")  { statusCode = 401; message = "Your session has expired. Please log in again."; }

  // In production, hide internal 500 messages from the client
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "An internal server error occurred. Please try again later.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};


// ===============================
// VALIDATE REQUEST BODY FIELDS
// Usage: validate(["field1", "field2"])
// ===============================
export const validate = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(
    (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ""
  );

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(", ")}`,
    });
  }

  next();
};