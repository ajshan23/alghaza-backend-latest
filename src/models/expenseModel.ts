import { Document, Schema, model, Types } from "mongoose";
import { IProject } from "./projectModel";
import { IUser } from "./userModel";

export interface IMaterialItem {
  description: string;
  date: Date;
  invoiceNo: string;
  amount: number;
  _id?: Types.ObjectId;
}

export interface IWorkerLabor {
  user: Types.ObjectId | IUser;
  daysPresent: number;
  dailySalary: number;
  totalSalary: number;
  _id?: Types.ObjectId;
}

export interface IDriverLabor {
  user: Types.ObjectId | IUser;
  daysPresent: number;
  dailySalary: number;
  totalSalary: number;
}

export interface IExpense extends Document {
  project: Types.ObjectId | IProject;
  materials: IMaterialItem[];
  totalMaterialCost: number;
  laborDetails: {
    workers: IWorkerLabor[];
    driver: IDriverLabor;
    totalLaborCost: number;
  };
  createdBy: Types.ObjectId | IUser;
  createdAt?: Date;
  updatedAt?: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    materials: [
      {
        description: { type: String, required: true },
        date: { type: Date, required: true, default: Date.now },
        invoiceNo: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    totalMaterialCost: { type: Number, default: 0 },
    laborDetails: {
      workers: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          daysPresent: { type: Number, required: true, min: 0 },
          dailySalary: { type: Number, required: true, min: 0 },
          totalSalary: { type: Number, required: true, min: 0 },
        },
      ],
      driver: {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        daysPresent: { type: Number, required: true, min: 0 },
        dailySalary: { type: Number, required: true, min: 0 },
        totalSalary: { type: Number, required: true, min: 0 },
      },
      totalLaborCost: { type: Number, default: 0 },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Calculate totals before saving
expenseSchema.pre<IExpense>("save", function (next) {
  this.totalMaterialCost = this.materials.reduce(
    (sum, material) => sum + material.amount,
    0
  );

  const workersTotal = this.laborDetails.workers.reduce(
    (sum, worker) => sum + worker.totalSalary,
    0
  );
  const driverTotal = this.laborDetails.driver.totalSalary;
  this.laborDetails.totalLaborCost = workersTotal + driverTotal;

  next();
});

export const Expense = model<IExpense>("Expense", expenseSchema);
