import { Document, Schema, model, Types } from "mongoose";
import { IProject } from "./projectModel";
import { IUser } from "./userModel";
import { IEstimation } from "./estimationModel";

interface IQuotationItem {
  description: string;
  uom: string;
  image?: {
    url: string;
    key: string;
    mimetype: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IQuotation extends Document {
  project: Types.ObjectId | IProject;
  estimation: Types.ObjectId | IEstimation;
  quotationNumber: string;
  date: Date;
  validUntil: Date;
  scopeOfWork: string[];
  items: IQuotationItem[];
  subtotal: number;
  vatPercentage: number;
  vatAmount: number;
  netAmount: number;
  termsAndConditions: string[];
  preparedBy: Types.ObjectId | IUser;
  approvedBy?: Types.ObjectId | IUser;
  isApproved: boolean;
  approvalComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<IQuotationItem>({
  description: {
    type: String,
    required: [true, "Item description is required"],
    trim: true,
  },
  uom: {
    type: String,
    required: [true, "Unit of measurement is required"],
    trim: true,
  },
  image: {
    url: String,
    key: String,
    mimetype: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const quotationSchema = new Schema<IQuotation>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    estimation: {
      type: Schema.Types.ObjectId,
      ref: "Estimation",
      required: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    scopeOfWork: {
      type: [String],
      required: true,
    },
    items: {
      type: [quotationItemSchema],
      required: true,
      validate: {
        validator: (v: IQuotationItem[]) => v.length > 0,
        message: "At least one item is required",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    vatPercentage: {
      type: Number,
      default: 5,
      min: 0,
    },
    vatAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    termsAndConditions: {
      type: [String],
      required: true,
    },
    preparedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

quotationSchema.pre<IQuotation>("save", function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.vatAmount = this.subtotal * (this.vatPercentage / 100);
  this.netAmount = this.subtotal + this.vatAmount;
  next();
});

quotationSchema.index({ project: 1 });
quotationSchema.index({ estimation: 1 });
quotationSchema.index({ isApproved: 1 });

export const Quotation = model<IQuotation>("Quotation", quotationSchema);
