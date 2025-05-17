import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { User } from "../models/userModel";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  deleteFileFromS3,
  uploadSignatureImage,
  uploadUserProfileImage,
} from "../utils/uploadConf";
const SALT_ROUNDS = 10;

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, phoneNumbers, firstName, lastName, role, salary } =
    req.body;
console.log(req.body);

  if (
    !email ||
    !password ||
    !phoneNumbers ||
    !firstName ||
    !lastName ||
    !role
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Validate salary for non-admin roles
  if (
    !["super_admin", "admin"].includes(role) &&
    (salary === undefined || salary === null)
  ) {
    throw new ApiError(400, "Salary is required for this role");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Handle file uploads if they exist
  let profileImageUrl: string | undefined;
  let signatureImageUrl: string | undefined;

  // Process profile image if uploaded
  if (req.files && (req.files as any).profileImage) {
    const profileImage = (req.files as any).profileImage[0];
    const uploadResult = await uploadUserProfileImage(profileImage);
    if (uploadResult.success && uploadResult.uploadData) {
      profileImageUrl = uploadResult.uploadData.url;
    }
  }

  // Process signature image if uploaded
  if (req.files && (req.files as any).signatureImage) {
    const signatureImage = (req.files as any).signatureImage[0];
    const uploadResult = await uploadSignatureImage(signatureImage);
    if (uploadResult.success && uploadResult.uploadData) {
      signatureImageUrl = uploadResult.uploadData.url;
    }
  }

  const user = await User.create({
    email,
    password: hashedPassword,
    phoneNumbers,
    firstName,
    lastName,
    role,
    salary: ["super_admin", "admin"].includes(role) ? undefined : salary,
    profileImage: profileImageUrl,
    signatureImage: signatureImageUrl,
    createdBy: req.user?.userId,
  });

  res.status(201).json(new ApiResponse(201, {}, "User created successfully"));
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Build the filter object dynamically
  const filter: any = {};

  // Filter by role (if provided)
  if (req.query.role) {
    filter.role = req.query.role;
  }

  // Filter by active status (if provided)
  if (req.query.isActive) {
    filter.isActive = req.query.isActive === "true";
  }

  // Search functionality (if search term provided)
  if (req.query.search) {
    const searchTerm = req.query.search as string;
    filter.$or = [
      { firstName: { $regex: searchTerm, $options: "i" } }, // Case-insensitive
      { lastName: { $regex: searchTerm, $options: "i" } },
      { email: { $regex: searchTerm, $options: "i" } },
      // If you want to search by full name (firstName + lastName)
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ["$firstName", " ", "$lastName"] },
            regex: searchTerm,
            options: "i",
          },
        },
      },
    ];
  }

  // Count total matching documents (for pagination)
  const total = await User.countDocuments(filter);

  // Fetch users with applied filters, pagination, and sorting
  const users = await User.find(filter, { password: 0 }) // Exclude password
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 }); // Newest first

  // Return response with pagination metadata
  res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      },
      "Users retrieved successfully"
    )
  );
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id).select("-password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Users can view their own profile, admins can view any
  if (
    user._id.toString() !== req.user?.userId &&
    req.user?.role !== "admin" &&
    req.user?.role !== "super_admin"
  ) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  res
    .status(200)
    .json(new ApiResponse(200, user, "User retrieved successfully"));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  console.log("updateData", updateData);

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Users can update their own profile, admins can update any
  if (
    user._id.toString() !== req.user?.userId &&
    req.user?.role !== "admin" &&
    req.user?.role !== "super_admin"
  ) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  // Admins can change role, others can't
  if (
    updateData.role &&
    req.user?.role !== "admin" &&
    req.user?.role !== "super_admin"
  ) {
    throw new ApiError(403, "Forbidden: Only admins can change roles");
  }

  // Validate salary if role is being changed to non-admin
  if (
    updateData.role &&
    !["super_admin", "admin"].includes(updateData.role) &&
    !updateData.salary
  ) {
    throw new ApiError(400, "Salary is required for this role");
  }

  // Validate salary if updating a non-admin user
  if (
    !["super_admin", "admin"].includes(user.role) &&
    updateData.salary === undefined &&
    updateData.salary === null
  ) {
    throw new ApiError(400, "Salary is required for this role");
  }

  // Handle password update
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
  }

  // Process profile image if uploaded
  if (req.files && (req.files as any).profileImage) {
    const profileImage = (req.files as any).profileImage[0];
    const uploadResult = await uploadUserProfileImage(profileImage);

    if (uploadResult.success && uploadResult.uploadData) {
      // Delete old profile image if it exists
      if (user.profileImage) {
        try {
          await deleteFileFromS3(user.profileImage);
        } catch (err) {
          console.error("Error deleting old profile image:", err);
        }
      }
      updateData.profileImage = uploadResult.uploadData.url;
    }
  }

  // Process signature image if uploaded
  if (req.files && (req.files as any).signatureImage) {
    const signatureImage = (req.files as any).signatureImage[0];
    const uploadResult = await uploadSignatureImage(signatureImage);

    if (uploadResult.success && uploadResult.uploadData) {
      // Delete old signature image if it exists
      if (user.signatureImage) {
        try {
          await deleteFileFromS3(user.signatureImage);
        } catch (err) {
          console.error("Error deleting old signature image:", err);
        }
      }
      updateData.signatureImage = uploadResult.uploadData.url;
    }
  }

  // Handle profile image removal if requested
  if (updateData.removeProfileImage === "true") {
    if (user.profileImage) {
      try {
        await deleteFileFromS3(user.profileImage);
      } catch (err) {
        console.error("Error deleting profile image:", err);
      }
    }
    updateData.profileImage = undefined;
    delete updateData.removeProfileImage;
  }

  // Handle signature image removal if requested
  if (updateData.removeSignatureImage === "true") {
    if (user.signatureImage) {
      try {
        await deleteFileFromS3(user.signatureImage);
      } catch (err) {
        console.error("Error deleting signature image:", err);
      }
    }
    updateData.signatureImage = undefined;
    delete updateData.removeSignatureImage;
  }

  // Remove salary if role is being changed to admin/super_admin
  if (updateData.role && ["super_admin", "admin"].includes(updateData.role)) {
    updateData.salary = undefined;
  }

  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    select: "-password",
  });

  res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User updated successfully"));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Prevent self-deletion
  if (user._id.toString() === req.user?.userId) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  await User.findByIdAndDelete(id);

  res.status(200).json(new ApiResponse(200, null, "User deleted successfully"));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find user by email
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(403, "Account is inactive. Please contact admin.");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Create JWT token
  const token = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
    },
    "alghaza_secret",
    { expiresIn: "7d" }
  );

  // Remove password from response
  const userResponse = user.toObject();
  // delete userResponse.password;

  // Set cookie (optional)
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        token,
        user: {
          role: userResponse.role,
          name: userResponse.firstName,
          email: userResponse.email,
        },
      },
      "Login successful"
    )
  );
});

export const getActiveEngineers = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const engineers = await User.find({
      role: "engineer",
      isActive: true,
    }).select("-v -password");

    // Return response with pagination metadata
    res.status(200).json(
      new ApiResponse(
        200,
        {
          engineers,
        },
        "Users retrieved successfully"
      )
    );
  }
);

export const getActiveDrivers = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const drivers = await User.find({
      role: "driver",
      isActive: true,
    }).select("-v -password");
    // console.log(drivers);

    // Return response with pagination metadata
    res.status(200).json(
      new ApiResponse(
        200,
        {
          drivers,
        },
        "drivers retrieved successfully"
      )
    );
  }
);

export const getActiveWorkers = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const workers = await User.find({
      role: "worker",
      isActive: true,
    }).select("-v -password");
    // console.log(drivers);

    // Return response with pagination metadata
    res.status(200).json(
      new ApiResponse(
        200,
        {
          workers,
        },
        "drivers retrieved successfully"
      )
    );
  }
);
