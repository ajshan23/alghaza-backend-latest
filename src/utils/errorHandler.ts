import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiError } from "./apiHandlerHelpers";
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    // If the error is an instance of ApiError, use its properties
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            success: err.success,
            statusCode: err.statusCode,
            message: err.message,
            errors: err.errors || [],
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
        return;
    }

    // Fallback for unhandled errors
    res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Internal Server Error",
        errors: [],
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};

export { errorHandler };