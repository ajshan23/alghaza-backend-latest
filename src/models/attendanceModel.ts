import { Document, Schema, model, Types } from "mongoose";

export interface IAttendance extends Document {
  project: Types.ObjectId;
  user: Types.ObjectId;
  date: Date;
  present: boolean;
  markedBy: Types.ObjectId;
  createdAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now(),
    },
    present: {
      type: Boolean,
      required: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for quick lookups
attendanceSchema.index({ project: 1, user: 1, date: 1 }, { unique: true });

export const Attendance = model<IAttendance>("Attendance", attendanceSchema);
