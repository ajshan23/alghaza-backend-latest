import { Document, Schema, model, Types } from "mongoose";
import { IProject } from "./projectModel";
import { IUser } from "./userModel";

interface ILPOItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ILPODocument {
  url: string;
  key: string;
  name: string;
  mimetype: string;
  size: number;
}

export interface ILPO extends Document {
  project: Types.ObjectId | IProject;
  lpoNumber: string;
  lpoDate: Date;
  supplier: string;
  items: ILPOItem[];
  documents: ILPODocument[];
  totalAmount: number;
  createdBy: Types.ObjectId | IUser;
  createdAt?: Date;
  updatedAt?: Date;
}

const lpoItemSchema = new Schema<ILPOItem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
});

const lpoSchema = new Schema<ILPO>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    lpoNumber: {
      type: String,
      required: true,
      unique: true,
    },
    lpoDate: {
      type: Date,
      required: true,
    },
    supplier: {
      type: String,
      required: true,
    },
    items: [lpoItemSchema],
    documents: [
      {
        url: { type: String, required: true },
        key: { type: String, required: true },
        name: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-calculate total amount before saving
lpoSchema.pre<ILPO>("save", function (next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  next();
});

// Indexes
lpoSchema.index({ project: 1 });
lpoSchema.index({ lpoNumber: 1 });
lpoSchema.index({ supplier: 1 });
lpoSchema.index({ lpoDate: 1 });

export const LPO = model<ILPO>("LPO", lpoSchema);
