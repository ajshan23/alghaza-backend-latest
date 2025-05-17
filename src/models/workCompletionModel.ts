// models/workCompletionModel.ts
import { Document, Schema, model, Types } from "mongoose";

export interface IWorkCompletionImage {
  title: string;
  imageUrl: string;
  s3Key: string; // Important for managing files in S3
  description?: string;
  uploadedAt: Date;
}

export interface IWorkCompletion extends Document {
  project: Types.ObjectId;
  images: IWorkCompletionImage[];
  createdBy: Types.ObjectId;
  createdAt?: Date;
}

const workCompletionImageSchema = new Schema<IWorkCompletionImage>({
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
  s3Key: { type: String, required: true },
  description: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

const workCompletionSchema = new Schema<IWorkCompletion>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    images: [workCompletionImageSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
workCompletionSchema.index({ project: 1 });
workCompletionSchema.index({ createdBy: 1 });

export const WorkCompletion = model<IWorkCompletion>(
  "WorkCompletion",
  workCompletionSchema
);
