import { connectDb } from "../config/db";
import { User } from "../models/userModel";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await connectDb();

    const superAdminData = {
      email: "superadmin@example.com", // Change this to your desired email
      password: "SuperAdmin@123", // Change this to a strong password
      phoneNumbers: ["+1234567890"], // Change to actual phone number
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      isActive: true,
    };

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: "super_admin" });
    if (existingSuperAdmin) {
      console.log("Super admin already exists");

      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      superAdminData.password,
      SALT_ROUNDS
    );

    // Create super admin
    const superAdmin = await User.create({
      ...superAdminData,
      password: hashedPassword,
      // No createdBy since this is the first user
    });

    console.log("Super admin created successfully:");
    console.log({
      _id: superAdmin._id,
      email: superAdmin.email,
      role: superAdmin.role,
      createdAt: superAdmin.createdAt,
    });
  } catch (error) {
    console.error("Error seeding super admin:", error);
    process.exit(1);
  }
};

seedSuperAdmin();
