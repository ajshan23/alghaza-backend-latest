import { Document, Schema, model, Types } from "mongoose";

export interface IComment extends Document {
  content: string;
  user: Types.ObjectId;
  project: Types.ObjectId;
  actionType:
    | "approval"
    | "rejection"
    | "check"
    | "general"
    | "progress_update";
  progress?: number; // New field to track progress updates
  createdAt?: Date;
  updatedAt?: Date;
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    actionType: {
      type: String,
      enum: ["approval", "rejection", "check", "general", "progress_update"],
      required: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

export const Comment = model<IComment>("Comment", commentSchema);
