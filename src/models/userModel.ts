// user.model.ts
import { Document, Schema, model, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  phoneNumbers: string[];
  firstName: string;
  lastName: string;
  role: string;
  salary?: number; // Add salary field
  isActive?: boolean;
  profileImage?: string;
  signatureImage?: string;
  address?: string;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumbers: { type: [String], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["super_admin", "admin", "engineer", "finance", "driver", "worker"],
    },
    salary: {
      type: Number,
      required: function () {
        return !["super_admin", "admin"].includes(this.role);
      },
      min: 0,
    },
    isActive: { type: Boolean, default: true },
    profileImage: { type: String },
    signatureImage: { type: String },
    address: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
