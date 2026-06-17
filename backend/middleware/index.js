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
// GLOBAL ERROR HANDLER
// ===============================
export const errorHandler = (err, req, res, next) => {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
  });
};