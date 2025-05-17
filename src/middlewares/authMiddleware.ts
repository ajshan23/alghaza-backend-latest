import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel";
import { ApiError } from "../utils/apiHandlerHelpers";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return next(new ApiError(401, "Unauthorized: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, "alghaza_secret") as {
      userId: string;
    };
    // console.log(token);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new ApiError(401, "Unauthorized: User not found"));
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    return next(new ApiError(401, "Unauthorized: Invalid token"));
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "Forbidden: Insufficient permissions"));
    }
    next();
  };
};
