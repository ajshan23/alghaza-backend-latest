import { Document, Schema, model, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  phoneNumbers: string[];
  firstName: string;
  lastName: string;
  role: string;
  salary?: number;
  isActive?: boolean;
  profileImage?: string;
  signatureImage?: string;
  address?: string;

  accountNumber?: string;
  emiratesId?: string;
  emiratesIdDocument?: string; // URL to the document
  passportNumber?: string;
  passportDocument?: string; // URL to the document

  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Never return password in queries
    },
    phoneNumbers: {
      type: [String],
      required: true,
      validate: {
        validator: (numbers: string[]) => numbers.length > 0,
        message: "At least one phone number is required",
      },
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["super_admin", "admin", "engineer", "finance", "driver", "worker"],
      default: "worker",
    },
    salary: {
      type: Number,
      required: function () {
        return !["super_admin", "admin"].includes(this.role);
      },
      min: 0,
      validate: {
        validator: function (this: IUser, value: number) {
          return ["super_admin", "admin"].includes(this.role) || value > 0;
        },
        message: "Salary must be greater than 0 for this role",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      type: String,
    },
    signatureImage: {
      type: String,
    },
    address: {
      type: String,
    },

    accountNumber: {
      type: String,
      trim: true,
    },
    emiratesId: {
      type: String,
      trim: true,
    },
    emiratesIdDocument: {
      type: String,
    },
    passportNumber: {
      type: String,
      trim: true,
    },
    passportDocument: {
      type: String,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password; // Always remove password from JSON output
        delete ret.__v; // Remove version key
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ firstName: "text", lastName: "text", email: "text" });

export const User = model<IUser>("User", userSchema);
