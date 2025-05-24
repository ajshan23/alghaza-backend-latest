import { Document, Schema, model, Types } from "mongoose";

export interface IAttendance extends Document {
  project?: Types.ObjectId; // Make optional for normal type
  user: Types.ObjectId;
  date: Date;
  present: boolean;
  markedBy: Types.ObjectId;
  type: "project" | "normal";
  createdAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: function () {
        return this.type === "project";
      },
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
    type: {
      type: String,
      enum: ["project", "normal"],
      required: true,
      default: "project",
    },
  },
  { timestamps: true }
);

// Compound index for quick lookups (only for project type)
attendanceSchema.index(
  { project: 1, user: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "project" },
  }
);

export const Attendance = model<IAttendance>("Attendance", attendanceSchema);
