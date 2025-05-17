import { Document, Schema, model, Types } from "mongoose";
import { IProject } from "./projectModel";
import { IUser } from "./userModel";

interface IEstimationItem {
  description: string;
  uom: string; // Added UOM field
  quantity: number;
  unitPrice: number;
  total: number;
}
interface ITermsITem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ILabourItem {
  designation: string;
  days: number;
  price: number;
  total: number;
}

export interface IEstimation extends Document {
  project: Types.ObjectId | IProject;
  estimationNumber: string;
  workStartDate: Date;
  workEndDate: Date;
  validUntil: Date;
  paymentDueBy: number;

  subject?: string;
  materials: IEstimationItem[];
  labour: ILabourItem[];
  termsAndConditions: ITermsITem[];

  estimatedAmount: number;
  quotationAmount?: number;
  commissionAmount?: number;
  profit?: number;

  preparedBy: Types.ObjectId | IUser;
  checkedBy?: Types.ObjectId | IUser;
  approvedBy?: Types.ObjectId | IUser;

  isChecked: boolean;
  isApproved: boolean;
  approvalComment?: string;

  createdAt: Date;
  updatedAt: Date;
}

const estimationItemSchema = new Schema<IEstimationItem>({
  description: { type: String, required: true },
  uom: { type: String, required: true }, // Added UOM field
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});
const termItemSchema = new Schema<ITermsITem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const labourItemSchema = new Schema<ILabourItem>({
  designation: { type: String, required: true },
  days: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const estimationSchema = new Schema<IEstimation>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    estimationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    workStartDate: {
      type: Date,
      required: true,
    },
    workEndDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: IEstimation, value: Date) {
          return value > this.workStartDate;
        },
        message: "Work end date must be after start date",
      },
    },
    validUntil: {
      type: Date,
      required: true,
    },
    paymentDueBy: {
      type: Number,
      required: true,
      min: 0,
    },
    subject: {
      type: String,
    },
    materials: [estimationItemSchema],
    labour: [labourItemSchema],
    termsAndConditions: [termItemSchema],
    estimatedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quotationAmount: {
      type: Number,
      min: 0,
    },
    commissionAmount: {
      type: Number,
      min: 0,
    },
    profit: {
      type: Number,
    },
    preparedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isChecked: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvalComment: {
      type: String,
    },
  },
  { timestamps: true }
);

estimationSchema.pre<IEstimation>("save", function (next) {
  const materialsTotal = this.materials.reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );
  const labourTotal = this.labour.reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );
  const termsTotal = this.termsAndConditions.reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );

  this.estimatedAmount = materialsTotal + labourTotal + termsTotal;

  if (this.quotationAmount) {
    this.profit =
      this.quotationAmount -
      this.estimatedAmount -
      (this.commissionAmount || 0);
  }

  next();
});

estimationSchema.index({ project: 1 });
estimationSchema.index({ estimationNumber: 1 });
estimationSchema.index({ isApproved: 1 });
estimationSchema.index({ isChecked: 1 });
estimationSchema.index({ workStartDate: 1 });
estimationSchema.index({ workEndDate: 1 });

export const Estimation = model<IEstimation>("Estimation", estimationSchema);