import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Expense } from "../models/expenseModel";
import { Project } from "../models/projectModel";
import { Attendance } from "../models/attendanceModel";
import { Types } from "mongoose";
import dayjs from "dayjs";

interface MaterialInput {
  description: string;
  date?: Date;
  invoiceNo: string;
  amount: number;
}

interface WorkerLabor {
  user: Types.ObjectId;
  firstName: string;
  lastName: string;
  profileImage?: string;
  daysPresent: number;
  dailySalary: number;
  totalSalary: number;
}

interface DriverLabor {
  user: Types.ObjectId;
  firstName: string;
  lastName: string;
  profileImage?: string;
  daysPresent: number;
  dailySalary: number;
  totalSalary: number;
}

const calculateLaborDetails = async (projectId: string) => {
  const project = await Project.findById(projectId)
    .populate("assignedWorkers", "firstName lastName profileImage salary")
    .populate("assignedDriver", "firstName lastName profileImage salary");

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // For workers: count their individual attendance days
  const workerAttendanceRecords = await Attendance.find({
    project: projectId,
    present: true,
    user: { $in: project.assignedWorkers },
  }).populate("user", "firstName lastName");

  const workerDaysMap = new Map<string, number>();
  workerAttendanceRecords.forEach((record) => {
    const userIdStr = record.user._id.toString();
    workerDaysMap.set(userIdStr, (workerDaysMap.get(userIdStr) || 0) + 1);
  });

  // For driver: count unique dates when any attendance was marked for the project
  const projectAttendanceDates = await Attendance.aggregate([
    {
      $match: {
        project: new Types.ObjectId(projectId),
        present: true,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$date" },
        },
      },
    },
    {
      $count: "uniqueDates",
    },
  ]);

  const driverDaysPresent = projectAttendanceDates[0]?.uniqueDates || 0;

  const workers = project.assignedWorkers.map((worker: any) => ({
    user: worker._id,
    firstName: worker.firstName,
    lastName: worker.lastName,
    profileImage: worker.profileImage,
    daysPresent: workerDaysMap.get(worker._id.toString()) || 0,
    dailySalary: worker.salary || 0,
    totalSalary:
      (workerDaysMap.get(worker._id.toString()) || 0) * (worker.salary || 0),
  }));

  const driver = project.assignedDriver
    ? {
        user: project.assignedDriver._id,
        firstName: project.assignedDriver.firstName,
        lastName: project.assignedDriver.lastName,
        profileImage: project.assignedDriver.profileImage,
        daysPresent: driverDaysPresent,
        dailySalary: project.assignedDriver.salary || 0,
        totalSalary: driverDaysPresent * (project.assignedDriver.salary || 0),
      }
    : {
        user: new Types.ObjectId(),
        firstName: "",
        lastName: "",
        daysPresent: 0,
        dailySalary: 0,
        totalSalary: 0,
      };

  const totalLaborCost =
    workers.reduce((sum, worker) => sum + worker.totalSalary, 0) +
    driver.totalSalary;

  return {
    workers,
    driver,
    totalLaborCost,
  };
};

export const getProjectLaborData = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    try {
      const laborData = await calculateLaborDetails(projectId);
      res
        .status(200)
        .json(
          new ApiResponse(200, laborData, "Labor data fetched successfully")
        );
    } catch (error) {
      throw new ApiError(500, "Failed to fetch labor data");
    }
  }
);

export const createExpense = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { materials } = req.body as { materials: MaterialInput[] };
    const userId = req.user?.userId;

    if (!materials || !Array.isArray(materials)) {
      throw new ApiError(400, "Materials array is required");
    }

    const laborDetails = await calculateLaborDetails(projectId);
    const totalMaterialCost = materials.reduce((sum, m) => sum + m.amount, 0);

    const expense = await Expense.create({
      project: projectId,
      materials: materials.map((material) => ({
        description: material.description,
        date: material.date || new Date(),
        invoiceNo: material.invoiceNo,
        amount: material.amount,
      })),
      laborDetails,
      totalMaterialCost,
      createdBy: userId,
    });

    res
      .status(201)
      .json(new ApiResponse(201, expense, "Expense created successfully"));
  }
);

export const getProjectExpenses = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await Expense.countDocuments({ project: projectId });

    const expenses = await Expense.find({ project: projectId })
      .populate(
        "laborDetails.workers.user",
        "firstName lastName profileImage salary"
      )
      .populate(
        "laborDetails.driver.user",
        "firstName lastName profileImage salary"
      )
      .populate("createdBy", "firstName lastName")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          expenses,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        },
        "Expenses fetched successfully"
      )
    );
  }
);

export const getExpenseById = asyncHandler(
  async (req: Request, res: Response) => {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId)
      .populate(
        "laborDetails.workers.user",
        "firstName lastName profileImage salary"
      )
      .populate(
        "laborDetails.driver.user",
        "firstName lastName profileImage salary"
      )
      .populate("createdBy", "firstName lastName")
      .populate("project", "projectName projectNumber");

    if (!expense) {
      throw new ApiError(404, "Expense not found");
    }
    console.log(expense.laborDetails.workers);

    res
      .status(200)
      .json(new ApiResponse(200, expense, "Expense fetched successfully"));
  }
);

export const updateExpense = asyncHandler(
  async (req: Request, res: Response) => {
    const { expenseId } = req.params;
    const { materials } = req.body as { materials: MaterialInput[] };

    if (!materials || !Array.isArray(materials)) {
      throw new ApiError(400, "Materials array is required");
    }

    const existingExpense = await Expense.findById(expenseId);
    if (!existingExpense) {
      throw new ApiError(404, "Expense not found");
    }

    const laborDetails = await calculateLaborDetails(
      existingExpense.project.toString()
    );
    const totalMaterialCost = materials.reduce((sum, m) => sum + m.amount, 0);

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      {
        materials: materials.map((material) => ({
          description: material.description,
          date: material.date || new Date(),
          invoiceNo: material.invoiceNo,
          amount: material.amount,
        })),
        laborDetails,
        totalMaterialCost,
        updatedAt: new Date(),
      },
      { new: true }
    )
      .populate(
        "laborDetails.workers.user",
        "firstName lastName profileImage salary"
      )
      .populate(
        "laborDetails.driver.user",
        "firstName lastName profileImage salary"
      )
      .populate("createdBy", "firstName lastName");

    res
      .status(200)
      .json(
        new ApiResponse(200, updatedExpense, "Expense updated successfully")
      );
  }
);

export const deleteExpense = asyncHandler(
  async (req: Request, res: Response) => {
    const { expenseId } = req.params;

    const expense = await Expense.findByIdAndDelete(expenseId);
    if (!expense) {
      throw new ApiError(404, "Expense not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, null, "Expense deleted successfully"));
  }
);

export const getExpenseSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const expenses = await Expense.find({ project: projectId });

    const summary = {
      totalMaterialCost: expenses.reduce(
        (sum, e) => sum + e.totalMaterialCost,
        0
      ),
      totalLaborCost: expenses.reduce(
        (sum, e) => sum + e.laborDetails.totalLaborCost,
        0
      ),
      workersCost: expenses.reduce(
        (sum, e) =>
          sum +
          e.laborDetails.workers.reduce((wSum, w) => wSum + w.totalSalary, 0),
        0
      ),
      driverCost: expenses.reduce(
        (sum, e) => sum + e.laborDetails.driver.totalSalary,
        0
      ),
      totalExpenses: expenses.reduce(
        (sum, e) => sum + e.totalMaterialCost + e.laborDetails.totalLaborCost,
        0
      ),
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, summary, "Expense summary fetched successfully")
      );
  }
);
