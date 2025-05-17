// import { Request, Response, NextFunction } from "express";
// import { validationResult, body } from "express-validator";
// import { ApiError } from "../utils/apiHandlerHelpers";
// // import { UserRole } from "../models/userModel";

// export const validateUserCreate = [
//   body("email").isEmail().withMessage("Valid email is required"),
//   body("password")
//     .isLength({ min: 8 })
//     .withMessage("Password must be at least 8 characters"),
//   body("phoneNumbers")
//     .isArray({ min: 1 })
//     .withMessage("At least one phone number is required"),
//   body("phoneNumbers.*")
//     .isString()
//     .withMessage("Phone numbers must be strings"),
//   body("firstName").notEmpty().withMessage("First name is required"),
//   body("lastName").notEmpty().withMessage("Last name is required"),
//   body("role").isIn(Object.values(UserRole)).withMessage("Invalid user role"),
//   body("image").optional().isString(),
//   body("address").optional().isString(),
//   (req: Request, res: Response, next: NextFunction) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       throw new ApiError(400, "Validation error", errors.array());
//     }
//     next();
//   },
// ];

// export const validateUserUpdate = [
//   body("email").optional().isEmail().withMessage("Valid email is required"),
//   body("password")
//     .optional()
//     .isLength({ min: 8 })
//     .withMessage("Password must be at least 8 characters"),
//   body("phoneNumbers")
//     .optional()
//     .isArray({ min: 1 })
//     .withMessage("At least one phone number is required"),
//   body("phoneNumbers.*")
//     .optional()
//     .isString()
//     .withMessage("Phone numbers must be strings"),
//   body("firstName").optional().notEmpty().withMessage("First name is required"),
//   body("lastName").optional().notEmpty().withMessage("Last name is required"),
//   body("role")
//     .optional()
//     .isIn(Object.values(UserRole))
//     .withMessage("Invalid user role"),
//   body("image").optional().isString(),
//   body("address").optional().isString(),
//   (req: Request, res: Response, next: NextFunction) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       throw new ApiError(400, "Validation error", errors.array());
//     }
//     next();
//   },
// ];
